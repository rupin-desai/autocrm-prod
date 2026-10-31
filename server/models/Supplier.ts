import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    ownershipStatus: {
      type: String,
      enum: ["verified", "unverified", "conflict"],
      default: "verified",
      index: true,
    },
    supplierCode: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    billingAddress: { type: String, default: "" },
    shippingAddress: { type: String, default: "" },
    gstin: { type: String, default: "" },
    pan: { type: String, default: "" },
    state: { type: String, default: "" },
    stateCode: { type: String, default: "" },
    ledgerAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    openingBalanceReference: { type: String, default: "" },
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

supplierSchema.index({ companyId: 1, supplierCode: 1 }, { unique: true });
supplierSchema.index({ companyId: 1, name: 1 });
supplierSchema.index({ companyId: 1, status: 1 });

export const Supplier =
  mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);
