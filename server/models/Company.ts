import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pinCode: { type: String, default: "" },
    country: { type: String, default: "India" },
    contactName: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    gstin: { type: String, default: "" },
    pan: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    authorizedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

companySchema.index({ name: 1 });
companySchema.index({ status: 1 });
companySchema.index({ authorizedUserIds: 1 });

export const Company =
  mongoose.models.Company || mongoose.model("Company", companySchema);
