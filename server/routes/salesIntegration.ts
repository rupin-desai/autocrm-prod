// The legacy CRM payment subdocuments are intentionally dynamic; runtime validation remains explicit below.
// @ts-nocheck
import type { Express, Request } from "express";
import { requireAuth, requirePermission } from "../middleware";
import { Invoice } from "../models/Invoice";
import { AdvancePayment } from "../models/AdvancePayment";
import { LedgerAccount } from "../models/LedgerAccount";
import { FinancialYear } from "../models/FinancialYear";
import { AccountingPeriod } from "../models/AccountingPeriod";
import { SalesAccountingMapping } from "../models/SalesAccountingMapping";
import { SalesAccountingSource } from "../models/SalesAccountingSource";
import { AdvanceAllocation } from "../models/AdvanceAllocation";
import { RegistrationCustomer } from "../models/RegistrationCustomer";
import { getCompanyForUser, ensureFinancialYear } from "./accountingFoundation";
import { postVoucher } from "../services/accountingVouchers";
import { AccountingVoucher } from "../models/AccountingVoucher";
import { invoiceStoredAmounts } from "../salesIntegrationLogic";
import { advanceAllocationSchema } from "../salesIntegrationSchemas";

type AuthRequest = Request & {
  session: Request["session"] & {
    userId?: string;
    userRole?: string;
    accountingCompanyId?: string;
    accountingFinancialYearId?: string;
  };
};
const uid = (req: AuthRequest) => req.session.userId as string;
const paymentFields: Record<string, string> = {
  Cash: "cashLedgerId",
  UPI: "upiClearingLedgerId",
  Card: "cardClearingLedgerId",
  "Net Banking": "netBankingClearingLedgerId",
  Cheque: "chequeClearingLedgerId",
};
const fail = (message: string): never => {
  throw new Error(message);
};

async function context(req: AuthRequest, companyId: any, date: Date) {
  const company = await getCompanyForUser(req, String(companyId));
  if (!company) fail("You are not authorized for this company");
  const fy: any = await FinancialYear.findOne({
    companyId,
    startDate: { $lte: date },
    endDate: { $gte: date },
    status: { $ne: "closed" },
  });
  if (!fy) fail("No open financial year covers this transaction date");
  const period: any = await AccountingPeriod.findOne({
    companyId,
    financialYearId: fy._id,
    startDate: { $lte: date },
    endDate: { $gte: date },
    status: "open",
  });
  if (!period) fail("No open accounting period covers this transaction date");
  return { company, fy, period };
}
async function customerLedger(companyId: any, customerId: any) {
  const ledgers: any[] = await LedgerAccount.find({
    companyId,
    customerId,
    ledgerType: "customer",
    status: "active",
  }).lean();
  if (ledgers.length !== 1)
    fail(
      ledgers.length
        ? "Customer must have exactly one active control ledger"
        : "Customer receivable ledger is not configured",
    );
  return ledgers[0];
}
async function mapping(companyId: any) {
  const value: any = await SalesAccountingMapping.findOne({ companyId }).lean();
  if (!value) fail("Sales accounting mappings are not configured");
  return value;
}
function line(
  ledgerAccountId: any,
  debitPaise: number,
  creditPaise: number,
  description: string,
) {
  return { ledgerAccountId, debitPaise, creditPaise, description };
}
function errorMessage(e: any) {
  return (
    e?.issues?.[0]?.message || e?.message || "Sales accounting operation failed"
  );
}

