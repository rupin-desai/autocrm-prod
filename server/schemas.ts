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
  // Requirement 1: OTP is not compulsory. Staff answer Yes/No at registration.
  // OTP is opt-in: only an explicit true sends one.
  otpRequired: z.boolean().optional().default(false),
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

// ---------------------------------------------------------------------------
// Requirements v2 modules
// ---------------------------------------------------------------------------

const objectIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const optionalObjectId = objectIdString.optional().nullable();

const paymentModeEnum = z.enum(['UPI', 'Cash', 'Card', 'Net Banking', 'Cheque']);

export const insertAdvancePaymentSchema = z.object({
  customerId: objectIdString,
  vehicleId: optionalObjectId,
  vehicleNumber: z.string().optional(),
  itemOrService: z.string().min(1, "Item or service is required"),
  relatedWork: z.string().optional(),
  serviceVisitId: optionalObjectId,
  orderId: optionalObjectId,
  amount: z.coerce.number().positive("Advance amount must be greater than 0"),
  paymentMode: paymentModeEnum.default('Cash'),
  transactionId: z.string().optional(),
  receivedDate: z.coerce.date().optional(),
  reminderDays: z.coerce.number().int().min(0).max(365).default(15),
  reminderEnabled: z.boolean().optional().default(true),
  notes: z.string().optional(),
});

export const updateAdvancePaymentSchema = insertAdvancePaymentSchema
  .partial()
  .omit({ customerId: true })
  .extend({
    status: z.enum(['pending', 'adjusted', 'refunded', 'cancelled']).optional(),
  });

export const updateAdvanceReminderSchema = z
  .object({
    reminderDays: z.coerce.number().int().min(0).max(365).optional(),
    reminderEnabled: z.boolean().optional(),
  })
  .refine((d) => d.reminderDays !== undefined || d.reminderEnabled !== undefined, {
    message: 'Nothing to update',
  });

const inquiryItemSchema = z.object({
  productId: optionalObjectId,
  name: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().int().min(1).default(1),
  expectedPrice: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

export const insertInquirySchema = z.object({
  customerId: optionalObjectId,
  customerName: z.string().min(1, "Customer name is required"),
  customerMobile: z.string().optional(),
  vehicleId: optionalObjectId,
  vehicleNumber: z.string().optional(),
  vehicleBrand: z.string().optional(),
  vehicleModel: z.string().optional(),
  items: z.array(inquiryItemSchema).min(1, "At least one inquiry item is required"),
  inquiryDate: z.coerce.date().optional(),
  salesmanId: optionalObjectId,
  salesmanName: z.string().optional(),
  notes: z.string().optional(),
  reminderDays: z.coerce.number().int().min(0).max(365).default(7),
  reminderEnabled: z.boolean().optional().default(true),
});

export const updateInquirySchema = insertInquirySchema.partial().extend({
  status: z.enum(['open', 'quoted', 'converted', 'lost', 'closed']).optional(),
});

export const insertWarrantyClaimSchema = z.object({
  customerId: optionalObjectId,
  customerName: z.string().min(1, "Customer name is required"),
  customerMobile: z.string().optional(),
  vehicleId: optionalObjectId,
  vehicleNumber: z.string().optional(),
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().int().min(1).default(1),
  problem: z.string().min(1, "Problem description is required"),
  receivedDate: z.coerce.date().optional(),
  invoiceId: optionalObjectId,
  productId: optionalObjectId,
  reminderDays: z.coerce.number().int().min(0).max(365).default(15),
  reminderEnabled: z.boolean().optional().default(true),
  notes: z.string().optional(),
});

export const updateWarrantyClaimSchema = insertWarrantyClaimSchema.partial().extend({
  status: z
    .enum(['received', 'with_vendor', 'returned_from_vendor', 'resolved', 'delivered_to_customer', 'cancelled'])
    .optional(),
  resolution: z.string().optional(),
});

export const vendorDispatchSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  vendorContact: z.string().optional(),
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().int().min(1).default(1),
  givenDate: z.coerce.date().optional(),
  problem: z.string().optional(),
  narration: z.string().optional(),
  expectedReturnDate: z.coerce.date().optional().nullable(),
  reminderDays: z.coerce.number().int().min(0).max(365).default(15),
});

export const resolveVendorDispatchSchema = z.object({
  returnedDate: z.coerce.date().optional(),
  resolution: z.string().optional(),
  status: z.enum(['returned', 'rejected']).default('returned'),
});

// Parts on a service visit job card. productId is optional so items quoted
// or inquired about outside the catalogue can still be tracked.
export const servicePartSchema = z.object({
  productId: optionalObjectId,
  name: z.string().trim().min(1, "Part name is required"),
  quantity: z.coerce.number().int().min(1).default(1),
  price: z.coerce.number().min(0).default(0),
});

export const updateServiceVisitPartsSchema = z.object({
  partsUsed: z.array(servicePartSchema).optional(),
  partsSource: z.enum(['quotation', 'inquiry', 'vehicle', 'manual']).optional().nullable(),
  quotationId: optionalObjectId,
  inquiryId: optionalObjectId,
});

const quotationItemSchema = z.object({
  productId: optionalObjectId,
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  rate: z.coerce.number().min(0, "Rate must be 0 or more"),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  taxPercent: z.coerce.number().min(0).default(0),
});

export const insertQuotationSchema = z.object({
  customerId: optionalObjectId,
  customerName: z.string().min(1, "Customer name is required"),
  customerMobile: z.string().min(10, "Mobile number is required"),
  vehicleId: optionalObjectId,
  vehicleNumber: z.string().optional(),
  vehicleBrand: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleVariant: z.string().optional(),
  items: z.array(quotationItemSchema).min(1, "At least one item is required"),
  quotationDate: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional().nullable(),
  expectedVisitDate: z.coerce.date().optional().nullable(),
  reminderDays: z.coerce.number().int().min(0).max(365).default(7),
  reminderEnabled: z.boolean().optional().default(true),
  inquiryId: optionalObjectId,
  notes: z.string().optional(),
  terms: z.string().optional(),
});

export const updateQuotationSchema = insertQuotationSchema.partial().extend({
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
});

export const websiteVisibilitySchema = z.object({
  showOnWebsite: z.boolean(),
  websiteTitle: z.string().optional(),
  websiteDescription: z.string().optional(),
  websitePrice: z.coerce.number().min(0).optional().nullable(),
});

export const bulkWebsiteVisibilitySchema = z.object({
  productIds: z.array(objectIdString).min(1, "Select at least one product"),
  showOnWebsite: z.boolean(),
});

// Shared date-period filter used by the dashboard and the list endpoints.
export const periodQuerySchema = z.object({
  period: z.enum(['today', 'yesterday', 'week', 'month', 'year', 'custom']).optional(),
  date: z.string().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export type InsertAdvancePayment = z.infer<typeof insertAdvancePaymentSchema>;
export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type InsertWarrantyClaim = z.infer<typeof insertWarrantyClaimSchema>;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
