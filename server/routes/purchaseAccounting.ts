import type { Express, Request } from "express";
import { requireAuth, requirePermission } from "../middleware";
import { getCompanyForUser, ensureFinancialYear } from "./accountingFoundation";
import { Company } from "../models/Company";
import { FinancialYear } from "../models/FinancialYear";
import { AccountingPeriod } from "../models/AccountingPeriod";
import { AccountGroup } from "../models/AccountGroup";
import { LedgerAccount } from "../models/LedgerAccount";
import { AccountingVoucher } from "../models/AccountingVoucher";
import { AccountingAuditEvent } from "../models/AccountingAuditEvent";
import { Supplier } from "../models/Supplier";
import { PurchaseAccountingMapping } from "../models/PurchaseAccountingMapping";
import { PurchaseBill } from "../models/PurchaseBill";
import { PurchaseAccountingSource } from "../models/PurchaseAccountingSource";
import { SupplierPayment } from "../models/SupplierPayment";
import { SupplierAdvance } from "../models/SupplierAdvance";
import { SupplierAdvanceAllocation } from "../models/SupplierAdvanceAllocation";
import { PurchaseReturn } from "../models/PurchaseReturn";
import mongoose from "mongoose";
import {
  postVoucher,
  postVoucherInSession,
} from "../services/accountingVouchers";
import {
  validatePurchaseBillTotals,
  paymentAllocationTotal,
} from "../purchaseAccountingLogic";
import {
  supplierSchema,
  purchaseMappingSchema,
  purchaseBillSchema,
  purchaseStatusSchema,
  supplierPaymentSchema,
  supplierAdvanceSchema,
  supplierAdvanceAllocationSchema,
  purchaseReturnSchema,
} from "../purchaseAccountingSchemas";

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
const date = (value: string | Date) =>
  new Date(
    `${typeof value === "string" ? value : value.toISOString().slice(0, 10)}T00:00:00.000Z`,
  );
const paise = (value: number) => Number.isSafeInteger(value) && value >= 0;
const line = (
  ledgerAccountId: any,
  debitPaise: number,
  creditPaise: number,
  description: string,
) => ({ ledgerAccountId, debitPaise, creditPaise, description });

async function company(req: AuthRequest, companyId: string) {
  const result = await getCompanyForUser(req, companyId);
  if (!result) fail("You are not authorized for this company");
  return result;
}
async function context(
  req: AuthRequest,
  companyId: string,
  financialYearId: string,
  transactionDate: Date,
) {
  await company(req, companyId);
  const fy = await ensureFinancialYear(req, companyId, financialYearId);
  if (!fy) fail("Financial year does not belong to this company");
  const period: any = await AccountingPeriod.findOne({
    companyId,
    financialYearId,
    startDate: { $lte: transactionDate },
    endDate: { $gte: transactionDate },
  });
  if (!period || period.status !== "open")
    fail("No open accounting period covers this transaction date");
  return { fy, period };
}
async function supplier(companyId: string, supplierId: string) {
  const value: any = await Supplier.findOne({
    _id: supplierId,
    companyId,
    status: "active",
    ownershipStatus: "verified",
  });
  if (!value) fail("Verified active supplier not found");
  return value;
}
async function mapping(companyId: string) {
  const value: any = await PurchaseAccountingMapping.findOne({
    companyId,
  }).lean();
  if (!value) fail("Purchase accounting mappings are not configured");
  return value;
}
async function ledger(companyId: string, id: any, expected?: string[]) {
  const value: any = await LedgerAccount.findOne({
    _id: id,
    companyId,
    status: "active",
  }).lean();
  if (!value) fail("Mapped ledger is invalid");
  if (expected?.length && !expected.includes(String(value.ledgerType)))
    fail("Mapped ledger type is invalid");
  const group: any = await AccountGroup.findOne({
    _id: value.groupId,
    companyId,
    status: "active",
  }).lean();
  if (!group) fail("Mapped ledger group is invalid");
  return { ...value, group };
}
async function supplierLedger(companyId: string, supplierId: string) {
  const s: any = await Supplier.findOne({ _id: supplierId, companyId }).lean();
  if (!s?.ledgerAccountId) fail("Supplier payable ledger is not linked");
  return ledger(companyId, s.ledgerAccountId, ["supplier"]);
}
async function audit(
  req: AuthRequest,
  companyId: string,
  entityType: string,
  entityId: any,
  action: string,
  financialYearId?: any,
  metadata?: any,
) {
  await AccountingAuditEvent.create({
    companyId,
    financialYearId,
    entityType,
    entityId,
    action,
    performedBy: uid(req),
    ipAddress: req.ip,
    metadata,
  });
}

