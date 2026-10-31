import mongoose from "mongoose";
import { AccountingVoucher } from "../models/AccountingVoucher";
import { VoucherSequence } from "../models/VoucherSequence";
import { LedgerAccount } from "../models/LedgerAccount";
import { AccountGroup } from "../models/AccountGroup";
import { AccountingPeriod } from "../models/AccountingPeriod";
import { FinancialYear } from "../models/FinancialYear";
import { AccountingSettings } from "../models/AccountingSettings";
import { AccountingAuditEvent } from "../models/AccountingAuditEvent";
import {
  calculateVoucherTotals,
  nextVoucherNumber,
  validateVoucherType,
} from "../voucherLogic";

export const voucherPrefixes: Record<string, string> = {
  journal: "JV",
  payment: "PV",
  receipt: "RV",
  contra: "CV",
  reversal: "REV",
};

function fail(message: string): never {
  throw new Error(message);
}

export async function validateVoucherContext(
  data: any,
  session?: mongoose.ClientSession,
) {
  const fy = await FinancialYear.findOne({
    _id: data.financialYearId,
    companyId: data.companyId,
  }).session(session || null);
  if (!fy) fail("Financial year does not belong to this company");
  const period = await AccountingPeriod.findOne({
    _id: data.accountingPeriodId,
    companyId: data.companyId,
    financialYearId: data.financialYearId,
  }).session(session || null);
  if (!period) fail("Accounting period does not belong to this financial year");
  const date =
    data.voucherDate instanceof Date
      ? new Date(
          Date.UTC(
            data.voucherDate.getUTCFullYear(),
            data.voucherDate.getUTCMonth(),
            data.voucherDate.getUTCDate(),
          ),
        )
      : new Date(`${data.voucherDate}T00:00:00.000Z`);
  if (date < new Date(fy!.startDate) || date > new Date(fy!.endDate))
    fail("Voucher date is outside the financial year");
  if (date < new Date(period!.startDate) || date > new Date(period!.endDate))
    fail("Voucher date is outside the accounting period");
  if (period!.status !== "open")
    fail("The accounting period is locked or closed");
  return { fy, period, date };
}

export async function validateVoucherLines(
  data: any,
  session?: mongoose.ClientSession,
) {
  const totals = calculateVoucherTotals(data.lines);
  if (!totals.valid) fail(totals.error);
  const ids = data.lines.map((line: any) => line.ledgerAccountId);
  const ledgers = await LedgerAccount.find({
    _id: { $in: ids },
    companyId: data.companyId,
  })
    .session(session || null)
    .lean();
  const byId = new Map(
    ledgers.map((ledger: any) => [String(ledger._id), ledger]),
  );
  const groups = await AccountGroup.find({ companyId: data.companyId })
    .select("_id status")
    .session(session || null)
    .lean();
  const groupStatus = new Map(
    groups.map((group: any) => [String(group._id), group.status]),
  );
  const typedLines = data.lines.map((line: any) => {
    const ledger: any = byId.get(String(line.ledgerAccountId));
    if (!ledger)
      fail("Every voucher line must use a ledger from the selected company");
    if (ledger.status !== "active") fail(`Ledger ${ledger.name} is inactive`);
    if (groupStatus.get(String(ledger.groupId)) !== "active")
      fail(`Ledger ${ledger.name} belongs to an inactive group`);
    return { ...line, ledgerType: ledger.ledgerType };
  });
  const typeError = validateVoucherType(
    data.voucherType,
    data.paymentMode,
    typedLines,
  );
  if (typeError) fail(typeError);
  return totals;
}

async function audit(
  session: mongoose.ClientSession,
  data: any,
  action: string,
  userId: string,
  entityId: any,
  metadata?: any,
) {
  await AccountingAuditEvent.create(
    [
      {
        companyId: data.companyId,
        financialYearId: data.financialYearId,
        entityType: "AccountingVoucher",
        entityId,
        action,
        performedBy: userId,
        metadata,
      },
    ],
    { session },
  );
}

