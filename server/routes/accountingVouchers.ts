import type { Express, Request } from "express";
import mongoose from "mongoose";
import { requireAuth, requirePermission } from "../middleware";
import { hasPermission } from "../auth";
import { AccountingVoucher } from "../models/AccountingVoucher";
import { LedgerAccount } from "../models/LedgerAccount";
import { OpeningBalance } from "../models/OpeningBalance";
import { AccountingAuditEvent } from "../models/AccountingAuditEvent";
import { FinancialYear } from "../models/FinancialYear";
import { getCompanyForUser, ensureFinancialYear } from "./accountingFoundation";
import {
  voucherCreateSchema,
  voucherUpdateSchema,
  voucherListQuerySchema,
  voucherActionSchema,
  voucherReverseSchema,
} from "../voucherSchemas";
import {
  validateVoucherContext,
  validateVoucherLines,
  postVoucher,
  reverseVoucher,
} from "../services/accountingVouchers";

type AuthRequest = Request & {
  session: Request["session"] & {
    userId?: string;
    userRole?: string;
    accountingCompanyId?: string;
    accountingFinancialYearId?: string;
  };
};
const uid = (req: AuthRequest) => req.session.userId as string;
const permission = (req: AuthRequest, action: string) =>
  hasPermission(req.session.userRole || "", "accounting", action);
async function company(req: AuthRequest, id?: string) {
  return getCompanyForUser(req, id || req.session.accountingCompanyId || "");
}
function errorMessage(error: any) {
  return (
    error?.issues?.[0]?.message ||
    error?.message ||
    "Invalid accounting voucher request"
  );
}
function fingerprint(data: any) {
  return JSON.stringify({
    companyId: data.companyId,
    financialYearId: data.financialYearId,
    accountingPeriodId: data.accountingPeriodId,
    voucherType: data.voucherType,
    voucherDate: data.voucherDate,
    paymentMode: data.paymentMode || "",
    transactionReference: data.transactionReference || "",
    narration: data.narration || "",
    referenceNumber: data.referenceNumber || "",
    lines: data.lines,
  });
}
async function audit(
  req: AuthRequest,
  data: any,
  action: string,
  id: any,
  metadata?: any,
) {
  return AccountingAuditEvent.create({
    companyId: data.companyId,
    financialYearId: data.financialYearId,
    entityType: "AccountingVoucher",
    entityId: id,
    action,
    performedBy: uid(req),
    ipAddress: req.ip,
    metadata,
  });
}

