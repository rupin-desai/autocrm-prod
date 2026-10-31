import test from "node:test";
import assert from "node:assert/strict";
import { invoiceStoredAmounts } from "./salesIntegrationLogic";

test("maps stored product and service totals without recalculating GST", () => {
  const result = invoiceStoredAmounts({
    items: [
      { type: "product", total: 118, gstAmount: 0 },
      { type: "service", total: 236, gstAmount: 0 },
    ],
    discountAmount: 0,
    totalAmount: 354,
  });
  assert.deepEqual(result, {
    valid: true,
    totalPaise: 35400,
    gstPaise: 0,
    productPaise: 11800,
    servicePaise: 23600,
  });
});
test("rejects missing or inconsistent stored GST values", () => {
  assert.equal(
    invoiceStoredAmounts({
      items: [{ type: "product", total: 100, gstAmount: 120 }],
      discountAmount: 0,
      totalAmount: 100,
    }).valid,
    false,
  );
  assert.equal(
    invoiceStoredAmounts({
      items: [{ type: "product", total: 100 }],
      discountAmount: 0,
      totalAmount: 100,
    }).valid,
    false,
  );
});
test("uses stored discount and total consistency without changing source values", () => {
  const result = invoiceStoredAmounts({
    items: [{ type: "product", total: 118, gstAmount: 0 }],
    discountAmount: 18,
    totalAmount: 100,
  });
  assert.equal(result.valid, true);
  assert.equal((result as any).totalPaise, 10000);
});
