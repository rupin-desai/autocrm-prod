import mongoose from "mongoose";

const voucherNumberingSchema = new mongoose.Schema(
  {
    prefix: { type: String, required: true, trim: true },
    padding: { type: Number, required: true, min: 1, max: 10 },
    includeFinancialYear: { type: Boolean, default: true },
  },
  { _id: false },
);

const accountingSettingsSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
    },
    country: { type: String, default: "India" },
    currencyCode: { type: String, enum: ["INR"], default: "INR" },
    currencyMinorUnit: { type: Number, enum: [2], default: 2 },
    financialYearStartMonth: { type: Number, enum: [4], default: 4 },
    financialYearStartDay: { type: Number, enum: [1], default: 1 },
    financialYearEndMonth: { type: Number, enum: [3], default: 3 },
    financialYearEndDay: { type: Number, enum: [31], default: 31 },
    voucherNumbering: {
      journal: {
        type: voucherNumberingSchema,
        default: () => ({
          prefix: "JV",
          padding: 4,
          includeFinancialYear: true,
        }),
      },
      payment: {
        type: voucherNumberingSchema,
        default: () => ({
          prefix: "PV",
          padding: 4,
          includeFinancialYear: true,
        }),
      },
      receipt: {
        type: voucherNumberingSchema,
        default: () => ({
          prefix: "RV",
          padding: 4,
          includeFinancialYear: true,
        }),
      },
      contra: {
        type: voucherNumberingSchema,
        default: () => ({
          prefix: "CV",
          padding: 4,
          includeFinancialYear: true,
        }),
      },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

accountingSettingsSchema.index({ companyId: 1 }, { unique: true });

export const AccountingSettings =
  mongoose.models.AccountingSettings ||
  mongoose.model("AccountingSettings", accountingSettingsSchema);
