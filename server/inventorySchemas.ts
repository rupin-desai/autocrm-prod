import { z } from "zod";
import mongoose from "mongoose";

const objectId = z
  .string()
  .refine((value) => mongoose.isValidObjectId(value), "Invalid id");
const quantity = z.number().positive().finite();
const paise = z.number().int().nonnegative().safe();
export const warehouseSchema = z.object({
  companyId: objectId,
  warehouseName: z.string().trim().min(1).max(160),
  warehouseCode: z.string().trim().min(1).max(30),
  address: z.string().max(500).optional().default(""),
  description: z.string().max(1000).optional().default(""),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});
export const inventoryMappingSchema = z
  .object({ companyId: objectId })
  .catchall(objectId.optional().nullable());
export const movementSchema = z.object({
  financialYearId: objectId,
  accountingPeriodId: objectId,
  productId: objectId,
  warehouseId: objectId,
  movementType: z.enum([
    "opening_stock",
    "purchase_receipt",
    "sales_issue",
    "purchase_return",
    "sales_return",
    "adjustment_in",
    "adjustment_out",
  ]),
  quantity: quantity,
  unitCostPaise: paise,
  sourceType: z.string().trim().min(1).max(80),
  sourceId: objectId,
  sourceReference: z.string().max(160).optional().default(""),
  movementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotencyKey: z.string().trim().min(8).max(160),
});
export const transferSchema = z.object({
  financialYearId: objectId,
  accountingPeriodId: objectId,
  productId: objectId,
  sourceWarehouseId: objectId,
  destinationWarehouseId: objectId,
  quantity,
  unitCostPaise: paise,
  movementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotencyKey: z.string().trim().min(8).max(160),
  sourceReference: z.string().max(160).optional().default(""),
});
export const operationSchema = z.object({
  financialYearId: objectId,
  accountingPeriodId: objectId,
  operationType: z.enum([
    "purchase_receipt",
    "sales_issue",
    "purchase_return",
    "sales_return",
    "stock_adjustment",
    "opening_stock",
  ]),
  sourceType: z.string().trim().min(1).max(80),
  sourceId: objectId,
  warehouseId: objectId,
  items: z
    .array(
      z.object({
        productId: objectId,
        sourceLineId: objectId.optional(),
        quantity,
        unitCostPaise: paise,
      }),
    )
    .min(1),
  reason: z.string().max(500).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
  idempotencyKey: z.string().trim().min(8).max(160),
  movementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["draft", "submitted"]).optional().default("draft"),
});
export const operationStatusSchema = z.object({
  status: z.enum(["submitted", "approved", "cancelled"]),
});
