import { z } from "zod";

export const insertCustomerSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  mobileNumber: z.string().optional().default(""),
  alternativeNumber: z.string().optional(),
  email: z.union([z.string().email("Invalid email address"), z.literal("")]),
  address: z.string().optional(),
  city: z.string().optional(),
  taluka: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  referralSource: z.string().optional(),
  walkInNoPhone: z.boolean().optional().default(false),
  estimatedBillAmount: z.coerce.number().optional(),
}).refine((data) => {
  const mobile = (data.mobileNumber || "").trim();
  if (data.walkInNoPhone) {
    return !mobile && Number(data.estimatedBillAmount || 0) < 1000;
  }
  return mobile.length >= 10;
}, {
  message: "Mobile number is required unless this is low-value walk-in billing (< 1000) without phone.",
  path: ["mobileNumber"],
});

const warrantyCardSchema = z.object({
  partId: z.string(),
  partName: z.string(),
  fileData: z.string(),
});

const selectedPartSchema = z.object({
  partId: z.string(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
});

export const insertVehicleSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  vehicleNumber: z.string().optional(),
  vehicleBrand: z.string().min(1, "Vehicle brand is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  customModel: z.string().optional(),
  variant: z.string().optional(),
  color: z.string().optional(),
  yearOfPurchase: z.number().optional(),
  vehiclePhoto: z.string().min(1, "Vehicle photo is required"),
  isNewVehicle: z.boolean().optional(),
  chassisNumber: z.string().optional(),
  selectedParts: z.array(selectedPartSchema).optional(),
  warrantyCards: z.array(warrantyCardSchema).optional(),
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
