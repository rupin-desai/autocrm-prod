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
    sourceType: {
      type: String,
      enum: [
        "invoice",
        "invoice_payment",
        "customer_advance",
        "advance_allocation",
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
schema.index({ companyId: 1, voucherId: 1 });
export const SalesAccountingSource =
  mongoose.models.SalesAccountingSource ||
  mongoose.model("SalesAccountingSource", schema);
