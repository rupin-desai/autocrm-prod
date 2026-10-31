import { MAX_ACCOUNTING_PAISE, isSafeAccountingPaise } from "./accountingMoney";

export function validatePurchaseBillTotals(input: any) {
  // Purchase bills are posted only when their header totals can be rebuilt
  // exactly from the individual purchase lines.
  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (!lines.length)
    return {
      valid: false,
      error: "At least one purchase line is required",
    } as const;
  const subtotal = lines.reduce(
    (sum: number, line: any) => sum + Number(line.taxablePaise || 0),
    0,
  );
  const tax = lines.reduce(
    (sum: number, line: any) => sum + Number(line.taxAmountPaise || 0),
    0,
  );
  const total = subtotal + Number(input.additionalExpensesPaise || 0) + tax;
  if (
    ![
      subtotal,
      tax,
      total,
      Number(input.subtotalPaise),
      Number(input.taxAmountPaise),
      Number(input.grandTotalPaise),
    ].every(isSafeAccountingPaise)
  )
    return {
      valid: false,
      error: `Purchase amounts must be safe integer paise values up to ${MAX_ACCOUNTING_PAISE}`,
    } as const;
  if (
    subtotal !== input.subtotalPaise ||
    tax !== input.taxAmountPaise ||
    total !== input.grandTotalPaise
  )
    return {
      valid: false,
      error: "Purchase bill totals do not match the stored line values",
    } as const;
  for (const line of lines) {
    // Validate the selected GST model so tax cannot be double-counted or
    // silently omitted during accounting integration.
    if (
      line.taxType === "cgst_sgst" &&
      line.cgstPaise + line.sgstPaise !== line.taxAmountPaise
    )
      return {
        valid: false,
        error: "Stored CGST/SGST values do not match tax amount",
      } as const;
    if (line.taxType === "igst" && line.igstPaise !== line.taxAmountPaise)
      return {
        valid: false,
        error: "Stored IGST value does not match tax amount",
      } as const;
    if (
      line.taxType === "ambiguous" ||
      (line.taxAmountPaise > 0 && line.taxType === "none")
    )
      return {
        valid: false,
        error: "GST classification is missing or ambiguous",
      } as const;
  }
  return {
    valid: true,
    subtotalPaise: subtotal,
    taxPaise: tax,
    totalPaise: total,
  } as const;
}

export function paymentAllocationTotal(allocations: any[]) {
  return allocations.reduce(
    (sum, allocation) => sum + Number(allocation.amountPaise || 0),
    0,
  );
}
