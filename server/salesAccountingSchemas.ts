import { z } from "zod";
const id = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
export const salesAccountingMappingSchema = z.object({
  companyId: id,
  productSalesLedgerId: id.nullable().optional(),
  serviceIncomeLedgerId: id.nullable().optional(),
  outputCgstLedgerId: id.nullable().optional(),
  outputSgstLedgerId: id.nullable().optional(),
  outputIgstLedgerId: id.nullable().optional(),
  customerAdvancesLedgerId: id.nullable().optional(),
  cashLedgerId: id.nullable().optional(),
  upiClearingLedgerId: id.nullable().optional(),
  cardClearingLedgerId: id.nullable().optional(),
  netBankingClearingLedgerId: id.nullable().optional(),
  chequeClearingLedgerId: id.nullable().optional(),
});
