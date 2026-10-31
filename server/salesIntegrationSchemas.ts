import { z } from "zod";
const id = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
export const advanceAllocationSchema = z.object({
  invoiceId: id,
  amountPaise: z.number().int().positive(),
});