async function allocateNumber(
  session: mongoose.ClientSession,
  data: any,
  voucherType: string,
) {
  const settings: any = await AccountingSettings.findOne({
    companyId: data.companyId,
  })
    .session(session)
    .lean();
  const config = settings?.voucherNumbering?.[voucherType] || {};
  const sequence: any = await VoucherSequence.findOneAndUpdate(
    {
      companyId: data.companyId,
      financialYearId: data.financialYearId,
      voucherType,
    },
    { $inc: { nextNumber: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session },
  );
  const fy: any = await FinancialYear.findById(data.financialYearId)
    .session(session)
    .lean();
  return nextVoucherNumber(
    config.prefix || voucherPrefixes[voucherType] || "VCH",
    fy?.label || "",
    sequence.nextNumber,
    config.padding || 4,
    config.includeFinancialYear !== false,
  );
}

export async function postVoucherInSession(
  voucherId: string,
  userId: string,
  session: mongoose.ClientSession,
  afterPost?: (session: mongoose.ClientSession, voucher: any) => Promise<void>,
) {
  const claimId = new mongoose.Types.ObjectId();
  const claimed: any = await AccountingVoucher.findOneAndUpdate(
    { _id: voucherId, status: "approved", postingClaimId: { $exists: false } },
    {
      $set: {
        postingClaimId: claimId,
        postingClaimedBy: userId,
        postingClaimedAt: new Date(),
      },
    },
    { new: true, session },
  );
  if (!claimed) {
    const current: any = await AccountingVoucher.findById(voucherId)
      .session(session)
      .lean();
    if (!current) fail("Voucher not found");
    if (current.status === "approved" && current.postingClaimId)
      fail("Voucher is already being posted");
    fail("Only approved vouchers can be posted");
  }

  await validateVoucherContext(claimed.toObject(), session);
  await validateVoucherLines(claimed.toObject(), session);
  const voucherNumber = await allocateNumber(
    session,
    claimed,
    claimed.voucherType,
  );
  const posted: any = await AccountingVoucher.findOneAndUpdate(
    { _id: claimed._id, status: "approved", postingClaimId: claimId },
    {
      $set: {
        voucherNumber,
        status: "posted",
        postedBy: userId,
        postedAt: new Date(),
        updatedBy: userId,
      },
      $unset: { postingClaimId: 1, postingClaimedBy: 1, postingClaimedAt: 1 },
    },
    { new: true, session },
  );
  if (!posted)
    fail("Voucher posting claim was lost; transaction must be retried");
  await audit(session, posted, "posted", userId, posted._id, {
    voucherNumber: posted.voucherNumber,
  });
  if (afterPost) await afterPost(session, posted);
  return posted;
}

export async function postVoucher(
  voucherId: string,
  userId: string,
  afterPost?: (session: mongoose.ClientSession, voucher: any) => Promise<void>,
) {
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      result = await postVoucherInSession(
        voucherId,
        userId,
        session,
        afterPost,
      );
    });
    return result;
  } catch (error: any) {
    if (
      String(error?.message || "").includes(
        "Transaction numbers are only allowed",
      )
    )
      fail(
        "Posting requires MongoDB replica-set transactions; draft workflow remains available",
      );
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function reverseVoucher(
  voucherId: string,
  userId: string,
  reversalDate: string,
  reversalPeriodId: string,
  reason = "",
) {
  const session = await mongoose.startSession();
  try {
    let reversal: any;
    await session.withTransaction(async () => {
      const original: any =
        await AccountingVoucher.findById(voucherId).session(session);
      if (!original) fail("Voucher not found");
      if (original.status !== "posted")
        fail("Only posted vouchers can be reversed");
      if (original.reversalVoucherId) fail("Voucher is already reversed");
      const reversalContext = {
        companyId: original.companyId,
        financialYearId: original.financialYearId,
        accountingPeriodId: reversalPeriodId,
        voucherDate: reversalDate,
      };
      await validateVoucherContext(reversalContext, session);
      const lines = original.lines.map((line: any) => ({
        ledgerAccountId: line.ledgerAccountId,
        description: `Reversal of ${original.voucherNumber}`,
        debitPaise: line.creditPaise,
        creditPaise: line.debitPaise,
      }));
      const reversalData: any = {
        ...original.toObject(),
        _id: undefined,
        voucherNumber: undefined,
        voucherType: "reversal",
        voucherDate: reversalContext.voucherDate,
        accountingPeriodId: reversalPeriodId,
        status: "approved",
        lines,
        totalDebitPaise: original.totalCreditPaise,
        totalCreditPaise: original.totalDebitPaise,
        reversalOfVoucherId: original._id,
        reversalVoucherId: undefined,
        sourceType: undefined,
        sourceId: undefined,
        sourceFingerprint: undefined,
        idempotencyKey: undefined,
        idempotencyFingerprint: undefined,
        narration: reason || `Reversal of ${original.voucherNumber}`,
        createdBy: userId,
        updatedBy: userId,
        approvedBy: userId,
        approvedAt: new Date(),
        postedBy: undefined,
        postedAt: undefined,
      };
      const created: any = new AccountingVoucher(reversalData);
      created.voucherNumber = await allocateNumber(
        session,
        original,
        "reversal",
      );
      created.status = "posted";
      created.postedBy = userId;
      created.postedAt = new Date();
      await created.save({ session });
      original.status = "reversed";
      original.reversalVoucherId = created._id;
      original.reversedBy = userId;
      original.reversedAt = new Date();
      original.updatedBy = userId;
      await original.save({ session, accountingReversal: true } as any);
      await audit(session, original, "reversed", userId, original._id, {
        reversalVoucherId: created._id,
        reason,
      });
      await audit(session, created, "posted", userId, created._id, {
        reversalOfVoucherId: original._id,
      });
      reversal = created;
    });
    return reversal;
  } catch (error: any) {
    if (
      String(error?.message || "").includes(
        "Transaction numbers are only allowed",
      )
    )
      fail("Reversal requires MongoDB replica-set transactions");
    throw error;
  } finally {
    await session.endSession();
  }
}
