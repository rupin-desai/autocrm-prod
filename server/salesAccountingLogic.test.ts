import test from "node:test";
import assert from "node:assert/strict";
import { ownershipFields } from "./services/ownership";
import { validateSalesMappingClassification } from "./salesAccountingLogic";

test("ownership metadata distinguishes verified and unverified records", () => {
  assert.deepEqual(
    ownershipFields({ companyId: "company-1", ownershipStatus: "verified" }),
    { companyId: "company-1", ownershipStatus: "verified" },
  );
  assert.deepEqual(ownershipFields({ ownershipStatus: "unverified" }), {
    companyId: undefined,
    ownershipStatus: "unverified",
  });
});
test("sales mappings reject inappropriate ledger classifications", () => {
  assert.match(
    validateSalesMappingClassification(
      "productSalesLedgerId",
      "expenses",
      "general",
    ) || "",
    /income ledger/,
  );
  assert.match(
    validateSalesMappingClassification(
      "outputCgstLedgerId",
      "income",
      "general",
    ) || "",
    /liability/,
  );
  assert.match(
    validateSalesMappingClassification("cashLedgerId", "assets", "general") ||
      "",
    /cash ledger/,
  );
  assert.equal(
    validateSalesMappingClassification(
      "serviceIncomeLedgerId",
      "income",
      "general",
    ),
    null,
  );
});