export function registerAccountingVoucherRoutes(app: Express) {
  app.get(
    "/api/accounting/vouchers",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const q: any = voucherListQuerySchema.parse(req.query);
        const c = await company(req as AuthRequest, q.companyId);
        if (!c)
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const query: any = { companyId: c._id };
        const fy =
          q.financialYearId ||
          (req as AuthRequest).session.accountingFinancialYearId;
        if (fy) {
          if (
            !(await ensureFinancialYear(req as AuthRequest, String(c._id), fy))
          )
            return res
              .status(403)
              .json({ error: "Invalid financial year context" });
          query.financialYearId = fy;
        }
        if (q.voucherType) query.voucherType = q.voucherType;
        if (q.status) query.status = q.status;
        if (q.fromDate || q.toDate) query.voucherDate = {};
        if (q.fromDate)
          query.voucherDate.$gte = new Date(`${q.fromDate}T00:00:00Z`);
        if (q.toDate)
          query.voucherDate.$lte = new Date(`${q.toDate}T23:59:59Z`);
        if (q.search)
          query.$or = [
            { voucherNumber: new RegExp(q.search, "i") },
            { narration: new RegExp(q.search, "i") },
            { referenceNumber: new RegExp(q.search, "i") },
          ];
        const [items, total] = await Promise.all([
          AccountingVoucher.find(query)
            .sort({ voucherDate: -1, createdAt: -1 })
            .skip((q.page - 1) * q.limit)
            .limit(q.limit)
            .lean(),
          AccountingVoucher.countDocuments(query),
        ]);
        res.json({
          items,
          total,
          page: q.page,
          limit: q.limit,
          totalPages: Math.ceil(total / q.limit),
        });
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );

  app.post(
    "/api/accounting/vouchers",
    requireAuth,
    requirePermission("accounting", "create"),
    async (req, res) => {
      try {
        const data: any = voucherCreateSchema.parse(req.body);
        const c = await company(req as AuthRequest, data.companyId);
        if (!c)
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        await validateVoucherContext(data);
        const totals = await validateVoucherLines(data);
        const requestFingerprint = fingerprint(data);
        if (data.idempotencyKey) {
          const existing: any = await AccountingVoucher.findOne({
            companyId: data.companyId,
            idempotencyKey: data.idempotencyKey,
          });
          if (existing) {
            if (existing.idempotencyFingerprint !== requestFingerprint)
              return res
                .status(409)
                .json({
                  error:
                    "Idempotency key was already used with a different payload",
                });
            return res.status(200).json(existing);
          }
        }
        if (
          data.sourceFingerprint &&
          (await AccountingVoucher.exists({
            companyId: data.companyId,
            sourceFingerprint: data.sourceFingerprint,
          }))
        )
          return res
            .status(409)
            .json({ error: "Duplicate source accounting entry" });
        const voucher = await AccountingVoucher.create({
          ...data,
          idempotencyFingerprint: data.idempotencyKey
            ? requestFingerprint
            : undefined,
          totalDebitPaise: totals.totalDebitPaise,
          totalCreditPaise: totals.totalCreditPaise,
          createdBy: uid(req as AuthRequest),
          updatedBy: uid(req as AuthRequest),
        });
        await audit(req as AuthRequest, data, "created", voucher._id);
        res.status(201).json(voucher);
      } catch (e: any) {
        if (e?.code === 11000 && req.body?.idempotencyKey) {
          const parsed: any = voucherCreateSchema.safeParse(req.body);
          const existing: any = parsed.success
            ? await AccountingVoucher.findOne({
                companyId: parsed.data.companyId,
                idempotencyKey: parsed.data.idempotencyKey,
              })
            : null;
          if (
            existing &&
            existing.idempotencyFingerprint === fingerprint(parsed.data)
          )
            return res.status(200).json(existing);
          if (existing)
            return res
              .status(409)
              .json({
                error:
                  "Idempotency key was already used with a different payload",
              });
        }
        res
          .status(e?.code === 11000 ? 409 : 400)
          .json({
            error:
              e?.code === 11000
                ? "Duplicate idempotency or source identity"
                : errorMessage(e),
          });
      }
    },
  );

  app.get(
    "/api/accounting/vouchers/:id",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const v: any = await AccountingVoucher.findById(req.params.id)
          .populate("lines.ledgerAccountId", "code name ledgerType")
          .lean();
        if (!v || !(await company(req as AuthRequest, String(v.companyId))))
          return res.status(404).json({ error: "Voucher not found" });
        res.json(v);
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );

  app.patch(
    "/api/accounting/vouchers/:id",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const v: any = await AccountingVoucher.findById(req.params.id);
        if (!v || !(await company(req as AuthRequest, String(v.companyId))))
          return res.status(404).json({ error: "Voucher not found" });
        if (v.status !== "draft")
          return res
            .status(409)
            .json({ error: "Only draft vouchers can be edited" });
        const data: any = voucherUpdateSchema.parse(req.body);
        const merged = {
          ...v.toObject(),
          ...data,
          companyId: String(v.companyId),
          financialYearId: String(v.financialYearId),
          accountingPeriodId: String(v.accountingPeriodId),
        };
        await validateVoucherContext(merged);
        const totals = await validateVoucherLines(merged);
        Object.assign(v, data, totals, { updatedBy: uid(req as AuthRequest) });
        await v.save();
        await audit(req as AuthRequest, v, "updated", v._id);
        res.json(v);
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );

  app.post(
    "/api/accounting/vouchers/:id/submit",
    requireAuth,
    requirePermission("accounting", "submit"),
    async (req, res) => transition(req, res, "pending_approval", "submitted"),
  );
  app.post(
    "/api/accounting/vouchers/:id/approve",
    requireAuth,
    requirePermission("accounting", "approve"),
    async (req, res) => transition(req, res, "approved", "approved"),
  );
  app.post(
    "/api/accounting/vouchers/:id/cancel",
    requireAuth,
    requirePermission("accounting", "cancel"),
    async (req, res) => transition(req, res, "cancelled", "cancelled"),
  );
  app.post(
    "/api/accounting/vouchers/:id/post",
    requireAuth,
    requirePermission("accounting", "post"),
    async (req, res) => {
      try {
        res.json(await postVoucher(req.params.id, uid(req as AuthRequest)));
      } catch (e) {
        res.status(409).json({ error: errorMessage(e) });
      }
    },
  );
  app.post(
    "/api/accounting/vouchers/:id/reverse",
    requireAuth,
    requirePermission("accounting", "reverse"),
    async (req, res) => {
      try {
        const body: any = voucherReverseSchema.parse(req.body || {});
        res.json(
          await reverseVoucher(
            req.params.id,
            uid(req as AuthRequest),
            body.voucherDate,
            body.accountingPeriodId,
            body.reason,
          ),
        );
      } catch (e) {
        res.status(409).json({ error: errorMessage(e) });
      }
    },
  );

  app.get(
    "/api/accounting/vouchers/:id/audit",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      const v: any = await AccountingVoucher.findById(req.params.id).select(
        "companyId",
      );
      if (!v || !(await company(req as AuthRequest, String(v.companyId))))
        return res.status(404).json({ error: "Voucher not found" });
      res.json(
        await AccountingAuditEvent.find({
          entityType: "AccountingVoucher",
          entityId: v._id,
        })
          .sort({ createdAt: 1 })
          .lean(),
      );
    },
  );

  app.get(
    "/api/accounting/ledgers/:id/transactions",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const ledger: any = await LedgerAccount.findById(req.params.id).lean();
        if (!ledger || !(await company(request, String(ledger.companyId))))
          return res.status(404).json({ error: "Ledger not found" });
        const fy = String(
          req.query.financialYearId ||
            request.session.accountingFinancialYearId ||
            "",
        );
        if (
          fy &&
          !(await ensureFinancialYear(request, String(ledger.companyId), fy))
        )
          return res
            .status(403)
            .json({ error: "Invalid financial year context" });
        const [vouchers, openingRaw] = await Promise.all([
          AccountingVoucher.find({
            companyId: ledger.companyId,
            financialYearId: fy,
            status: { $in: ["posted", "reversed"] },
            "lines.ledgerAccountId": ledger._id,
          })
            .sort({ voucherDate: 1, voucherNumber: 1 })
            .lean(),
          OpeningBalance.findOne({
            companyId: ledger.companyId,
            financialYearId: fy,
            ledgerAccountId: ledger._id,
            status: "finalized",
          }).lean(),
        ]);
        const opening: any = openingRaw;
        let running = (opening?.debitPaise || 0) - (opening?.creditPaise || 0);
        const items: any[] = [];
        for (const v of vouchers as any[])
          for (const line of v.lines)
            if (String(line.ledgerAccountId) === String(ledger._id)) {
              running += line.debitPaise - line.creditPaise;
              items.push({
                voucherId: v._id,
                voucherNumber: v.voucherNumber,
                voucherDate: v.voucherDate,
                voucherType: v.voucherType,
                narration: v.narration,
                debitPaise: line.debitPaise,
                creditPaise: line.creditPaise,
                runningBalancePaise: running,
              });
            }
        res.json({ ledger, openingBalance: opening || null, items });
      } catch (e) {
        res.status(400).json({ error: errorMessage(e) });
      }
    },
  );
}

