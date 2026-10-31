import mongoose from "mongoose";

const purchaseBillLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    description: { type: String, required: true },
    type: { type: String, enum: ["product", "service"], default: "product" },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "Nos" },
    ratePaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    taxablePaise: { type: Number, required: true, min: 0 },
    taxAmountPaise: { type: Number, default: 0, min: 0 },
    taxType: {
      type: String,
      enum: ["none", "cgst_sgst", "igst", "ambiguous"],
      default: "none",
    },
    cgstPaise: { type: Number, default: 0, min: 0 },
    sgstPaise: { type: Number, default: 0, min: 0 },
    igstPaise: { type: Number, default: 0, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const purchaseBillSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    financialYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialYear",
      required: true,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    supplierInvoiceNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    supplierInvoiceDate: { type: Date, required: true },
    internalBillNumber: { type: String, required: true, trim: true },
    lines: { type: [purchaseBillLineSchema], default: [] },
    additionalExpensesPaise: { type: Number, default: 0, min: 0 },
    subtotalPaise: { type: Number, required: true, min: 0 },
    taxAmountPaise: { type: Number, default: 0, min: 0 },
    grandTotalPaise: { type: Number, required: true, min: 0 },
    settledPaise: { type: Number, required: true, min: 0, default: 0 },
    dueDate: { type: Date },
    notes: { type: String, default: "" },
    attachments: [{ url: String, filename: String }],
    status: {
      type: String,
      enum: [
        "draft",
        "pending_approval",
        "approved",
        "posted",
        "cancelled",
        "reversed",
      ],
      default: "draft",
      index: true,
    },
    stockReceiptStatus: {
      type: String,
      enum: ["not_applicable", "pending", "recorded"],
      default: "not_applicable",
    },
    postedVoucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountingVoucher",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true },
);

purchaseBillSchema.index(
  { companyId: 1, supplierInvoiceNumber: 1 },
  { unique: true },
);
purchaseBillSchema.index(
  { companyId: 1, internalBillNumber: 1 },
  { unique: true },
);
purchaseBillSchema.index({
  companyId: 1,
  supplierId: 1,
  status: 1,
  supplierInvoiceDate: -1,
});

purchaseBillSchema.pre("save", async function (next) {
  const current: any = this.isNew
    ? null
    : await (this.constructor as any)
        .findById(this._id)
        .select("status")
        .lean();
  if (
    current?.status === "posted" &&
    this.isModified() &&
    !(this as any).$__.saveOptions?.accountingReversal
  )
    return next(
      new Error("Posted purchase bills are immutable; use reversal workflow"),
    );
  next();
});

export const PurchaseBill =
  mongoose.models.PurchaseBill ||
  mongoose.model("PurchaseBill", purchaseBillSchema);
