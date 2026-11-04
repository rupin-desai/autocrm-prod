import type { Express, Request } from "express";
import { requireAuth, requirePermission } from "../middleware";
import { getCompanyForUser } from "./accountingFoundation";
import { AccountGroup } from "../models/AccountGroup";
import { LedgerAccount } from "../models/LedgerAccount";
import { SalesAccountingMapping } from "../models/SalesAccountingMapping";
import { AccountingAuditEvent } from "../models/AccountingAuditEvent";
import { salesAccountingMappingSchema } from "../salesAccountingSchemas";
import { RegistrationCustomer } from "../models/RegistrationCustomer";
import { ServiceVisit } from "../models/ServiceVisit";
import { Order } from "../models/Order";
import { Invoice } from "../models/Invoice";
import { AdvancePayment } from "../models/AdvancePayment";
import { validateSalesMappingClassification } from "../salesAccountingLogic";

type AuthRequest = Request & {
  session: Request["session"] & {
    userId?: string;
    userRole?: string;
    accountingCompanyId?: string;
  };
};
const mappingFields = [
  "productSalesLedgerId",
  "serviceIncomeLedgerId",
  "outputCgstLedgerId",
  "outputSgstLedgerId",
  "outputIgstLedgerId",
  "customerAdvancesLedgerId",
  "cashLedgerId",
  "upiClearingLedgerId",
  "cardClearingLedgerId",
  "netBankingClearingLedgerId",
  "chequeClearingLedgerId",
];
const ownershipModels: Record<string, any> = {
  RegistrationCustomer,
  ServiceVisit,
  Order,
  Invoice,
  AdvancePayment,
};

async function validateMappings(companyId: string, data: any) {
  const ids = mappingFields.map((field) => data[field]).filter(Boolean);
  const ledgers: any[] = await LedgerAccount.find({
    _id: { $in: ids },
    companyId,
  }).lean();
  if (ledgers.length !== new Set(ids).size)
    throw new Error(
      "Every mapping must reference an existing ledger in this company",
    );
  const groups: any[] = await AccountGroup.find({
    _id: { $in: ledgers.map((l) => l.groupId) },
    companyId,
  }).lean();
  const groupById = new Map(groups.map((g) => [String(g._id), g]));
  const ledgerById = new Map(ledgers.map((l) => [String(l._id), l]));
  for (const field of mappingFields) {
    const id = data[field];
    if (!id) continue;
    const ledger: any = ledgerById.get(String(id));
    const group: any = groupById.get(String(ledger.groupId));
    if (
      !ledger ||
      ledger.status !== "active" ||
      !group ||
      group.status !== "active"
    )
      throw new Error(`Mapping ${field} must use an active ledger and group`);
    const classificationError = validateSalesMappingClassification(
      field,
      group.rootCategory,
      ledger.ledgerType,
    );
    if (classificationError) throw new Error(classificationError);
  }
}

export function registerSalesAccountingRoutes(app: Express) {
  app.get(
    "/api/accounting/ownership-review",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = String(
          req.query.companyId || request.session.accountingCompanyId || "",
        );
        if (!(await getCompanyForUser(request, companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const result: any = {};
        for (const [type, Model] of Object.entries(ownershipModels))
          result[type] = await Model.find({
            $or: [
              { ownershipStatus: { $in: ["unverified", "conflict"] } },
              { companyId: { $exists: false } },
            ],
          })
            .limit(100)
            .lean();
        res.json({ companyId, records: result });
      } catch (e: any) {
        res
          .status(400)
          .json({ error: e.message || "Failed to load ownership review" });
      }
    },
  );
  app.post(
    "/api/accounting/ownership-review/:entityType/:id",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const Model = ownershipModels[req.params.entityType];
        const companyId = String(req.body.companyId || "");
        if (!Model || !(await getCompanyForUser(request, companyId)))
          return res
            .status(403)
            .json({ error: "Invalid ownership review request" });
        const record: any = await Model.findById(req.params.id);
        if (!record) return res.status(404).json({ error: "Record not found" });
        if (record.companyId && String(record.companyId) !== companyId)
          return res
            .status(409)
            .json({ error: "Record already belongs to a different company" });
        const links = [
          [record.customerId, RegistrationCustomer],
          [record.serviceVisitId, ServiceVisit],
          [record.orderId, Order],
        ].filter(([id]) => Boolean(id)) as Array<[any, any]>;
        for (const [linkedId, LinkedModel] of links) {
          const linked: any = await LinkedModel.findById(linkedId)
            .select("companyId")
            .lean();
          if (linked?.companyId && String(linked.companyId) !== companyId)
            return res
              .status(409)
              .json({ error: "Linked record belongs to a different company" });
        }
        record.companyId = companyId;
        record.ownershipStatus = "verified";
        await record.save();
        await AccountingAuditEvent.create({
          companyId,
          entityType: req.params.entityType,
          entityId: record._id,
          action: "ownership_verified",
          performedBy: request.session.userId,
        });
        res.json(record);
      } catch (e: any) {
        res
          .status(400)
          .json({ error: e.message || "Failed to verify ownership" });
      }
    },
  );
  app.get(
    "/api/accounting/sales-mappings",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = String(
          req.query.companyId || request.session.accountingCompanyId || "",
        );
        if (!(await getCompanyForUser(request, companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const mapping = await SalesAccountingMapping.findOne({ companyId })
          .populate(mappingFields.join(" "))
          .lean();
        res.json({
          companyId,
          mapping: mapping || null,
          requiredFields: mappingFields,
          missingFields: mappingFields.filter(
            (field) => !(mapping as any)?.[field],
          ),
        });
      } catch (e: any) {
        res.status(400).json({
          error: e.message || "Failed to load sales accounting mappings",
        });
      }
    },
  );
  app.put(
    "/api/accounting/sales-mappings",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data: any = salesAccountingMappingSchema.parse(req.body);
        if (!(await getCompanyForUser(request, data.companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        await validateMappings(data.companyId, data);
        const mapping = await SalesAccountingMapping.findOneAndUpdate(
          { companyId: data.companyId },
          { $set: { ...data, updatedBy: request.session.userId } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        await AccountingAuditEvent.create({
          companyId: data.companyId,
          entityType: "SalesAccountingMapping",
          entityId: mapping._id,
          action: "updated",
          performedBy: request.session.userId,
          metadata: { fields: mappingFields.filter((field) => data[field]) },
        });
        res.json(mapping);
      } catch (e: any) {
        res.status(e?.code === 11000 ? 409 : 400).json({
          error:
            e?.issues?.[0]?.message ||
            e.message ||
            "Failed to save sales accounting mappings",
        });
      }
    },
  );
}
