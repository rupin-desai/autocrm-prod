import mongoose from "mongoose";

const ledgerAccountSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountGroup",
      required: true,
      index: true,
    },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    ledgerType: {
      type: String,
      enum: ["general", "cash", "bank", "customer", "supplier"],
      default: "general",
    },
    description: { type: String, default: "" },
    openingBalancePaise: { type: Number, min: 0, default: 0 },
    openingBalanceType: {
      type: String,
      enum: ["debit", "credit", "none"],
      default: "none",
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegistrationCustomer",
    },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    bankName: { type: String, default: "" },
    accountNumberLast4: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

ledgerAccountSchema.index({ companyId: 1, code: 1 }, { unique: true });
ledgerAccountSchema.index({ companyId: 1, groupId: 1, status: 1 });
ledgerAccountSchema.index({ companyId: 1, ledgerType: 1, status: 1 });
ledgerAccountSchema.index({ companyId: 1, customerId: 1 }, { sparse: true });
ledgerAccountSchema.index({ companyId: 1, supplierId: 1 }, { sparse: true });

export const LedgerAccount =
  mongoose.models.LedgerAccount ||
  mongoose.model("LedgerAccount", ledgerAccountSchema);