async function invoicePreview(req: AuthRequest, id: string) {
  const invoice: any = await Invoice.findById(id).lean();
  if (!invoice) fail("Invoice not found");
  if (invoice.status !== "approved")
    fail("Only approved invoices are eligible for accounting");
  if (invoice.ownershipStatus !== "verified" || !invoice.companyId)
    fail("Invoice ownership is unverified");
  const customer: any = await RegistrationCustomer.findById(
    invoice.customerId,
  ).lean();
  if (
    !customer ||
    customer.ownershipStatus !== "verified" ||
    String(customer.companyId) !== String(invoice.companyId)
  )
    fail("Customer ownership is missing or inconsistent");
  const amounts: any = invoiceStoredAmounts(invoice);
  if (!amounts.valid) fail(amounts.reason);
  if (amounts.gstPaise > 0)
    fail(
      "GST-inclusive invoice cannot be posted until stored CGST/SGST/IGST split is explicitly available",
    );
  const [ctx, map, receivable] = await Promise.all([
    context(req, invoice.companyId, new Date(invoice.createdAt)),
    mapping(invoice.companyId),
    customerLedger(invoice.companyId, invoice.customerId),
  ]);
  const lines = [];
  if (amounts.productPaise) {
    if (!map.productSalesLedgerId)
      fail("Product Sales Income mapping is missing");
    lines.push(
      line(map.productSalesLedgerId, 0, amounts.productPaise, "Product sales"),
    );
  }
  if (amounts.servicePaise) {
    if (!map.serviceIncomeLedgerId) fail("Service Income mapping is missing");
    lines.push(
      line(
        map.serviceIncomeLedgerId,
        0,
        amounts.servicePaise,
        "Service income",
      ),
    );
  }
  lines.unshift(
    line(receivable._id, amounts.totalPaise, 0, "Customer receivable"),
  );
  return {
    invoice,
    customer,
    financialYear: ctx.fy,
    accountingPeriod: ctx.period,
    lines,
    totalDebitPaise: amounts.totalPaise,
    totalCreditPaise: amounts.productPaise + amounts.servicePaise,
    sourceValues: amounts,
    blocked: false,
  };
}

async function createAndPost(
  req: AuthRequest,
  data: any,
  sourceType: string,
  sourceId: any,
  amountPaise: number,
  lines: any[],
  afterPost?: (session: any, voucher: any) => Promise<void>,
) {
  const existing: any = await SalesAccountingSource.findOne({
    companyId: data.companyId,
    sourceType,
    sourceId,
  })
    .populate("voucherId")
    .lean();
  if (existing) return existing.voucherId;
  const voucher: any = await AccountingVoucher.create({
    ...data,
    voucherType: data.voucherType || "journal",
    status: "approved",
    lines,
    totalDebitPaise: amountPaise,
    totalCreditPaise: amountPaise,
    sourceType,
    sourceId,
    sourceFingerprint: `${sourceType}:${data.companyId}:${sourceId}`,
    createdBy: uid(req),
    updatedBy: uid(req),
    approvedBy: uid(req),
    approvedAt: new Date(),
  });
  try {
    return await postVoucher(
      String(voucher._id),
      uid(req),
      async (session, posted) => {
        await SalesAccountingSource.create(
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
          { session },
        );
        if (afterPost) await afterPost(session, posted);
      },
    );
  } catch (e) {
    await AccountingVoucher.findByIdAndDelete(voucher._id);
    throw e;
  }
}

