import { z } from "zod";
import mongoose from "mongoose";

const objectId = z
  .string()
  .refine((value) => mongoose.isValidObjectId(value), "Invalid id");
const paise = z.number().int().nonnegative().safe();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const supplierSchema = z.object({
  companyId: objectId,
  supplierCode: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(160),
  contactPerson: z.string().trim().max(160).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  email: z.string().trim().email().optional().or(z.literal("")).default(""),
  billingAddress: z.string().max(500).optional().default(""),
  shippingAddress: z.string().max(500).optional().default(""),
  gstin: z.string().trim().max(20).optional().default(""),
  pan: z.string().trim().max(20).optional().default(""),
  state: z.string().trim().max(80).optional().default(""),
  stateCode: z.string().trim().max(10).optional().default(""),
  ledgerAccountId: objectId.optional().nullable(),
  openingBalanceReference: z.string().max(120).optional().default(""),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export const purchaseMappingSchema = z
  .object({
    companyId: objectId,
  })
  .catchall(objectId.optional().nullable());

const line = z.object({
  productId: objectId.optional().nullable(),
  description: z.string().trim().min(1),
  type: z.enum(["product", "service"]).default("product"),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).max(30).default("Nos"),
  ratePaise: paise,
  discountPaise: paise.default(0),
  taxablePaise: paise,
  taxAmountPaise: paise.default(0),
  taxType: z.enum(["none", "cgst_sgst", "igst", "ambiguous"]).default("none"),
  cgstPaise: paise.default(0),
  sgstPaise: paise.default(0),
  igstPaise: paise.default(0),
  totalPaise: paise,
});

export const purchaseBillSchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
  supplierId: objectId,
  supplierInvoiceNumber: z.string().trim().min(1).max(80),
  supplierInvoiceDate: date,
  internalBillNumber: z.string().trim().min(1).max(80),
  lines: z.array(line).min(1),
  additionalExpensesPaise: paise.default(0),
  subtotalPaise: paise,
  taxAmountPaise: paise.default(0),
  grandTotalPaise: paise,
  dueDate: date.optional().nullable(),
  notes: z.string().max(2000).optional().default(""),
  attachments: z
    .array(z.object({ url: z.string().url(), filename: z.string().max(255) }))
    .optional()
    .default([]),
  status: z.enum(["draft", "pending_approval"]).optional().default("draft"),
});

export const purchaseStatusSchema = z.object({
  status: z.enum(["draft", "pending_approval", "approved", "cancelled"]),
});
export const supplierPaymentSchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
  supplierId: objectId,
  amountPaise: paise.refine((v) => v > 0, "Amount must be positive"),
  paymentMode: z.enum(["Cash", "Bank Transfer", "UPI", "Card", "Cheque"]),
  paymentDate: date,
  transactionReference: z.string().max(120).optional().default(""),
  idempotencyKey: z.string().trim().min(8).max(160),
  allocations: z
    .array(
      z.object({
        purchaseBillId: objectId,
        amountPaise: paise.refine((v) => v > 0),
      }),
    )
    .default([]),
});
export const supplierAdvanceSchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
  supplierId: objectId,
  amountPaise: paise.refine((v) => v > 0),
  paymentMode: z.enum(["Cash", "Bank Transfer", "UPI", "Card", "Cheque"]),
  receivedDate: date,
  transactionReference: z.string().max(120).optional().default(""),
  idempotencyKey: z.string().trim().min(8).max(160),
});
export const supplierAdvanceAllocationSchema = z.object({
  purchaseBillId: objectId,
  amountPaise: paise.refine((v) => v > 0),
});
export const purchaseReturnSchema = z
  .object({
    companyId: objectId,
    financialYearId: objectId,
    supplierId: objectId,
    purchaseBillId: objectId,
    returnNumber: z.string().trim().min(1).max(80),
    amountPaise: paise.refine((v) => v > 0),
    taxAmountPaise: paise.default(0),
    reason: z.string().trim().min(1).max(500),
  })
  .superRefine((value, ctx) => {
    if (value.taxAmountPaise > value.amountPaise)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taxAmountPaise"],
        message: "Tax cannot exceed return amount",
      });
  });
