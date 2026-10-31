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
    advanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierAdvance",
      required: true,
    },
    purchaseBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseBill",
      required: true,
    },
    amountPaise: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "reversed"],
      default: "pending",
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
schema.index(
  { companyId: 1, advanceId: 1, purchaseBillId: 1 },
  { unique: true },
);
export const SupplierAdvanceAllocation =
  mongoose.models.SupplierAdvanceAllocation ||
  mongoose.model("SupplierAdvanceAllocation", schema);
