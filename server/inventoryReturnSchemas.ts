import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
export const returnEligibilitySchema = z
  .object({
    companyId: objectId,
    financialYearId: objectId,
    purchaseBillId: objectId.optional(),
    invoiceId: objectId.optional(),
  })
  .refine(
    (value) => Boolean(value.purchaseBillId) !== Boolean(value.invoiceId),
    "Provide exactly one source document",
  );
const line = z.object({
  productId: objectId,
  purchaseBillLineReference: objectId.optional(),
  originalReceiptMovementId: objectId,
  warehouseId: objectId,
  returnQuantity: z.number().positive().finite(),
  originalUnitCostPaise: z.number().int().nonnegative().safe(),
  returnValuePaise: z.number().int().positive().safe(),
});
const salesLine = z.object({
  invoiceLineReference: z.string().trim().min(1).max(120),
  originalSalesIssueMovementId: objectId,
  productId: objectId,
  warehouseId: objectId,
  returnQuantity: z.number().positive().finite(),
  originalIssueUnitCostPaise: z.number().int().nonnegative().safe(),
  returnValuePaise: z.number().int().positive().safe(),
});
export const purchaseReturnInventorySchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
  accountingPeriodId: objectId,
  supplierId: objectId,
  purchaseBillId: objectId,
  returnNumber: z.string().trim().min(1).max(80),
  amountPaise: z.number().int().positive().safe(),
  taxAmountPaise: z.number().int().nonnegative().safe().default(0),
  reason: z.string().trim().min(1).max(500),
  movementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotencyKey: z.string().trim().min(8).max(160),
  lines: z.array(line).min(1),
});
export const salesReturnInventorySchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
  accountingPeriodId: objectId,
  invoiceId: objectId,
  returnNumber: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(500),
  movementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotencyKey: z.string().trim().min(8).max(160),
  lines: z.array(salesLine).min(1),
});
export const returnStatusSchema = z.object({
  status: z.enum(["submitted", "approved", "cancelled"]),
});
