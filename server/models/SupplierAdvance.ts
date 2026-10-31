import mongoose from "mongoose";

const schema = new mongoose.Schema(
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
    amountPaise: { type: Number, required: true, min: 1 },
    allocatedPaise: { type: Number, required: true, min: 0, default: 0 },
    paymentMode: {
      type: String,
      enum: ["Cash", "Bank Transfer", "UPI", "Card", "Cheque"],
      required: true,
    },
    receivedDate: { type: Date, required: true },
    transactionReference: { type: String, default: "" },
    idempotencyKey: { type: String },
    status: {
      type: String,
      enum: ["recorded", "posted", "reversed", "cancelled"],
      default: "recorded",
      index: true,
    },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountingVoucher",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);
schema.index({ companyId: 1, supplierId: 1, createdAt: -1 });
schema.index(
  { companyId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $exists: true, $type: "string" },
    },
  },
);
export const SupplierAdvance =
  mongoose.models.SupplierAdvance || mongoose.model("SupplierAdvance", schema);