const mappingFields = [
  "purchaseGoodsLedgerId",
  "purchaseReturnsLedgerId",
  "purchaseExpensesLedgerId",
  "inputCgstLedgerId",
  "inputSgstLedgerId",
  "inputIgstLedgerId",
  "supplierPayableLedgerId",
  "cashLedgerId",
  "bankLedgerId",
  "upiClearingLedgerId",
  "cardClearingLedgerId",
  "chequeClearingLedgerId",
  "supplierAdvancesLedgerId",
];
async function validateMapping(companyId: string, data: any) {
  for (const field of mappingFields)
    if (data[field]) {
      const mapped: any = await ledger(companyId, data[field]);
      const root = mapped.group.rootCategory;
      if (
        [
          "purchaseGoodsLedgerId",
          "purchaseReturnsLedgerId",
          "purchaseExpensesLedgerId",
        ].includes(field) &&
        root !== "expenses"
      )
        fail(`${field} must use an expense group`);
      if (
        [
          "inputCgstLedgerId",
          "inputSgstLedgerId",
          "inputIgstLedgerId",
        ].includes(field) &&
        root !== "assets"
      )
        fail(`${field} must use an asset tax ledger`);
      if (
        ["supplierPayableLedgerId", "supplierAdvancesLedgerId"].includes(
          field,
        ) &&
        root !== "liabilities"
      )
        fail(`${field} must use a liability group`);
      if (field === "cashLedgerId" && mapped.ledgerType !== "cash")
        fail("Cash mapping must use a cash ledger");
      if (
        [
          "bankLedgerId",
          "upiClearingLedgerId",
          "cardClearingLedgerId",
          "chequeClearingLedgerId",
        ].includes(field) &&
        !["bank", "general"].includes(mapped.ledgerType)
      )
        fail(`${field} must use a bank or clearing ledger`);
    }
}

function errorMessage(error: any) {
  return (
    error?.issues?.[0]?.message ||
    error?.message ||
    "Purchase accounting request failed"
  );
}

