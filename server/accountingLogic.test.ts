import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeOpeningBalances,
  validateHierarchyParent,
  validateOpeningBalanceAmounts,
} from "./accountingLogic";

test("rejects a group that would become its own ancestor", () => {
  const parents = new Map([
    ["root", null],
    ["child", "root"],
  ]);
  assert.equal(validateHierarchyParent("root", "child", parents).valid, false);
  assert.equal(validateHierarchyParent("child", "root", parents).valid, true);
});

test("rejects a direct self-parent relationship", () => {
  assert.equal(
    validateHierarchyParent("group-1", "group-1", new Map()).valid,
    false,
  );
});

test("summarizes opening balances in paise and detects balance", () => {
  const summary = summarizeOpeningBalances([
    { debitPaise: 125075 },
    { debitPaise: 5000 },
    { creditPaise: 130075 },
  ]);
  assert.deepEqual(summary, {
    totalDebitPaise: 130075,
    totalCreditPaise: 130075,
    differencePaise: 0,
    balanced: true,
  });
});

test("rejects opening balances with both debit and credit values", () => {
  assert.equal(validateOpeningBalanceAmounts(100, 1).valid, false);
  assert.equal(validateOpeningBalanceAmounts(100, 0).valid, true);
});
