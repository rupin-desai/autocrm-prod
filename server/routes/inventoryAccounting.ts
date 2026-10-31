import type { Express, Request } from "express";
import { requireAuth, requirePermission } from "../middleware";
import { getCompanyForUser, ensureFinancialYear } from "./accountingFoundation";
import { Warehouse } from "../models/Warehouse";
import { WarehouseStock } from "../models/WarehouseStock";
import { InventoryMovement } from "../models/InventoryMovement";
import { InventoryOperation } from "../models/InventoryOperation";
import { InventoryAccountingMapping } from "../models/InventoryAccountingMapping";
import { LedgerAccount } from "../models/LedgerAccount";
import { AccountGroup } from "../models/AccountGroup";
import { Product } from "../models/Product";
import { AccountingAuditEvent } from "../models/AccountingAuditEvent";
import {
  postInventoryMovement,
  postInventoryTransfer,
  postInventoryOperation,
} from "../services/inventoryMovements";
import {
  warehouseSchema,
  inventoryMappingSchema,
  movementSchema,
  transferSchema,
  operationSchema,
  operationStatusSchema,
} from "../inventorySchemas";
import { PurchaseBill } from "../models/PurchaseBill";
import { Invoice } from "../models/Invoice";

type AuthRequest = Request & {
  session: Request["session"] & {
    userId?: string;
    userRole?: string;
    accountingCompanyId?: string;
    accountingFinancialYearId?: string;
  };
};
const uid = (req: AuthRequest) => req.session.userId as string;
const fail = (message: string): never => {
  throw new Error(message);
};
const errorMessage = (error: any) =>
  error?.issues?.[0]?.message || error?.message || "Inventory request failed";
async function company(req: AuthRequest) {
  const id = String(req.session.accountingCompanyId || "");
  if (!id || !(await getCompanyForUser(req, id)))
    fail("Accounting company context is required");
  return id;
}
async function audit(
  req: AuthRequest,
  companyId: string,
  entityType: string,
  entityId: any,
  action: string,
  financialYearId?: any,
) {
  await AccountingAuditEvent.create({
    companyId,
    financialYearId,
    entityType,
    entityId,
    action,
    performedBy: uid(req),
    ipAddress: req.ip,
  });
}
async function eligibleLedger(companyId: string, id: any, roots: string[]) {
  const ledger: any = await LedgerAccount.findOne({
    _id: id,
    companyId,
    status: "active",
  }).lean();
  if (!ledger) fail("Ledger is not an active ledger of this company");
  const group: any = await AccountGroup.findOne({
    _id: ledger.groupId,
    companyId,
    status: "active",
  }).lean();
  if (!group || !roots.includes(group.rootCategory))
    fail("Ledger classification is not valid for this mapping");
  return ledger;
}

