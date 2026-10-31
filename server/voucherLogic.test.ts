import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateVoucherTotals,
  validateVoucherType,
  nextVoucherNumber,
} from "./voucherLogic";
import {
  summarizeOpeningBalances,
  validateOpeningBalanceAmounts,
} from "./accountingLogic";
import {
  MAX_ACCOUNTING_PAISE,
  isSafeAccountingPaise,
  rupeesToPaise,
} from "./accountingMoney";

test("accepts balanced integer-paise voucher lines", () => {
  assert.deepEqual(
    calculateVoucherTotals([
      { ledgerAccountId: "a", debitPaise: 100, creditPaise: 0 },
      { ledgerAccountId: "b", debitPaise: 0, creditPaise: 100 },
    ]),
    { valid: true, totalDebitPaise: 100, totalCreditPaise: 100 },
  );
});
test("rejects unbalanced, fractional and double-sided lines", () => {
  assert.equal(
    calculateVoucherTotals([
      { ledgerAccountId: "a", debitPaise: 100, creditPaise: 0 },
      { ledgerAccountId: "b", debitPaise: 0, creditPaise: 99 },
    ]).valid,
    false,
  );
  assert.equal(
    calculateVoucherTotals([
      { ledgerAccountId: "a", debitPaise: 1.5, creditPaise: 0 },
      { ledgerAccountId: "b", debitPaise: 0, creditPaise: 1.5 },
    ]).valid,
    false,
  );
  assert.equal(
    calculateVoucherTotals([
      { ledgerAccountId: "a", debitPaise: 10, creditPaise: 10 },
      { ledgerAccountId: "b", debitPaise: 0, creditPaise: 0 },
    ]).valid,
    false,
  );
});
test("enforces payment, receipt and contra rules", () => {
  assert.match(
    validateVoucherType("payment", "Cash", [
      {
        ledgerAccountId: "a",
        ledgerType: "cash",
        debitPaise: 100,
        creditPaise: 0,
      },
      {
        ledgerAccountId: "b",
        ledgerType: "general",
        debitPaise: 0,
        creditPaise: 100,
      },
    ]) || "",
    /^Payment vouchers must credit/,
  );
  assert.equal(
    validateVoucherType("receipt", "Cash", [
      {
        ledgerAccountId: "a",
        ledgerType: "cash",
        debitPaise: 100,
        creditPaise: 0,
      },
      {
        ledgerAccountId: "b",
        ledgerType: "general",
        debitPaise: 0,
        creditPaise: 100,
      },
    ]),
    null,
  );
  assert.equal(
    validateVoucherType("contra", undefined, [
      {
        ledgerAccountId: "a",
        ledgerType: "cash",
        debitPaise: 100,
        creditPaise: 0,
      },
      {
        ledgerAccountId: "b",
        ledgerType: "bank",
        debitPaise: 0,
        creditPaise: 100,
      },
    ]),
    null,
  );
});
test("formats voucher sequences deterministically", () => {
  assert.equal(nextVoucherNumber("JV", "2026-27", 7, 4), "JV/2026-27/0007");
  assert.equal(nextVoucherNumber("JV", "2026-27", 7, 4, false), "JV/0007");
});
test("enforces safe accounting paise limits and exact conversion", () => {
  assert.equal(isSafeAccountingPaise(MAX_ACCOUNTING_PAISE), true);
  assert.equal(isSafeAccountingPaise(MAX_ACCOUNTING_PAISE + 1), false);
  assert.equal(
    calculateVoucherTotals([
      {
        ledgerAccountId: "a",
        debitPaise: MAX_ACCOUNTING_PAISE + 1,
        creditPaise: 0,
      },
      {
        ledgerAccountId: "b",
        debitPaise: 0,
        creditPaise: MAX_ACCOUNTING_PAISE + 1,
      },
    ]).valid,
    false,
  );
  assert.equal(rupeesToPaise("123.45"), 12345);
  assert.throws(() => rupeesToPaise(String(MAX_ACCOUNTING_PAISE) + ".01"));
});
test("rejects extra cash or bank settlement lines", () => {
  const result = validateVoucherType("payment", "Cash", [
    {
      ledgerAccountId: "a",
      ledgerType: "cash",
      debitPaise: 0,
      creditPaise: 100,
    },
    {
      ledgerAccountId: "b",
      ledgerType: "bank",
      debitPaise: 100,
      creditPaise: 0,
    },
    { ledgerAccountId: "c", ledgerType: "cash", debitPaise: 0, creditPaise: 1 },
  ]);
  assert.match(result || "", /exactly one cash/);
});
test("rejects unsafe opening balances instead of truncating them", () => {
  assert.equal(validateOpeningBalanceAmounts(1.5, 0).valid, false);
  assert.throws(() =>
    summarizeOpeningBalances([{ debitPaise: 1.5, creditPaise: 0 }]),
  );
});
