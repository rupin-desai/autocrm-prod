// Maximum integer paise amount; safely below Number.MAX_SAFE_INTEGER.
export const MAX_ACCOUNTING_PAISE = 9_000_000_000_000_000;
export function isSafeAccountingPaise(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_ACCOUNTING_PAISE
  );
}
export function rupeesToPaise(value: string | number): number {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error("Amount must contain rupees with at most two decimals");
  const [whole, fraction = ""] = text.split(".");
  const paise = Number(`${whole}${fraction.padEnd(2, "0")}`);
  if (!isSafeAccountingPaise(paise))
    throw new Error("Amount exceeds the maximum accounting limit");
  return paise;
}