export function registerInventoryAccountingRoutes(app: Express) {
  app.get(
    "/api/accounting/inventory/warehouses",
    requireAuth,
    requirePermission("inventory", "read"),
    async (req, res) => {
      try {
        const id = await company(req as AuthRequest);
        res.json(
          await Warehouse.find({ companyId: id })
            .sort({ warehouseName: 1 })
            .lean(),
        );
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/inventory/warehouses",
    requireAuth,
    requirePermission("inventory", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = await company(request);
        const data: any = warehouseSchema.parse({ ...req.body, companyId });
        if (data.isDefault)
          await Warehouse.updateMany(
            { companyId },
            { $set: { isDefault: false } },
          );
        const created = await Warehouse.create({
          ...data,
          companyId,
          ownershipStatus: "verified",
          createdBy: uid(request),
        });
        await audit(request, companyId, "Warehouse", created._id, "created");
        res.status(201).json(created);
      } catch (e: any) {
        res
          .status(e?.code === 11000 ? 409 : 400)
          .json({ error: errorMessage(e) });
      }
    },
  );
  app.patch(
    "/api/accounting/inventory/warehouses/:id",
    requireAuth,
    requirePermission("inventory", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = await company(request);
        const warehouse: any = await Warehouse.findOne({
          _id: req.params.id,
          companyId,
        });
        if (!warehouse)
          return res.status(404).json({ error: "Warehouse not found" });
        const data: any = warehouseSchema
          .partial()
          .omit({ companyId: true })
          .parse(req.body);
        if (data.isDefault)
          await Warehouse.updateMany(
            { companyId, _id: { $ne: warehouse._id } },
            { $set: { isDefault: false } },
          );
        Object.assign(warehouse, data, { updatedBy: uid(request) });
        await warehouse.save();
        await audit(request, companyId, "Warehouse", warehouse._id, "updated");
        res.json(warehouse);
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/inventory/mappings",
    requireAuth,
    requirePermission("inventory", "read"),
    async (req, res) => {
      try {
        const companyId = await company(req as AuthRequest);
        const mapping: any = await InventoryAccountingMapping.findOne({
          companyId,
        })
          .populate(
            "inventoryAssetLedgerId costOfGoodsSoldLedgerId purchaseReceiptClearingLedgerId stockAdjustmentGainLedgerId stockAdjustmentLossLedgerId inventoryOpeningBalanceLedgerId",
          )
          .lean();
        res.json({
          companyId,
          mapping,
          requiredFields: [
            "inventoryAssetLedgerId",
            "costOfGoodsSoldLedgerId",
            "purchaseReceiptClearingLedgerId",
            "stockAdjustmentGainLedgerId",
            "stockAdjustmentLossLedgerId",
            "inventoryOpeningBalanceLedgerId",
          ],
        });
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.put(
    "/api/accounting/inventory/mappings",
    requireAuth,
    requirePermission("inventory", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = await company(request);
        const data: any = inventoryMappingSchema.parse({
          ...req.body,
          companyId,
        });
        const rootRules: Record<string, string[]> = {
          inventoryAssetLedgerId: ["assets"],
          costOfGoodsSoldLedgerId: ["expenses"],
          purchaseReceiptClearingLedgerId: ["liabilities", "assets"],
          stockAdjustmentGainLedgerId: ["income"],
          stockAdjustmentLossLedgerId: ["expenses"],
          inventoryOpeningBalanceLedgerId: ["equity", "liabilities"],
        };
        for (const [field, roots] of Object.entries(rootRules))
          if (data[field]) await eligibleLedger(companyId, data[field], roots);
        const saved = await InventoryAccountingMapping.findOneAndUpdate(
          { companyId },
          { $set: { ...data, updatedBy: uid(request) } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        await audit(
          request,
          companyId,
          "InventoryAccountingMapping",
          saved._id,
          "updated",
        );
        res.json(saved);
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/inventory/movements",
    requireAuth,
    requirePermission("inventory", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = await company(request);
        const data: any = movementSchema.parse(req.body);
        const fy = await ensureFinancialYear(
          request,
          companyId,
          data.financialYearId,
        );
        if (!fy) fail("Financial year does not belong to the company");
        const movement = await postInventoryMovement(
          { ...data, companyId },
          uid(request),
        );
        await audit(
          request,
          companyId,
          "InventoryMovement",
          movement._id,
          "posted",
          data.financialYearId,
        );
        res.status(201).json(movement);
      } catch (e: any) {
        res
          .status(e?.code === 11000 ? 409 : 400)
          .json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/inventory/operations",
    requireAuth,
    requirePermission("inventory", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = await company(request);
        const data: any = operationSchema.parse(req.body);
        const fy = await ensureFinancialYear(
          request,
          companyId,
          data.financialYearId,
        );
        if (!fy) fail("Financial year does not belong to the company");
        if (
          data.operationType === "stock_adjustment" &&
          !/(increase|decrease)/i.test(data.reason)
        )
          fail("Stock adjustment reason must state increase or decrease");
        if (data.operationType === "purchase_receipt") {
          const bill: any = await PurchaseBill.findOne({
            _id: data.sourceId,
            companyId,
            status: { $in: ["approved", "posted"] },
          }).lean();
          if (!bill) fail("Approved or posted purchase bill is required");
          const productIds = new Set(
            bill.lines
              .filter((line: any) => line.type === "product" && line.productId)
              .map((line: any) => String(line.productId)),
          );
          if (
            data.items.some(
              (item: any) => !productIds.has(String(item.productId)),
            )
          )
            fail("Receipt contains a product not present on the purchase bill");
        }
        if (data.operationType === "sales_issue") {
          const invoice: any = await Invoice.findOne({
            _id: data.sourceId,
            companyId,
            ownershipStatus: "verified",
            status: "approved",
          }).lean();
          if (!invoice) fail("Verified approved invoice is required");
        }
        const existing = await InventoryOperation.findOne({
          companyId,
          idempotencyKey: data.idempotencyKey,
        }).lean();
        if (existing) return res.json(existing);
        const created = await InventoryOperation.create({
          ...data,
          companyId,
          createdBy: uid(request),
        });
        await audit(
          request,
          companyId,
          "InventoryOperation",
          created._id,
          "created",
          data.financialYearId,
        );
        res.status(201).json(created);
      } catch (e: any) {
        res
          .status(e?.code === 11000 ? 409 : 400)
          .json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/inventory/operations/:id/status",
    requireAuth,
    requirePermission("inventory", "approve"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = await company(request);
        const { status } = operationStatusSchema.parse(req.body);
        const operation: any = await InventoryOperation.findOne({
          _id: req.params.id,
          companyId,
        });
        if (!operation)
          return res
            .status(404)
            .json({ error: "Inventory operation not found" });
        if (status === "approved" && operation.status !== "submitted")
          fail("Only submitted operations can be approved");
        if (status === "submitted" && operation.status !== "draft")
          fail("Only draft operations can be submitted");
        operation.status = status;
        if (status === "approved") operation.approvedBy = uid(request);
        await operation.save();
        await audit(
          request,
          companyId,
          "InventoryOperation",
          operation._id,
          status,
        );
        res.json(operation);
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/inventory/operations/:id/post",
    requireAuth,
    requirePermission("inventory", "post"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = await company(request);
        const operation: any = await InventoryOperation.findOne({
          _id: req.params.id,
          companyId,
        });
        if (!operation)
          return res
            .status(404)
            .json({ error: "Inventory operation not found" });
        const result = await postInventoryOperation(
          String(operation._id),
          uid(request),
        );
        await audit(
          request,
          companyId,
          "InventoryOperation",
          operation._id,
          "posted",
          operation.financialYearId,
        );
        res.status(201).json(result);
      } catch (e: any) {
        res
          .status(e?.code === 11000 ? 409 : 400)
          .json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/inventory/operations",
    requireAuth,
    requirePermission("inventory", "read"),
    async (req, res) => {
      try {
        const companyId = await company(req as AuthRequest);
        const query: any = { companyId };
        if (req.query.operationType)
          query.operationType = req.query.operationType;
        if (req.query.status) query.status = req.query.status;
        res.json(
          await InventoryOperation.find(query)
            .sort({ createdAt: -1 })
            .limit(200)
            .lean(),
        );
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/inventory/transfers",
    requireAuth,
    requirePermission("inventory", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = await company(request);
        const data: any = transferSchema.parse(req.body);
        if (data.sourceWarehouseId === data.destinationWarehouseId)
          fail("Source and destination warehouses must differ");
        const fy = await ensureFinancialYear(
          request,
          companyId,
          data.financialYearId,
        );
        if (!fy) fail("Financial year does not belong to the company");
        const transfer = await postInventoryTransfer(
          { ...data, companyId },
          uid(request),
        );
        res.status(201).json(transfer);
      } catch (e: any) {
        res
          .status(e?.code === 11000 ? 409 : 400)
          .json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/inventory/stock-summary",
    requireAuth,
    requirePermission("inventory", "read"),
    async (req, res) => {
      try {
        const companyId = await company(req as AuthRequest);
        const query: any = { companyId };
        if (req.query.warehouseId) query.warehouseId = req.query.warehouseId;
        if (req.query.productId) query.productId = req.query.productId;
        const items = await WarehouseStock.find(query)
          .populate("productId", "productName productId barcode")
          .populate("warehouseId", "warehouseName warehouseCode")
          .sort({ updatedAt: -1 })
          .limit(500)
          .lean();
        res.json(
          items.map((item: any) => ({
            ...item,
            availableQuantity: Math.max(
              0,
              item.quantityOnHand - item.reservedQuantity,
            ),
          })),
        );
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/inventory/ledger",
    requireAuth,
    requirePermission("inventory", "read"),
    async (req, res) => {
      try {
        const companyId = await company(req as AuthRequest);
        const query: any = { companyId };
        for (const field of ["warehouseId", "productId", "financialYearId"])
          if (req.query[field]) query[field] = req.query[field];
        const items = await InventoryMovement.find(query)
          .populate("productId", "productName productId")
          .populate("warehouseId", "warehouseName warehouseCode")
          .sort({ movementDate: 1, createdAt: 1 })
          .limit(1000)
          .lean();
        const balance = new Map<string, number>();
        const result = items.map((item: any) => {
          const key = `${item.productId?._id || item.productId}:${item.warehouseId?._id || item.warehouseId}`;
          const next =
            (balance.get(key) || 0) + item.quantityIn - item.quantityOut;
          balance.set(key, next);
          return { ...item, runningBalance: next };
        });
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/inventory/valuation",
    requireAuth,
    requirePermission("inventory", "read"),
    async (req, res) => {
      try {
        const companyId = await company(req as AuthRequest);
        const query: any = { companyId };
        if (req.query.warehouseId) query.warehouseId = req.query.warehouseId;
        const items = await WarehouseStock.find(query)
          .populate("productId", "productName productId")
          .populate("warehouseId", "warehouseName warehouseCode")
          .lean();
        res.json({
          items,
          totalInventoryValuePaise: items.reduce(
            (sum, item: any) => sum + Number(item.inventoryValuePaise || 0),
            0,
          ),
        });
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
}
