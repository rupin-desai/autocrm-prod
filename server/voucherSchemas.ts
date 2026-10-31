import { z } from "zod";
import { MAX_ACCOUNTING_PAISE } from "./accountingMoney";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const voucherType = z.enum(["journal", "payment", "receipt", "contra"]);
const paymentMode = z.enum(["Cash", "Bank Transfer", "UPI", "Cheque"]);

const line = z.object({
  ledgerAccountId: objectId,
  description: z.string().trim().max(300).optional().default(""),
  debitPaise: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_ACCOUNTING_PAISE)
    .default(0),
  creditPaise: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_ACCOUNTING_PAISE)
    .default(0),
});

export const voucherCreateSchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
  accountingPeriodId: objectId,
  voucherType,
  voucherDate: dateOnly,
  paymentMode: paymentMode.optional(),
  transactionReference: z.string().trim().max(120).optional().default(""),
  narration: z.string().trim().max(500).optional().default(""),
  referenceNumber: z.string().trim().max(120).optional().default(""),
  lines: z.array(line).min(2).max(100),
  sourceType: z.string().trim().max(80).optional().default(""),
  sourceId: objectId.optional().nullable(),
  sourceFingerprint: z.string().trim().max(200).optional().nullable(),
  idempotencyKey: z.string().trim().max(200).optional().nullable(),
});

export const voucherUpdateSchema = voucherCreateSchema
  .omit({ companyId: true, financialYearId: true, accountingPeriodId: true })
  .partial();

export const voucherListQuerySchema = z.object({
  companyId: objectId.optional(),
  financialYearId: objectId.optional(),
  voucherType: voucherType.optional(),
  status: z
    .enum([
      "draft",
      "pending_approval",
      "approved",
      "posted",
      "reversed",
      "cancelled",
    ])
    .optional(),
  fromDate: dateOnly.optional(),
  toDate: dateOnly.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const voucherActionSchema = z.object({
  reason: z.string().trim().max(500).optional().default(""),
});
export const voucherReverseSchema = voucherActionSchema.extend({
  voucherDate: dateOnly,
  accountingPeriodId: objectId,
});
