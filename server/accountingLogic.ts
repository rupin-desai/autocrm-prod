export type OpeningBalanceEntry = { debitPaise?: number; creditPaise?: number };

export function validateHierarchyParent(
  groupId: string | null,
  parentGroupId: string | null,
  parents: Map<string, string | null>,
) {
  if (!parentGroupId) return { valid: true } as const;
  if (groupId && groupId === parentGroupId)
    return { valid: false, error: "A group cannot be its own parent" } as const;

  const seen = new Set<string>();
  let current: string | null | undefined = parentGroupId;
  while (current) {
    if (groupId && current === groupId)
      return {
        valid: false,
        error: "This parent would create a circular hierarchy",
      } as const;
    if (seen.has(current))
      return {
        valid: false,
        error: "The existing hierarchy contains a circular reference",
      } as const;
    seen.add(current);
    current = parents.get(current) ?? null;
  }
  return { valid: true } as const;
}

export function summarizeOpeningBalances(entries: OpeningBalanceEntry[]) {
  let totalDebitPaise = 0;
  let totalCreditPaise = 0;
  for (const entry of entries) {
    if (
      !isSafeAccountingPaise(entry.debitPaise || 0) ||
      !isSafeAccountingPaise(entry.creditPaise || 0)
    )
      throw new Error(
        `Opening balances must be safe integer paise values up to ${MAX_ACCOUNTING_PAISE}`,
      );
    totalDebitPaise += entry.debitPaise || 0;
    totalCreditPaise += entry.creditPaise || 0;
    if (
      !isSafeAccountingPaise(totalDebitPaise) ||
      !isSafeAccountingPaise(totalCreditPaise)
    )
      throw new Error(
        "Opening balance totals exceed the maximum accounting limit",
      );
  }
  return {
    totalDebitPaise,
    totalCreditPaise,
    differencePaise: totalDebitPaise - totalCreditPaise,
    balanced: totalDebitPaise === totalCreditPaise,
  };
}

export function validateOpeningBalanceAmounts(
  debitPaise: number,
  creditPaise: number,
) {
  if (
    !isSafeAccountingPaise(debitPaise) ||
    !isSafeAccountingPaise(creditPaise)
  ) {
    return {
      valid: false,
      error: `Opening balances must be safe integer paise values up to ${MAX_ACCOUNTING_PAISE}`,
    } as const;
  }
  if (debitPaise > 0 && creditPaise > 0)
    return {
      valid: false,
      error: "An opening balance cannot contain both debit and credit amounts",
    } as const;
  if (debitPaise === 0 && creditPaise === 0) return { valid: true } as const;
  return { valid: true } as const;
}
import { isSafeAccountingPaise, MAX_ACCOUNTING_PAISE } from "./accountingMoney";