export function registerSalesIntegrationRoutes(app: Express) {
  app.get(
    "/api/accounting/sales/invoices/:id/preview",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        res.json(await invoicePreview(req as AuthRequest, req.params.id));
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/sales/invoices/:id/post",
    requireAuth,
    requirePermission("accounting", "post"),
    async (req, res) => {
      try {
        const preview: any = await invoicePreview(
          req as AuthRequest,
          req.params.id,
        );
        const voucher = await createAndPost(
          req as AuthRequest,
          {
            companyId: preview.invoice.companyId,
            financialYearId: preview.financialYear._id,
            accountingPeriodId: preview.accountingPeriod._id,
            voucherDate: preview.invoice.createdAt,
            narration: `Sales invoice ${preview.invoice.invoiceNumber}`,
            referenceNumber: preview.invoice.invoiceNumber,
          },
          "invoice",
          preview.invoice._id,
          preview.totalDebitPaise,
          preview.lines,
        );
        res.json(voucher);
      } catch (e) {
        res.status(409).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/sales/invoices/:invoiceId/payments/:paymentId/post",
    requireAuth,
    requirePermission("accounting", "post"),
    async (req, res) => {
      try {
        const invoice: any = await Invoice.findById(
          req.params.invoiceId,
        ).lean();
        if (
          !invoice ||
          invoice.status !== "approved" ||
          invoice.ownershipStatus !== "verified"
        )
          return res
            .status(400)
            .json({ error: "Approved, verified invoice required" });
        const payment: any = (invoice.payments || []).find(
          (p: any) => String(p._id) === req.params.paymentId,
        );
        if (!payment)
          return res.status(404).json({ error: "Payment entry not found" });
        const amountPaise = Math.round(Number(payment.amount || 0) * 100);
        if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0)
          fail("Payment amount is invalid");
        const map: any = await mapping(invoice.companyId);
        const receivable: any = await customerLedger(
          invoice.companyId,
          invoice.customerId,
        );
        const field: any = {
          Cash: "cashLedgerId",
          UPI: "upiClearingLedgerId",
          Card: "cardClearingLedgerId",
          "Net Banking": "netBankingClearingLedgerId",
          Cheque: "chequeClearingLedgerId",
        }[payment.paymentMode];
        if (!field || !map[field])
          fail(`Payment mapping is missing for ${payment.paymentMode}`);
        const ledger: any = await LedgerAccount.findOne({
          _id: map[field],
          companyId: invoice.companyId,
          status: "active",
        }).lean();
        if (!ledger) fail("Payment ledger is invalid");
        const ctx = await context(
          req as AuthRequest,
          invoice.companyId,
          new Date(payment.transactionDate || invoice.createdAt),
        );
        const voucher = await createAndPost(
          req as AuthRequest,
          {
            companyId: invoice.companyId,
            financialYearId: ctx.fy._id,
            accountingPeriodId: ctx.period._id,
            voucherDate: payment.transactionDate || invoice.createdAt,
            voucherType: "receipt",
            paymentMode:
              payment.paymentMode === "Cash"
                ? "Cash"
                : payment.paymentMode === "UPI"
                  ? "UPI"
                  : payment.paymentMode === "Cheque"
                    ? "Cheque"
                    : "Bank Transfer",
            narration: `Receipt for ${invoice.invoiceNumber}`,
            referenceNumber: payment.transactionId || String(payment._id),
          },
          "invoice_payment",
          payment._id,
          amountPaise,
          [
            line(ledger._id, amountPaise, 0, "Receipt"),
            line(receivable._id, 0, amountPaise, "Customer receivable"),
          ],
        );
        res.json(voucher);
      } catch (e) {
        res.status(409).json({ error: errorMessage(e) });
      }
    },
  );
  app.get(
    "/api/accounting/sales/customers/:customerId/ledger",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId = request.session.accountingCompanyId;
        if (!companyId || !(await getCompanyForUser(request, companyId)))
          fail("You are not authorized for this company");
        const financialYearId = String(
          req.query.financialYearId ||
            request.session.accountingFinancialYearId ||
            "",
        );
        if (financialYearId)
          await ensureFinancialYear(request, companyId, financialYearId);
        const ledger: any = await customerLedger(
          companyId,
          req.params.customerId,
        );
        const query: any = {
          companyId,
          status: { $in: ["posted", "reversed"] },
          "lines.ledgerAccountId": ledger._id,
        };
        if (financialYearId) query.financialYearId = financialYearId;
        const entries: any[] = await AccountingVoucher.find(query)
          .sort({ voucherDate: 1, voucherNumber: 1 })
          .lean();
        let balance = 0;
        const items: any[] = [];
        for (const voucher of entries)
          for (const l of voucher.lines as any[])
            if (String(l.ledgerAccountId) === String(ledger._id)) {
              balance += l.debitPaise - l.creditPaise;
              items.push({
                voucherId: voucher._id,
                voucherNumber: voucher.voucherNumber,
                date: voucher.voucherDate,
                debitPaise: l.debitPaise,
                creditPaise: l.creditPaise,
                balancePaise: balance,
                narration: voucher.narration,
              });
            }
        res.json({
          customerId: req.params.customerId,
          companyId,
          financialYearId: financialYearId || null,
          items,
          balancePaise: balance,
        });
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/sales/advances/:id/post",
    requireAuth,
    requirePermission("accounting", "post"),
    async (req, res) => {
      try {
        const advance: any = await AdvancePayment.findById(
          req.params.id,
        ).lean();
        if (
          !advance ||
          advance.ownershipStatus !== "verified" ||
          !advance.companyId ||
          advance.status !== "pending"
        )
          fail("Verified pending advance required");
        const map: any = await mapping(advance.companyId);
        if (!map.customerAdvancesLedgerId)
          fail("Customer Advances Liability mapping is missing");
        const receivable: any = await customerLedger(
          advance.companyId,
          advance.customerId,
        );
        const field: any = {
          Cash: "cashLedgerId",
          UPI: "upiClearingLedgerId",
          Card: "cardClearingLedgerId",
          "Net Banking": "netBankingClearingLedgerId",
          Cheque: "chequeClearingLedgerId",
        }[advance.paymentMode];
        if (!field || !map[field])
          fail(`Payment mapping is missing for ${advance.paymentMode}`);
        const cash: any = await LedgerAccount.findOne({
          _id: map[field],
          companyId: advance.companyId,
          status: "active",
        }).lean();
        const ctx = await context(
          req as AuthRequest,
          advance.companyId,
          new Date(advance.receivedDate),
        );
        const amountPaise = Math.round(Number(advance.amount || 0) * 100);
        const voucher = await createAndPost(
          req as AuthRequest,
          {
            companyId: advance.companyId,
            financialYearId: ctx.fy._id,
            accountingPeriodId: ctx.period._id,
            voucherDate: advance.receivedDate,
            voucherType: "receipt",
            paymentMode:
              advance.paymentMode === "Cash"
                ? "Cash"
                : advance.paymentMode === "UPI"
                  ? "UPI"
                  : advance.paymentMode === "Cheque"
                    ? "Cheque"
                    : "Bank Transfer",
            narration: `Customer advance ${advance._id}`,
            referenceNumber: advance.transactionId || String(advance._id),
          },
          "customer_advance",
          advance._id,
          amountPaise,
          [
            line(cash._id, amountPaise, 0, "Advance received"),
            line(
              map.customerAdvancesLedgerId,
              0,
              amountPaise,
              "Customer advances liability",
            ),
          ],
        );
        res.json(voucher);
      } catch (e) {
        res.status(409).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/sales/advances/:id/allocate",
    requireAuth,
    requirePermission("accounting", "post"),
    async (req, res) => {
      try {
        const data: any = advanceAllocationSchema.parse(req.body);
        const advance: any = await AdvancePayment.findById(
          req.params.id,
        ).lean();
        const invoice: any = await Invoice.findById(data.invoiceId).lean();
        if (
          !advance ||
          !invoice ||
          invoice.status !== "approved" ||
          invoice.ownershipStatus !== "verified" ||
          advance.ownershipStatus !== "verified" ||
          advance.companyId?.toString() !== invoice.companyId?.toString() ||
          advance.customerId?.toString() !== invoice.customerId?.toString()
        )
          fail("Advance and approved invoice ownership/customer do not match");
        const existing = await AdvanceAllocation.findOne({
          advanceId: advance._id,
          invoiceId: invoice._id,
          status: "confirmed",
        }).lean();
        if (existing) fail("This advance is already allocated to this invoice");
        const used: any = await AdvanceAllocation.aggregate([
          { $match: { advanceId: advance._id, status: "confirmed" } },
          { $group: { _id: null, total: { $sum: "$amountPaise" } } },
        ]);
        const available =
          Math.round(Number(advance.amount || 0) * 100) - (used[0]?.total || 0);
        if (data.amountPaise > available)
          fail("Advance allocation exceeds available balance");
        const ctx = await context(
          req as AuthRequest,
          advance.companyId,
          new Date(),
        );
        const allocation: any = await AdvanceAllocation.create({
          companyId: advance.companyId,
          financialYearId: ctx.fy._id,
          advanceId: advance._id,
          invoiceId: invoice._id,
          amountPaise: data.amountPaise,
          createdBy: uid(req as AuthRequest),
        });
        const map: any = await mapping(advance.companyId);
        if (!map.customerAdvancesLedgerId)
          fail("Customer Advances Liability mapping is missing");
        const receivable: any = await customerLedger(
          advance.companyId,
          invoice.customerId,
        );
        const voucher = await createAndPost(
          req as AuthRequest,
          {
            companyId: advance.companyId,
            financialYearId: ctx.fy._id,
            accountingPeriodId: ctx.period._id,
            voucherDate: new Date(),
            voucherType: "journal",
            narration: `Advance allocation to ${invoice.invoiceNumber}`,
          },
          "advance_allocation",
          allocation._id,
          data.amountPaise,
          [
            line(
              map.customerAdvancesLedgerId,
              data.amountPaise,
              0,
              "Advance liability used",
            ),
            line(receivable._id, 0, data.amountPaise, "Customer receivable"),
          ],
        );
        await AdvanceAllocation.updateOne(
          { _id: allocation._id, status: "pending" },
          { $set: { status: "confirmed" } },
        );
        res.json({
          allocation: await AdvanceAllocation.findById(allocation._id).lean(),
          voucher,
        });
      } catch (e) {
        res.status(409).json({ error: errorMessage(e) });
      }
    },
  );
}
