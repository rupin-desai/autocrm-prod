import { isSafeAccountingPaise, MAX_ACCOUNTING_PAISE } from "./accountingMoney";

export type VoucherLineInput = {
  ledgerAccountId: string;
  debitPaise?: number;
  creditPaise?: number;
};

export function calculateVoucherTotals(lines: VoucherLineInput[]) {
  // A balanced voucher must have one-sided lines and equal debit/credit
  // totals. Amounts stay in integer paise to avoid floating-point errors.
  let totalDebitPaise = 0;
  let totalCreditPaise = 0;
  for (const line of lines) {
    const debit = line.debitPaise ?? 0;
    const credit = line.creditPaise ?? 0;
    if (!isSafeAccountingPaise(debit) || !isSafeAccountingPaise(credit)) {
      return {
        valid: false,
        error: `Voucher amounts must be safe integer paise values up to ${MAX_ACCOUNTING_PAISE}`,
      } as const;
    }
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      return {
        valid: false,
        error:
          "Each voucher line must contain either a debit or a credit amount",
      } as const;
    }
    totalDebitPaise += debit;
    totalCreditPaise += credit;
    if (
      !isSafeAccountingPaise(totalDebitPaise) ||
      !isSafeAccountingPaise(totalCreditPaise)
    )
      return {
        valid: false,
        error: "Voucher total exceeds the maximum accounting limit",
      } as const;
  }
  if (lines.length < 2)
    return {
      valid: false,
      error: "A voucher requires at least two lines",
    } as const;
  if (totalDebitPaise === 0 || totalCreditPaise === 0)
    return {
      valid: false,
      error: "A voucher requires at least one debit and one credit",
    } as const;
  if (totalDebitPaise !== totalCreditPaise)
    return {
      valid: false,
      error: "Total debit and credit must be equal",
    } as const;
  return { valid: true, totalDebitPaise, totalCreditPaise } as const;
}

export function validateVoucherType(
  type: string,
  paymentMode: string | undefined,
  lines: Array<VoucherLineInput & { ledgerType?: string }>,
) {
  // Payment, receipt, and contra vouchers have stricter settlement-ledger
  // rules than a general journal voucher.
  const cashBank = lines.filter(
    (line) => line.ledgerType === "cash" || line.ledgerType === "bank",
  );
  if (type === "contra") {
    if (cashBank.length !== lines.length)
      return "Contra vouchers may contain only cash and bank ledgers";
    if (cashBank.length < 2)
      return "Contra vouchers require at least two cash or bank ledgers";
  }
  if (type === "payment" || type === "receipt") {
    if (!paymentMode) return `${type} vouchers require a payment mode`;
    const requiredType = paymentMode === "Cash" ? "cash" : "bank";
    const settlementLines = lines.filter(
      (line) => line.ledgerType === requiredType,
    );
    if (settlementLines.length !== 1)
      return `${type} vouchers require exactly one ${requiredType} ledger for ${paymentMode}`;
    if (cashBank.length !== 1)
      return `${type} vouchers may contain exactly one cash or bank settlement ledger`;
    const settlement = settlementLines[0];
    if (
      type === "payment" &&
      !(settlement.creditPaise && settlement.creditPaise > 0)
    )
      return "Payment vouchers must credit the cash or bank ledger";
    if (
      type === "receipt" &&
      !(settlement.debitPaise && settlement.debitPaise > 0)
    )
      return "Receipt vouchers must debit the cash or bank ledger";
  }
  return null;
}

export function nextVoucherNumber(
  prefix: string,
  yearLabel: string,
  sequence: number,
  padding: number,
  includeFinancialYear = true,
) {
  const number = String(sequence).padStart(padding, "0");
  return includeFinancialYear
    ? `${prefix}/${yearLabel}/${number}`
    : `${prefix}/${number}`;
}