async function billAmounts(bill: any) {
  const check = validatePurchaseBillTotals(bill);
  if (!check.valid) fail(check.error);
  return check;
}
async function billSettledPaise(companyId: string, billId: any) {
  const [payments, allocations] = await Promise.all([
    SupplierPayment.find({
      companyId,
      status: "posted",
      "allocations.purchaseBillId": billId,
    }).lean(),
    SupplierAdvanceAllocation.find({
      companyId,
      purchaseBillId: billId,
      status: "confirmed",
    }).lean(),
  ]);
  return (
    payments.reduce(
      (sum: number, payment: any) =>
        sum +
        payment.allocations
          .filter((item: any) => String(item.purchaseBillId) === String(billId))
          .reduce((inner: number, item: any) => inner + item.amountPaise, 0),
      0,
    ) +
    allocations.reduce((sum: number, item: any) => sum + item.amountPaise, 0)
  );
}
async function purchaseLines(companyId: string, bill: any, map: any) {
  const lines: any[] = [];
  const goods = map.purchaseGoodsLedgerId
    ? await ledger(companyId, map.purchaseGoodsLedgerId)
    : null;
  const expenses = map.purchaseExpensesLedgerId
    ? await ledger(companyId, map.purchaseExpensesLedgerId)
    : null;
  const goodsAmount =
    bill.lines
      .filter((l: any) => l.type === "product")
      .reduce((s: number, l: any) => s + l.taxablePaise, 0) +
    bill.additionalExpensesPaise;
  const expenseAmount = bill.lines
    .filter((l: any) => l.type === "service")
    .reduce((s: number, l: any) => s + l.taxablePaise, 0);
  if (goodsAmount && !goods) fail("Purchase Goods mapping is missing");
  if (expenseAmount && !expenses) fail("Purchase Expenses mapping is missing");
  if (goodsAmount)
    lines.push(line(goods._id, goodsAmount, 0, "Purchase goods"));
  if (expenseAmount)
    lines.push(line(expenses._id, expenseAmount, 0, "Purchase expenses"));
  const gst = { cgst: 0, sgst: 0, igst: 0 };
  for (const item of bill.lines) {
    gst.cgst += item.cgstPaise || 0;
    gst.sgst += item.sgstPaise || 0;
    gst.igst += item.igstPaise || 0;
  }
  if (gst.cgst) {
    if (!map.inputCgstLedgerId) fail("Input CGST mapping is missing");
    lines.push(line(map.inputCgstLedgerId, gst.cgst, 0, "Input CGST"));
  }
  if (gst.sgst) {
    if (!map.inputSgstLedgerId) fail("Input SGST mapping is missing");
    lines.push(line(map.inputSgstLedgerId, gst.sgst, 0, "Input SGST"));
  }
  if (gst.igst) {
    if (!map.inputIgstLedgerId) fail("Input IGST mapping is missing");
    lines.push(line(map.inputIgstLedgerId, gst.igst, 0, "Input IGST"));
  }
  return lines;
}
async function createAndPost(
  req: AuthRequest,
  data: any,
  sourceType: string,
  sourceId: any,
  amountPaise: number,
  lines: any[],
  afterPost?: (session: any, voucher: any) => Promise<void>,
  suppliedSession?: mongoose.ClientSession,
) {
  const run = async (session: mongoose.ClientSession) => {
    const existing: any = await PurchaseAccountingSource.findOne({
      companyId: data.companyId,
      sourceType,
      sourceId,
    })
      .populate("voucherId")
      .session(session)
      .lean();
    if (existing) return existing.voucherId;
    const created: any[] = await AccountingVoucher.create(
      [
        {
          ...data,
          voucherType: data.voucherType || "journal",
          status: "approved",
          lines,
          totalDebitPaise: amountPaise,
          totalCreditPaise: amountPaise,
          sourceType,
          sourceId,
          sourceFingerprint: `purchase:${sourceType}:${data.companyId}:${sourceId}`,
          createdBy: uid(req),
          updatedBy: uid(req),
          approvedBy: uid(req),
          approvedAt: new Date(),
        },
      ],
      { session },
    );
    const voucher: any = await postVoucherInSession(
      String(created[0]._id),
      uid(req),
      session,
      async (postingSession, posted) => {
        await PurchaseAccountingSource.create(
          [
            {
              companyId: data.companyId,
              financialYearId: data.financialYearId,
              sourceType,
              sourceId,
              voucherId: posted._id,
              amountPaise,
              createdBy: uid(req),
            },
          ],
          { session: postingSession },
        );
        if (afterPost) await afterPost(postingSession, posted);
      },
    );
    return voucher;
  };
  if (suppliedSession) return run(suppliedSession);
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      result = await run(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function reserveBillSettlement(
  session: mongoose.ClientSession,
  billId: any,
  amountPaise: number,
) {
  const updated = await PurchaseBill.findOneAndUpdate(
    {
      _id: billId,
      status: "posted",
      $expr: {
        $lte: [
          { $add: [{ $ifNull: ["$settledPaise", 0] }, amountPaise] },
          "$grandTotalPaise",
        ],
      },
    },
    [
      {
        $set: {
          settledPaise: {
            $add: [{ $ifNull: ["$settledPaise", 0] }, amountPaise],
          },
        },
      },
    ],
    { new: true, session },
  );
  if (!updated)
    fail("Payment or advance allocation would over-settle the purchase bill");
  return updated;
}
async function reserveAdvance(
  session: mongoose.ClientSession,
  advanceId: any,
  amountPaise: number,
) {
  const updated = await SupplierAdvance.findOneAndUpdate(
    {
      _id: advanceId,
      status: "posted",
      $expr: {
        $lte: [
          { $add: [{ $ifNull: ["$allocatedPaise", 0] }, amountPaise] },
          "$amountPaise",
        ],
      },
    },
    [
      {
        $set: {
          allocatedPaise: {
            $add: [{ $ifNull: ["$allocatedPaise", 0] }, amountPaise],
          },
        },
      },
    ],
    { new: true, session },
  );
  if (!updated) fail("Supplier advance allocation exceeds available balance");
  return updated;
}

export function registerPurchaseAccountingRoutes(app: Express) {
  app.get(
    "/api/accounting/purchase/suppliers",
    requireAuth,
    requirePermission("suppliers", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = String(
          req.query.companyId || request.session.accountingCompanyId || "",
        );
        await company(request, companyId);
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
        const query: any = { companyId };
        if (req.query.search)
          query.$or = [
            { name: new RegExp(String(req.query.search), "i") },
            { supplierCode: new RegExp(String(req.query.search), "i") },
          ];
        if (req.query.status) query.status = req.query.status;
        const [items, total] = await Promise.all([
          Supplier.find(query)
            .sort({ name: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          Supplier.countDocuments(query),
        ]);
        res.json({ items, total, page, limit });
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/purchase/suppliers",
    requireAuth,
    requirePermission("suppliers", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data: any = supplierSchema.parse(req.body);
        await company(request, data.companyId);
        if (data.ledgerAccountId) {
          const linked: any = await ledger(
            data.companyId,
            data.ledgerAccountId,
            ["supplier"],
          );
          data.ledgerAccountId = linked._id;
        }
        const created = await Supplier.create({
          ...data,
          createdBy: uid(request),
        });
        await audit(
          request,
          data.companyId,
          "Supplier",
          created._id,
          "created",
        );
        res.status(201).json(created);
      } catch (e: any) {
        res
          .status(e?.code === 11000 ? 409 : 400)
          .json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/purchase/suppliers/:id",
    requireAuth,
    requirePermission("suppliers", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const item: any = await Supplier.findById(req.params.id).lean();
        if (
          !item ||
          !(await getCompanyForUser(request, String(item.companyId)))
        )
          return res.status(404).json({ error: "Supplier not found" });
        res.json(item);
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.patch(
    "/api/accounting/purchase/suppliers/:id",
    requireAuth,
    requirePermission("suppliers", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const current: any = await Supplier.findById(req.params.id);
        if (
          !current ||
          !(await getCompanyForUser(request, String(current.companyId)))
        )
          return res.status(404).json({ error: "Supplier not found" });
        const data: any = supplierSchema
          .partial()
          .omit({ companyId: true })
          .parse(req.body);
        if (data.ledgerAccountId)
          await ledger(String(current.companyId), data.ledgerAccountId, [
            "supplier",
          ]);
        Object.assign(current, data, { updatedBy: uid(request) });
        await current.save();
        await audit(
          request,
          String(current.companyId),
          "Supplier",
          current._id,
          "updated",
        );
        res.json(current);
      } catch (e: any) {
        res
          .status(e?.code === 11000 ? 409 : 400)
          .json({ error: errorMessage(e) });
      }
    },
  );
  app.put(
    "/api/accounting/purchase-mappings",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data: any = purchaseMappingSchema.parse(req.body);
        await company(request, data.companyId);
        await validateMapping(data.companyId, data);
        const saved = await PurchaseAccountingMapping.findOneAndUpdate(
          { companyId: data.companyId },
          { $set: { ...data, updatedBy: uid(request) } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        await audit(
          request,
          data.companyId,
          "PurchaseAccountingMapping",
          saved._id,
          "updated",
          undefined,
          { fields: mappingFields.filter((field) => data[field]) },
        );
        res.json(saved);
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/purchase-mappings",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = String(
          req.query.companyId || request.session.accountingCompanyId || "",
        );
        await company(request, companyId);
        const value = await PurchaseAccountingMapping.findOne({ companyId })
          .populate(mappingFields.join(" "))
          .lean();
        res.json({
          companyId,
          mapping: value,
          requiredFields: mappingFields,
          missingFields: mappingFields.filter(
            (field) => !(value as any)?.[field],
          ),
        });
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );

  app.get(
    "/api/accounting/purchase/bills",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = String(
          req.query.companyId || request.session.accountingCompanyId || "",
        );
        await company(request, companyId);
        const query: any = { companyId };
        if (req.query.financialYearId) {
          const financialYearId = String(req.query.financialYearId);
          if (!(await ensureFinancialYear(request, companyId, financialYearId)))
            fail("Invalid financial year context");
          query.financialYearId = financialYearId;
        }
        if (req.query.status) query.status = req.query.status;
        if (req.query.supplierId) query.supplierId = req.query.supplierId;
        if (req.query.search) {
          const search = String(req.query.search).trim();
          if (search)
            query.$or = [
              { internalBillNumber: { $regex: search, $options: "i" } },
              { supplierInvoiceNumber: { $regex: search, $options: "i" } },
            ];
        }
        if (req.query.fromDate || req.query.toDate) {
          query.supplierInvoiceDate = {};
          if (req.query.fromDate)
            query.supplierInvoiceDate.$gte = date(String(req.query.fromDate));
          if (req.query.toDate) {
            const end = date(String(req.query.toDate));
            end.setUTCDate(end.getUTCDate() + 1);
            query.supplierInvoiceDate.$lt = end;
          }
        }
        const bills: any[] = await PurchaseBill.find(query)
          .populate("supplierId", "supplierCode name")
          .sort({ supplierInvoiceDate: -1 })
          .limit(200)
          .lean();
        const ids = bills.map((item) => item._id);
        const sources: any[] = await PurchaseAccountingSource.find({
          companyId,
          sourceType: "purchase_bill",
          sourceId: { $in: ids },
        })
          .populate(
            "voucherId",
            "voucherNumber status totalDebitPaise totalCreditPaise",
          )
          .lean();
        const sourceByBill = new Map(
          sources.map((item) => [String(item.sourceId), item]),
        );
        const items = bills.map((bill) => {
          const source: any = sourceByBill.get(String(bill._id));
          const voucher: any = source?.voucherId;
          const missingVoucher = !source;
          const amountMismatch = Boolean(
            source && source.amountPaise !== bill.grandTotalPaise,
          );
          const balanceMismatch = Boolean(
            voucher && voucher.totalDebitPaise !== voucher.totalCreditPaise,
          );
          const reconciliationStatus = ["draft", "pending_approval"].includes(
            bill.status,
          )
            ? "not_posted"
            : missingVoucher
              ? "missing_voucher"
              : amountMismatch || balanceMismatch
                ? "mismatch"
                : "matched";
          return { ...bill, reconciliationStatus };
        });
        const status = req.query.reconciliationStatus
          ? String(req.query.reconciliationStatus)
          : "";
        res.json(
          status
            ? items.filter((item) => item.reconciliationStatus === status)
            : items,
        );
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/purchase/bills",
    requireAuth,
    requirePermission("accounting", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data: any = purchaseBillSchema.parse(req.body);
        await context(
          request,
          data.companyId,
          data.financialYearId,
          date(data.supplierInvoiceDate),
        );
        await supplier(data.companyId, data.supplierId);
        await billAmounts(data);
        const created = await PurchaseBill.create({
          ...data,
          supplierInvoiceDate: date(data.supplierInvoiceDate),
          dueDate: data.dueDate ? date(data.dueDate) : undefined,
          createdBy: uid(request),
        });
        await audit(
          request,
          data.companyId,
          "PurchaseBill",
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
  app.patch(
    "/api/accounting/purchase/bills/:id",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const bill: any = await PurchaseBill.findById(req.params.id);
        if (
          !bill ||
          !(await getCompanyForUser(request, String(bill.companyId)))
        )
          return res.status(404).json({ error: "Purchase bill not found" });
        if (!["draft", "pending_approval"].includes(bill.status))
          fail("Only draft or pending approval bills can be edited");
        const data: any = purchaseBillSchema
          .partial()
          .omit({ companyId: true, financialYearId: true })
          .parse(req.body);
        Object.assign(bill, data, {
          supplierInvoiceDate: data.supplierInvoiceDate
            ? date(data.supplierInvoiceDate)
            : bill.supplierInvoiceDate,
          dueDate: data.dueDate ? date(data.dueDate) : bill.dueDate,
          updatedBy: uid(request),
        });
        await billAmounts(bill);
        await bill.save();
        res.json(bill);
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/purchase/bills/:id/status",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const { status } = purchaseStatusSchema.parse(req.body);
        const bill: any = await PurchaseBill.findById(req.params.id);
        if (
          !bill ||
          !(await getCompanyForUser(request, String(bill.companyId)))
        )
          return res.status(404).json({ error: "Purchase bill not found" });
        if (status === "approved" && bill.status !== "pending_approval")
          fail("Only pending approval bills can be approved");
        if (status === "pending_approval" && bill.status !== "draft")
          fail("Only draft bills can be submitted");
        bill.status = status;
        if (status === "approved") {
          bill.approvedBy = uid(request);
          bill.approvedAt = new Date();
        }
        bill.updatedBy = uid(request);
        await bill.save();
        res.json(bill);
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );

  app.get(
    "/api/accounting/purchase/bills/:id/preview",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const bill: any = await PurchaseBill.findById(req.params.id).lean();
        if (
          !bill ||
          !(await getCompanyForUser(request, String(bill.companyId)))
        )
          return res.status(404).json({ error: "Purchase bill not found" });
        if (!["approved", "posted"].includes(bill.status))
          fail("Only approved purchase bills can be previewed");
        const map: any = await mapping(String(bill.companyId));
        const supplierPayable = await supplierLedger(
          String(bill.companyId),
          String(bill.supplierId),
        );
        const lines = await purchaseLines(String(bill.companyId), bill, map);
        lines.push(
          line(
            supplierPayable._id,
            0,
            bill.grandTotalPaise,
            "Supplier payable",
          ),
        );
        res.json({
          bill,
          lines,
          totalDebitPaise: bill.grandTotalPaise,
          totalCreditPaise: bill.grandTotalPaise,
        });
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/purchase/bills/:id/post",
    requireAuth,
    requirePermission("accounting", "post"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const bill: any = await PurchaseBill.findById(req.params.id).lean();
        if (
          !bill ||
          bill.status !== "approved" ||
          !(await getCompanyForUser(request, String(bill.companyId)))
        )
          fail("Approved purchase bill with authorized company is required");
        await context(
          request,
          String(bill.companyId),
          String(bill.financialYearId),
          new Date(bill.supplierInvoiceDate),
        );
        await billAmounts(bill);
        const map: any = await mapping(String(bill.companyId));
        const supplierPayable = await supplierLedger(
          String(bill.companyId),
          String(bill.supplierId),
        );
        const lines = await purchaseLines(String(bill.companyId), bill, map);
        lines.push(
          line(
            supplierPayable._id,
            0,
            bill.grandTotalPaise,
            "Supplier payable",
          ),
        );
        const session = await mongoose.startSession();
        let voucher: any;
        try {
          await session.withTransaction(async () => {
            const ctx = await context(
              request,
              String(bill.companyId),
              String(bill.financialYearId),
              new Date(bill.supplierInvoiceDate),
            );
            voucher = await createAndPost(
              request,
              {
                companyId: bill.companyId,
                financialYearId: bill.financialYearId,
                accountingPeriodId: ctx.period._id,
                voucherDate: bill.supplierInvoiceDate,
                narration: `Purchase bill ${bill.internalBillNumber}`,
                referenceNumber: bill.supplierInvoiceNumber,
              },
              "purchase_bill",
              bill._id,
              bill.grandTotalPaise,
              lines,
              undefined,
              session,
            );
            await PurchaseBill.updateOne(
              { _id: bill._id, status: "approved" },
              {
                $set: {
                  status: "posted",
                  postedVoucherId: voucher._id,
                  updatedBy: uid(request),
                },
              },
              { session },
            );
          });
        } finally {
          await session.endSession();
        }
        res.json(voucher);
      } catch (e) {
        res.status(409).json({ error: errorMessage(e) });
      }
    },
  );

  app.post(
    "/api/accounting/purchase/payments",
    requireAuth,
    requirePermission("accounting", "post"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data: any = supplierPaymentSchema.parse(req.body);
        await context(
          request,
          data.companyId,
          data.financialYearId,
          date(data.paymentDate),
        );
        const s = await supplier(data.companyId, data.supplierId);
        const payable = await supplierLedger(data.companyId, data.supplierId);
        const totalAllocated = paymentAllocationTotal(data.allocations);
        if (totalAllocated > data.amountPaise)
          fail("Payment allocations exceed payment amount");
        const existingPayment: any = await SupplierPayment.findOne({
          companyId: data.companyId,
          idempotencyKey: data.idempotencyKey,
        }).lean();
        if (existingPayment?.voucherId)
          return res.json({
            payment: existingPayment,
            voucher: await AccountingVoucher.findById(
              existingPayment.voucherId,
            ).lean(),
          });
        const session = await mongoose.startSession();
        let result: any;
        try {
          await session.withTransaction(async () => {
            for (const allocation of data.allocations) {
              const bill: any = await PurchaseBill.findOne({
                _id: allocation.purchaseBillId,
                companyId: data.companyId,
                supplierId: s._id,
                status: "posted",
              })
                .session(session)
                .lean();
              if (!bill) fail("Payment allocation bill is invalid");
              await reserveBillSettlement(
                session,
                bill._id,
                allocation.amountPaise,
              );
            }
            const payment: any = (
              await SupplierPayment.create(
                [
                  {
                    ...data,
                    paymentDate: date(data.paymentDate),
                    status: "recorded",
                    createdBy: uid(request),
                  },
                ],
                { session },
              )
            )[0];
            const map: any = await mapping(data.companyId);
            const paymentFields: Record<string, string> = {
              Cash: "cashLedgerId",
              "Bank Transfer": "bankLedgerId",
              UPI: "upiClearingLedgerId",
              Card: "cardClearingLedgerId",
              Cheque: "chequeClearingLedgerId",
            };
            const field = paymentFields[data.paymentMode];
            if (!map[field])
              fail(`Payment mapping is missing for ${data.paymentMode}`);
            const settlement = await ledger(data.companyId, map[field]);
            const ctx = await context(
              request,
              data.companyId,
              data.financialYearId,
              date(data.paymentDate),
            );
            const voucher = await createAndPost(
              request,
              {
                companyId: data.companyId,
                financialYearId: data.financialYearId,
                accountingPeriodId: ctx.period._id,
                voucherDate: date(data.paymentDate),
                voucherType: "payment",
                paymentMode:
                  data.paymentMode === "Bank Transfer"
                    ? "Bank Transfer"
                    : data.paymentMode,
                narration: `Payment to supplier ${s.name}`,
                referenceNumber: data.transactionReference,
              },
              "supplier_payment",
              payment._id,
              data.amountPaise,
              [
                line(payable._id, data.amountPaise, 0, "Supplier payable"),
                line(settlement._id, 0, data.amountPaise, "Payment settlement"),
              ],
              undefined,
              session,
            );
            await SupplierPayment.updateOne(
              { _id: payment._id },
              { $set: { status: "posted", voucherId: voucher._id } },
              { session },
            );
            result = {
              payment: await SupplierPayment.findById(payment._id)
                .session(session)
                .lean(),
              voucher,
            };
          });
        } finally {
          await session.endSession();
        }
        res.status(201).json(result);
      } catch (e) {
        res.status(409).json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/purchase/payments",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = String(
          req.query.companyId || request.session.accountingCompanyId || "",
        );
        await company(request, companyId);
        res.json(
          await SupplierPayment.find({ companyId })
            .populate("supplierId", "supplierCode name")
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
    "/api/accounting/purchase/advances",
    requireAuth,
    requirePermission("accounting", "post"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data: any = supplierAdvanceSchema.parse(req.body);
        const existingAdvance: any = await SupplierAdvance.findOne({
          companyId: data.companyId,
          idempotencyKey: data.idempotencyKey,
        }).lean();
        if (existingAdvance?.voucherId)
          return res.json({
            advance: existingAdvance,
            voucher: await AccountingVoucher.findById(
              existingAdvance.voucherId,
            ).lean(),
          });
        const s = await supplier(data.companyId, data.supplierId);
        const map: any = await mapping(data.companyId);
        if (!map.supplierAdvancesLedgerId)
          fail("Supplier Advances mapping is missing");
        const advanceLedger = await ledger(
          data.companyId,
          map.supplierAdvancesLedgerId,
        );
        const paymentFields: Record<string, string> = {
          Cash: "cashLedgerId",
          "Bank Transfer": "bankLedgerId",
          UPI: "upiClearingLedgerId",
          Card: "cardClearingLedgerId",
          Cheque: "chequeClearingLedgerId",
        };
        const field = paymentFields[data.paymentMode];
        if (!map[field])
          fail(`Payment mapping is missing for ${data.paymentMode}`);
        const settlement = await ledger(data.companyId, map[field]);
        const ctx = await context(
          request,
          data.companyId,
          data.financialYearId,
          date(data.receivedDate),
        );
        const session = await mongoose.startSession();
        let result: any;
        try {
          await session.withTransaction(async () => {
            const advance: any = (
              await SupplierAdvance.create(
                [
                  {
                    ...data,
                    receivedDate: date(data.receivedDate),
                    status: "recorded",
                    createdBy: uid(request),
                  },
                ],
                { session },
              )
            )[0];
            const voucher = await createAndPost(
              request,
              {
                companyId: data.companyId,
                financialYearId: data.financialYearId,
                accountingPeriodId: ctx.period._id,
                voucherDate: date(data.receivedDate),
                voucherType: "payment",
                paymentMode:
                  data.paymentMode === "Bank Transfer"
                    ? "Bank Transfer"
                    : data.paymentMode,
                narration: `Supplier advance ${s.name}`,
                referenceNumber: data.transactionReference,
              },
              "supplier_advance",
              advance._id,
              data.amountPaise,
              [
                line(
                  advanceLedger._id,
                  data.amountPaise,
                  0,
                  "Supplier advances",
                ),
                line(settlement._id, 0, data.amountPaise, "Payment settlement"),
              ],
              undefined,
              session,
            );
            await SupplierAdvance.updateOne(
              { _id: advance._id },
              { $set: { status: "posted", voucherId: voucher._id } },
              { session },
            );
            result = {
              advance: await SupplierAdvance.findById(advance._id)
                .session(session)
                .lean(),
              voucher,
            };
          });
        } finally {
          await session.endSession();
        }
        res.status(201).json(result);
      } catch (e) {
        res.status(409).json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/purchase/advances",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = String(
          req.query.companyId || request.session.accountingCompanyId || "",
        );
        await company(request, companyId);
        const items: any[] = await SupplierAdvance.find({ companyId })
          .populate("supplierId", "supplierCode name")
          .sort({ createdAt: -1 })
          .limit(200)
          .lean();
        const allocations = await SupplierAdvanceAllocation.find({
          companyId,
          status: "confirmed",
        }).lean();
        res.json(
          items.map((item) => ({
            ...item,
            allocatedPaise: allocations
              .filter((a) => String(a.advanceId) === String(item._id))
              .reduce((sum, a) => sum + a.amountPaise, 0),
          })),
        );
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/purchase/advances/:id/allocate",
    requireAuth,
    requirePermission("accounting", "post"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data: any = supplierAdvanceAllocationSchema.parse(req.body);
        const advance: any = await SupplierAdvance.findById(
          req.params.id,
        ).lean();
        const bill: any = await PurchaseBill.findById(
          data.purchaseBillId,
        ).lean();
        if (
          !advance ||
          advance.status !== "posted" ||
          !bill ||
          bill.status !== "posted" ||
          String(advance.companyId) !== String(bill.companyId) ||
          String(advance.supplierId) !== String(bill.supplierId)
        )
          fail("Posted advance and purchase bill ownership do not match");
        const duplicate = await SupplierAdvanceAllocation.findOne({
          advanceId: advance._id,
          purchaseBillId: bill._id,
        });
        if (duplicate)
          fail("This supplier advance is already allocated to this bill");
        const map: any = await mapping(String(advance.companyId));
        if (!map.supplierAdvancesLedgerId)
          fail("Supplier Advances mapping is missing");
        const payable = await supplierLedger(
          String(advance.companyId),
          String(bill.supplierId),
        );
        const ctx = await context(
          request,
          String(advance.companyId),
          String(advance.financialYearId),
          new Date(),
        );
        const session = await mongoose.startSession();
        let result: any;
        try {
          await session.withTransaction(async () => {
            await reserveAdvance(session, advance._id, data.amountPaise);
            await reserveBillSettlement(session, bill._id, data.amountPaise);
            const allocation: any = (
              await SupplierAdvanceAllocation.create(
                [
                  {
                    companyId: advance.companyId,
                    financialYearId: advance.financialYearId,
                    advanceId: advance._id,
                    purchaseBillId: bill._id,
                    amountPaise: data.amountPaise,
                    createdBy: uid(request),
                  },
                ],
                { session },
              )
            )[0];
            const voucher = await createAndPost(
              request,
              {
                companyId: advance.companyId,
                financialYearId: advance.financialYearId,
                accountingPeriodId: ctx.period._id,
                voucherDate: new Date(),
                narration: `Supplier advance allocation to ${bill.internalBillNumber}`,
              },
              "advance_allocation",
              allocation._id,
              data.amountPaise,
              [
                line(payable._id, data.amountPaise, 0, "Supplier payable"),
                line(
                  map.supplierAdvancesLedgerId,
                  0,
                  data.amountPaise,
                  "Supplier advances",
                ),
              ],
              undefined,
              session,
            );
            await SupplierAdvanceAllocation.updateOne(
              { _id: allocation._id },
              { $set: { status: "confirmed", voucherId: voucher._id } },
              { session },
            );
            result = {
              allocation: await SupplierAdvanceAllocation.findById(
                allocation._id,
              )
                .session(session)
                .lean(),
              voucher,
            };
          });
        } finally {
          await session.endSession();
        }
        res.status(201).json(result);
      } catch (e) {
        res.status(409).json({ error: errorMessage(e) });
      }
    },
  );

  app.post(
    "/api/accounting/purchase/returns",
    requireAuth,
    requirePermission("accounting", "post"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data: any = purchaseReturnSchema.parse(req.body);
        const bill: any = await PurchaseBill.findOne({
          _id: data.purchaseBillId,
          companyId: data.companyId,
          supplierId: data.supplierId,
          status: "posted",
        }).lean();
        if (!bill) fail("Posted purchase bill is required");
        const existing: any = await PurchaseReturn.findOne({
          companyId: data.companyId,
          purchaseBillId: data.purchaseBillId,
          status: { $in: ["posted", "approved"] },
        }).lean();
        if (existing) fail("A purchase return already exists for this bill");
        const ctx = await context(
          request,
          data.companyId,
          data.financialYearId,
          new Date(),
        );
        const map: any = await mapping(data.companyId);
        if (!map.purchaseReturnsLedgerId)
          fail("Purchase Returns mapping is missing");
        const returnLedger = await ledger(
          data.companyId,
          map.purchaseReturnsLedgerId,
        );
        const payable = await supplierLedger(data.companyId, data.supplierId);
        const lines = [
          line(payable._id, data.amountPaise, 0, "Supplier payable reduced"),
          line(
            returnLedger._id,
            0,
            data.amountPaise - data.taxAmountPaise,
            "Purchase returns",
          ),
        ];
        if (data.taxAmountPaise) {
          if (
            !map.inputCgstLedgerId &&
            !map.inputSgstLedgerId &&
            !map.inputIgstLedgerId
          )
            fail("Input GST mapping is missing for a GST purchase return");
          fail(
            "Purchase return GST split must be explicitly classified before posting",
          );
        }
        const session = await mongoose.startSession();
        let result: any;
        try {
          await session.withTransaction(async () => {
            const ret: any = (
              await PurchaseReturn.create(
                [{ ...data, status: "approved", createdBy: uid(request) }],
                { session },
              )
            )[0];
            const voucher = await createAndPost(
              request,
              {
                companyId: data.companyId,
                financialYearId: data.financialYearId,
                accountingPeriodId: ctx.period._id,
                voucherDate: ctx.period.startDate,
                narration: `Purchase return ${data.returnNumber}`,
                referenceNumber: data.returnNumber,
              },
              "purchase_return",
              ret._id,
              data.amountPaise,
              lines,
              undefined,
              session,
            );
            await PurchaseReturn.updateOne(
              { _id: ret._id },
              { $set: { status: "posted", voucherId: voucher._id } },
              { session },
            );
            result = {
              return: await PurchaseReturn.findById(ret._id)
                .session(session)
                .lean(),
              voucher,
            };
          });
        } finally {
          await session.endSession();
        }
        res.status(201).json(result);
      } catch (e) {
        res.status(409).json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/purchase/returns",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = String(
          req.query.companyId || request.session.accountingCompanyId || "",
        );
        await company(request, companyId);
        res.json(
          await PurchaseReturn.find({ companyId })
            .populate("supplierId", "supplierCode name")
            .populate(
              "purchaseBillId",
              "internalBillNumber supplierInvoiceNumber",
            )
            .sort({ createdAt: -1 })
            .limit(200)
            .lean(),
        );
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );

  app.get(
    "/api/accounting/purchase/suppliers/:supplierId/ledger",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = String(request.session.accountingCompanyId || "");
        if (!companyId) fail("Accounting company context is required");
        const financialYearId = String(
          req.query.financialYearId ||
            request.session.accountingFinancialYearId ||
            "",
        );
        await company(request, companyId);
        if (
          financialYearId &&
          !(await ensureFinancialYear(request, companyId, financialYearId))
        )
          fail("Invalid financial year context");
        const s: any = await supplierLedger(companyId, req.params.supplierId);
        const query: any = {
          companyId,
          status: { $in: ["posted", "reversed"] },
          "lines.ledgerAccountId": s._id,
        };
        if (financialYearId) query.financialYearId = financialYearId;
        const vouchers: any[] = await AccountingVoucher.find(query)
          .sort({ voucherDate: 1, voucherNumber: 1 })
          .lean();
        let balance = 0;
        const items: any[] = [];
        for (const voucher of vouchers)
          for (const item of voucher.lines)
            if (String(item.ledgerAccountId) === String(s._id)) {
              balance += item.debitPaise - item.creditPaise;
              items.push({
                voucherId: voucher._id,
                voucherNumber: voucher.voucherNumber,
                date: voucher.voucherDate,
                narration: voucher.narration,
                debitPaise: item.debitPaise,
                creditPaise: item.creditPaise,
                runningBalancePaise: balance,
                referenceNumber: voucher.referenceNumber,
              });
            }
        res.json({
          supplierId: req.params.supplierId,
          companyId,
          financialYearId,
          items,
          balancePaise: balance,
        });
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/purchase/reconciliation/bills/:id",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const bill: any = await PurchaseBill.findById(req.params.id).lean();
        if (
          !bill ||
          !(await getCompanyForUser(request, String(bill.companyId)))
        )
          return res.status(404).json({ error: "Purchase bill not found" });
        const source: any = await PurchaseAccountingSource.findOne({
          companyId: bill.companyId,
          sourceType: "purchase_bill",
          sourceId: bill._id,
        })
          .populate(
            "voucherId",
            "voucherNumber status totalDebitPaise totalCreditPaise",
          )
          .lean();
        const allocations: any[] = await SupplierAdvanceAllocation.find({
          companyId: bill.companyId,
          purchaseBillId: bill._id,
          status: "confirmed",
        }).lean();
        const payments: any[] = await SupplierPayment.find({
          companyId: bill.companyId,
          supplierId: bill.supplierId,
          status: "posted",
          "allocations.purchaseBillId": bill._id,
        }).lean();
        const paymentVoucherIds = payments
          .map((item) => item.voucherId)
          .filter(Boolean);
        const paymentVouchers: any[] = await AccountingVoucher.find({
          _id: { $in: paymentVoucherIds },
          companyId: bill.companyId,
        })
          .select(
            "voucherNumber status totalDebitPaise totalCreditPaise voucherDate referenceNumber narration",
          )
          .lean();
        const voucherById = new Map(
          paymentVouchers.map((item) => [String(item._id), item]),
        );
        const supplierPayments = payments.flatMap((payment) =>
          payment.allocations
            .filter(
              (item: any) => String(item.purchaseBillId) === String(bill._id),
            )
            .map((item: any) => ({
              paymentId: payment._id,
              amountPaise: payment.amountPaise,
              allocatedAmountPaise: item.amountPaise,
              paymentMode: payment.paymentMode,
              paymentDate: payment.paymentDate,
              transactionReference: payment.transactionReference,
              voucher: payment.voucherId
                ? voucherById.get(String(payment.voucherId)) || null
                : null,
            })),
        );
        const paymentTotalPaise = supplierPayments.reduce(
          (sum, item) => sum + Number(item.allocatedAmountPaise || 0),
          0,
        );
        const confirmedAdvanceAllocationPaise = allocations.reduce(
          (sum, item) => sum + Number(item.amountPaise || 0),
          0,
        );
        const outstandingPaise = Math.max(
          0,
          Number(bill.grandTotalPaise) -
            paymentTotalPaise -
            confirmedAdvanceAllocationPaise,
        );
        const voucherAmountMismatch = Boolean(
          source && Number(source.amountPaise) !== Number(bill.grandTotalPaise),
        );
        const voucherBalanceMismatch = Boolean(
          source?.voucherId &&
            source.voucherId.totalDebitPaise !==
              source.voucherId.totalCreditPaise,
        );
        const duplicatePostingCount = await AccountingVoucher.countDocuments({
          companyId: bill.companyId,
          sourceType: "purchase_bill",
          sourceId: bill._id,
        });
        const allocationVoucherMissing = allocations.some(
          (item) => !item.voucherId,
        );
        const missingVoucher = !source;
        const reconciliationStatus = ["draft", "pending_approval"].includes(
          bill.status,
        )
          ? "not_posted"
          : missingVoucher
            ? "missing_voucher"
            : duplicatePostingCount > 1
              ? "duplicate"
              : voucherAmountMismatch ||
                  voucherBalanceMismatch ||
                  allocationVoucherMissing
                ? "mismatch"
                : outstandingPaise === 0
                  ? "reconciled"
                  : "outstanding";
        res.json({
          billId: bill._id,
          grandTotalPaise: bill.grandTotalPaise,
          postedPurchaseVoucherAmountPaise: source?.amountPaise || 0,
          source: source || null,
          confirmedAdvanceAllocationPaise,
          supplierPayments,
          paymentTotalPaise,
          outstandingPaise,
          duplicatePostingCount,
          reconciliationStatus,
          allocations,
          mismatches: {
            missingVoucher,
            voucherAmountMismatch,
            voucherBalanceMismatch,
            duplicatePosting: duplicatePostingCount > 1,
            allocationVoucherMissing,
          },
        });
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
}