async function transition(
  req: Request,
  res: any,
  nextStatus: string,
  action: string,
) {
  try {
    const request = req as AuthRequest;
    const v: any = await AccountingVoucher.findById(req.params.id);
    if (!v || !(await company(request, String(v.companyId))))
      return res.status(404).json({ error: "Voucher not found" });
    const allowed: any = {
      pending_approval: ["draft"],
      approved: ["pending_approval"],
      cancelled: ["draft", "pending_approval", "approved"],
    };
    if (!allowed[nextStatus].includes(v.status))
      return res
        .status(409)
        .json({ error: `Voucher cannot be ${action} from ${v.status}` });
    if (nextStatus === "approved") {
      await validateVoucherContext(v.toObject());
      await validateVoucherLines(v.toObject());
    }
    v.status = nextStatus;
    v.updatedBy = uid(request);
    if (nextStatus === "pending_approval") {
      v.submittedBy = uid(request);
      v.submittedAt = new Date();
    }
    if (nextStatus === "approved") {
      v.approvedBy = uid(request);
      v.approvedAt = new Date();
    }
    if (nextStatus === "cancelled") {
      v.cancelledBy = uid(request);
      v.cancelledAt = new Date();
    }
    await v.save();
    await audit(request, v, action, v._id);
    res.json(v);
  } catch (e) {
    res.status(400).json({ error: errorMessage(e) });
  }
}
