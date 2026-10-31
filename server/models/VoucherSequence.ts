import mongoose from "mongoose";

const voucherSequenceSchema = new mongoose.Schema(
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
    voucherType: {
      type: String,
      enum: ["journal", "payment", "receipt", "contra", "reversal"],
      required: true,
    },
    nextNumber: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

voucherSequenceSchema.index(
  { companyId: 1, financialYearId: 1, voucherType: 1 },
  { unique: true },
);

export const VoucherSequence =
  mongoose.models.VoucherSequence ||
  mongoose.model("VoucherSequence", voucherSequenceSchema);
