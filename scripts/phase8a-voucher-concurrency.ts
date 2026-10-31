import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Company } from "../server/models/Company";
import { FinancialYear } from "../server/models/FinancialYear";
import { AccountingPeriod } from "../server/models/AccountingPeriod";
import { AccountGroup } from "../server/models/AccountGroup";
import { LedgerAccount } from "../server/models/LedgerAccount";
import { AccountingVoucher } from "../server/models/AccountingVoucher";
import { AccountingAuditEvent } from "../server/models/AccountingAuditEvent";
import { VoucherSequence } from "../server/models/VoucherSequence";
import { User } from "../server/models/User";
import { postVoucher } from "../server/services/accountingVouchers";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required");

async function fixture(prefix: string) {
  const user = await User.create({
    name: `${prefix} Admin`,
    email: `${prefix.toLowerCase()}@example.test`,
    mobileNumber: `9${Date.now().toString().slice(-9)}`,
    passwordHash: "test-only",
    role: "Admin",
    isActive: true,
  });
  const company = await Company.create({
    name: `${prefix} Company`,
    legalName: `${prefix} Legal`,
    createdBy: user._id,
    updatedBy: user._id,
  });
  const financialYear = await FinancialYear.create({
    companyId: company._id,
    label: "2026-27",
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2027-03-31T00:00:00.000Z"),
    status: "active",
    isCurrent: true,
    createdBy: user._id,
    updatedBy: user._id,
  });
  const period = await AccountingPeriod.create({
    companyId: company._id,
    financialYearId: financialYear._id,
    periodNumber: 1,
    label: "April 2026",
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-04-30T23:59:59.999Z"),
    status: "open",
  });
  const group = await AccountGroup.create({
    companyId: company._id,
    name: "Test Assets",
    code: `${prefix.toUpperCase()}-ASSET`,
    rootCategory: "assets",
    normalBalance: "debit",
    createdBy: user._id,
    updatedBy: user._id,
  });
  const ledgers = await LedgerAccount.create([
    {
      companyId: company._id,
      groupId: group._id,
      code: `${prefix.toUpperCase()}-DR`,
      name: "Test Debit",
      ledgerType: "general",
      createdBy: user._id,
      updatedBy: user._id,
    },
    {
      companyId: company._id,
      groupId: group._id,
      code: `${prefix.toUpperCase()}-CR`,
      name: "Test Credit",
      ledgerType: "general",
      createdBy: user._id,
      updatedBy: user._id,
    },
  ]);
  const voucher = await AccountingVoucher.create({
    companyId: company._id,
    financialYearId: financialYear._id,
    accountingPeriodId: period._id,
    voucherType: "journal",
    voucherDate: "2026-04-02",
    status: "approved",
    lines: [
      { ledgerAccountId: ledgers[0]._id, debitPaise: 1000, creditPaise: 0 },
      { ledgerAccountId: ledgers[1]._id, debitPaise: 0, creditPaise: 1000 },
    ],
    totalDebitPaise: 1000,
    totalCreditPaise: 1000,
    createdBy: user._id,
    updatedBy: user._id,
    approvedBy: user._id,
    approvedAt: new Date(),
  });
  return { user, company, financialYear, period, voucher };
}

async function main() {
  await mongoose.connect(uri!);
  const concurrent = await fixture(`P8A${Date.now()}`);
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      postVoucher(String(concurrent.voucher._id), String(concurrent.user._id)),
    ),
  );
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
    JSON.stringify(results),
  );
  const posted = await AccountingVoucher.findById(
    concurrent.voucher._id,
  ).lean();
  assert.equal(posted?.status, "posted");
  assert.ok(posted?.voucherNumber);
  assert.equal(
    await AccountingVoucher.countDocuments({
      companyId: concurrent.company._id,
      sourceType: { $ne: "" },
    }),
    0,
  );
  assert.equal(
    await AccountingAuditEvent.countDocuments({
      entityId: concurrent.voucher._id,
      action: "posted",
    }),
    1,
  );
  assert.equal(
    await VoucherSequence.countDocuments({
      companyId: concurrent.company._id,
      financialYearId: concurrent.financialYear._id,
      voucherType: "journal",
    }),
    1,
  );

  const rollback = await fixture(`P8AR${Date.now()}`);
  await assert.rejects(() =>
    postVoucher(
      String(rollback.voucher._id),
      String(rollback.user._id),
      async () => {
        throw new Error("controlled downstream failure");
      },
    ),
  );
  const rolledBack = await AccountingVoucher.findById(
    rollback.voucher._id,
  ).lean();
  assert.equal(rolledBack?.status, "approved");
  assert.equal(rolledBack?.voucherNumber, undefined);
  assert.equal(rolledBack?.postingClaimId, undefined);
  assert.equal(
    await AccountingAuditEvent.countDocuments({
      entityId: rollback.voucher._id,
      action: "posted",
    }),
    0,
  );
  assert.equal(
    await VoucherSequence.countDocuments({
      companyId: rollback.company._id,
      financialYearId: rollback.financialYear._id,
      voucherType: "journal",
    }),
    0,
  );
  const retried = await postVoucher(
    String(rollback.voucher._id),
    String(rollback.user._id),
  );
  assert.equal(retried.status, "posted");
  console.log(
    JSON.stringify({
      concurrentSuccesses: 1,
      finalStatus: posted?.status,
      voucherNumber: posted?.voucherNumber,
      rollbackRestored: true,
      retryStatus: retried.status,
    }),
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
