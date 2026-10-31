export function validateSalesMappingClassification(
  field: string,
  rootCategory: string,
  ledgerType: string,
) {
  if (
    ["productSalesLedgerId", "serviceIncomeLedgerId"].includes(field) &&
    rootCategory !== "income"
  )
    return `${field} must use an income ledger`;
  if (
    [
      "outputCgstLedgerId",
      "outputSgstLedgerId",
      "outputIgstLedgerId",
      "customerAdvancesLedgerId",
    ].includes(field) &&
    rootCategory !== "liabilities"
  )
    return `${field} must use a liability/tax ledger`;
  if (field === "cashLedgerId" && ledgerType !== "cash")
    return "Cash mapping must use a cash ledger";
  if (
    [
      "upiClearingLedgerId",
      "cardClearingLedgerId",
      "netBankingClearingLedgerId",
      "chequeClearingLedgerId",
    ].includes(field) &&
    ledgerType !== "bank"
  )
    return `${field} must use a bank ledger`;
  return null;
}
