import { rupeesToPaise } from "./accountingMoney";

export function invoiceStoredAmounts(invoice: any) {
  // Recalculate accounting values from invoice lines instead of trusting
  // denormalized totals stored on the invoice document.
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  if (!items.length)
    return { valid: false, reason: "Invoice has no line items" } as const;
  let total = 0;
  let gst = 0;
  let product = 0;
  let service = 0;
  for (const item of items) {
    if (
      typeof item.total !== "number" ||
      item.total < 0 ||
      typeof item.gstAmount !== "number" ||
      item.gstAmount < 0 ||
      item.gstAmount > item.total
    )
      return {
        valid: false,
        reason:
          "Invoice contains missing or inconsistent stored item totals/GST values",
      } as const;
    const itemTotal = rupeesToPaise(item.total.toFixed(2));
    const itemGst = rupeesToPaise(item.gstAmount.toFixed(2));
    const net = itemTotal - itemGst;
    total += itemTotal;
    gst += itemGst;
    if (item.type === "product") product += net;
    else if (item.type === "service") service += net;
    else
      return {
        valid: false,
        reason: "Invoice contains an unsupported item type",
      } as const;
  }
  const invoiceTotal = rupeesToPaise(
    Number(invoice.totalAmount || 0).toFixed(2),
  );
  // The persisted invoice total must equal line totals after discount;
  // otherwise the invoice is unsafe to post into accounting.
  if (
    total - rupeesToPaise(Number(invoice.discountAmount || 0).toFixed(2)) !==
    invoiceTotal
  )
    return {
      valid: false,
      reason: "Stored item totals, discount and invoice total are inconsistent",
    } as const;
  return {
    valid: true,
    totalPaise: invoiceTotal,
    gstPaise: gst,
    productPaise: product,
    servicePaise: service,
  } as const;
}
