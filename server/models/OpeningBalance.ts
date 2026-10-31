import mongoose from "mongoose";
import { MAX_ACCOUNTING_PAISE } from "../accountingMoney";

const openingBalanceSchema = new mongoose.Schema(
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
    ledgerAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
      required: true,
      index: true,
    },
    debitPaise: { type: Number, min: 0, max: MAX_ACCOUNTING_PAISE, default: 0 },
    creditPaise: {
      type: Number,
      min: 0,
      max: MAX_ACCOUNTING_PAISE,
      default: 0,
    },
    source: {
      type: String,
      enum: ["manual", "migration", "carry_forward"],
      default: "manual",
    },
    status: { type: String, enum: ["draft", "finalized"], default: "draft" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

openingBalanceSchema.index(
  { companyId: 1, financialYearId: 1, ledgerAccountId: 1 },
  { unique: true },
);
openingBalanceSchema.index({ companyId: 1, financialYearId: 1, status: 1 });

export const OpeningBalance =
  mongoose.models.OpeningBalance ||
  mongoose.model("OpeningBalance", openingBalanceSchema);
