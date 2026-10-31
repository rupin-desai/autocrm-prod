import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  legalName: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  state: z.string().trim().max(100).optional().default(""),
  pinCode: z.string().trim().max(20).optional().default(""),
  contactName: z.string().trim().max(150).optional().default(""),
  contactEmail: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .default(""),
  contactPhone: z.string().trim().max(30).optional().default(""),
  gstin: z.string().trim().max(20).optional().default(""),
  pan: z.string().trim().max(20).optional().default(""),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export const companyUpdateSchema = companyCreateSchema.partial();

export const financialYearCreateSchema = z.object({
  companyId: objectId,
  label: z.string().trim().min(4).max(20),
  startDate: dateOnly,
  endDate: dateOnly,
  status: z.enum(["active", "inactive"]).optional().default("inactive"),
});

export const financialYearUpdateSchema = z.object({
  label: z.string().trim().min(4).max(20).optional(),
  status: z.enum(["active", "inactive", "closed"]).optional(),
});

export const contextSchema = z.object({
  companyId: objectId,
  financialYearId: objectId.optional().nullable(),
});

export const periodUpdateSchema = z.object({
  status: z.enum(["open", "closed", "locked"]),
});

const numberingSchema = z.object({
  prefix: z.string().trim().min(1).max(10),
  padding: z.coerce.number().int().min(1).max(10),
  includeFinancialYear: z.boolean(),
});

export const accountingSettingsUpdateSchema = z.object({
  voucherNumbering: z
    .object({
      journal: numberingSchema,
      payment: numberingSchema,
      receipt: numberingSchema,
      contra: numberingSchema,
    })
    .optional(),
});

export function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

export function dateOnlyValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
