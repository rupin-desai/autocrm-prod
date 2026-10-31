import mongoose from "mongoose";

const financialYearSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    label: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "inactive", "closed"],
      default: "inactive",
    },
    isCurrent: { type: Boolean, default: false },
    closedAt: { type: Date },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

financialYearSchema.index({ companyId: 1, label: 1 }, { unique: true });
financialYearSchema.index({ companyId: 1, startDate: 1, endDate: 1 });
financialYearSchema.index({ companyId: 1, status: 1 });

export const FinancialYear =
  mongoose.models.FinancialYear ||
  mongoose.model("FinancialYear", financialYearSchema);
