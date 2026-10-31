import test from "node:test";
import assert from "node:assert/strict";
import { validatePurchaseBillTotals } from "./purchaseAccountingLogic";

test("validates integer-paise purchase totals without recalculating GST", () => {
  assert.equal(
    validatePurchaseBillTotals({
      lines: [
        {
          taxablePaise: 10000,
          taxAmountPaise: 0,
          taxType: "none",
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 0,
        },
      ],
      subtotalPaise: 10000,
      taxAmountPaise: 0,
      grandTotalPaise: 10000,
    }).valid,
    true,
  );
});
test("blocks ambiguous stored GST classification", () => {
  const result = validatePurchaseBillTotals({
    lines: [
      {
        taxablePaise: 10000,
        taxAmountPaise: 1800,
        taxType: "ambiguous",
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
      },
    ],
    subtotalPaise: 10000,
    taxAmountPaise: 1800,
    grandTotalPaise: 11800,
  });
  assert.equal(result.valid, false);
});
test("rejects inconsistent purchase totals", () => {
  assert.equal(
    validatePurchaseBillTotals({
      lines: [{ taxablePaise: 10000, taxAmountPaise: 0, taxType: "none" }],
      subtotalPaise: 9000,
      taxAmountPaise: 0,
      grandTotalPaise: 9000,
    }).valid,
    false,
  );
});
