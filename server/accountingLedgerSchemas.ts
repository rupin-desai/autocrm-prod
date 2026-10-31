import { z } from "zod";
import { MAX_ACCOUNTING_PAISE } from "./accountingMoney";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const category = z.enum([
  "assets",
  "liabilities",
  "equity",
  "income",
  "expenses",
]);
const balance = z.enum(["debit", "credit"]);

export const accountGroupCreateSchema = z.object({
  companyId: objectId,
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/),
  parentGroupId: objectId.nullable().optional().default(null),
  rootCategory: category,
  normalBalance: balance,
  description: z.string().trim().max(500).optional().default(""),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export const accountGroupUpdateSchema = accountGroupCreateSchema
  .omit({ companyId: true })
  .partial();

export const ledgerCreateSchema = z.object({
  companyId: objectId,
  financialYearId: objectId.optional().nullable(),
  groupId: objectId,
  code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(160),
  ledgerType: z
    .enum(["general", "cash", "bank", "customer", "supplier"])
    .default("general"),
  description: z.string().trim().max(500).optional().default(""),
  openingBalancePaise: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_ACCOUNTING_PAISE)
    .default(0),
  openingBalanceType: z.enum(["debit", "credit", "none"]).default("none"),
  customerId: objectId.optional().nullable(),
  supplierId: objectId.optional().nullable(),
  bankName: z.string().trim().max(120).optional().default(""),
  accountNumberLast4: z
    .string()
    .trim()
    .max(4)
    .regex(/^$|^\d{4}$/)
    .optional()
    .default(""),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export const ledgerUpdateSchema = ledgerCreateSchema
  .omit({ companyId: true })
  .partial();

export const openingBalanceSchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
  ledgerAccountId: objectId,
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
  source: z
    .enum(["manual", "migration", "carry_forward"])
    .optional()
    .default("manual"),
});

export const openingBalanceFinalizeSchema = z.object({
  companyId: objectId,
  financialYearId: objectId,
});

export const ledgerQuerySchema = z.object({
  companyId: objectId.optional(),
  financialYearId: objectId.optional(),
  groupId: objectId.optional(),
  ledgerType: z
    .enum(["general", "cash", "bank", "customer", "supplier"])
    .optional(),
  status: z.enum(["active", "inactive"]).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
