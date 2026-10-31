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
    sourceType: {
      type: String,
      enum: [
        "purchase_bill",
        "supplier_payment",
        "supplier_advance",
        "advance_allocation",
        "purchase_return",
      ],
      required: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountingVoucher",
      required: true,
    },
    amountPaise: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["posted", "reversed"], default: "posted" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);
schema.index({ companyId: 1, sourceType: 1, sourceId: 1 }, { unique: true });
export const PurchaseAccountingSource =
  mongoose.models.PurchaseAccountingSource ||
  mongoose.model("PurchaseAccountingSource", schema);
