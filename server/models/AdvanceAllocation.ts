import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    financialYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialYear",
      required: true,
    },
    advanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdvancePayment",
      required: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    amountPaise: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "reversed"],
      default: "pending",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);
schema.index({ companyId: 1, advanceId: 1, invoiceId: 1 }, { unique: true });
export const AdvanceAllocation =
  mongoose.models.AdvanceAllocation ||
  mongoose.model("AdvanceAllocation", schema);
