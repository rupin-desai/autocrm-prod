import mongoose from "mongoose";

const accountingPeriodSchema = new mongoose.Schema(
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
    periodNumber: { type: Number, required: true, min: 1, max: 12 },
    label: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["open", "closed", "locked"],
      default: "open",
    },
    closedAt: { type: Date },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lockedAt: { type: Date },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

accountingPeriodSchema.index(
  { financialYearId: 1, periodNumber: 1 },
  { unique: true },
);
accountingPeriodSchema.index({ companyId: 1, startDate: 1, endDate: 1 });

export const AccountingPeriod =
  mongoose.models.AccountingPeriod ||
  mongoose.model("AccountingPeriod", accountingPeriodSchema);
