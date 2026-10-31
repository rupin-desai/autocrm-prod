import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    warehouseName: { type: String, required: true, trim: true },
    warehouseCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    address: { type: String, default: "" },
    description: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    ownershipStatus: {
      type: String,
      enum: ["verified", "unverified", "conflict"],
      default: "verified",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
schema.index({ companyId: 1, warehouseCode: 1 }, { unique: true });
schema.index({ companyId: 1, isDefault: 1 });
export const Warehouse =
  mongoose.models.Warehouse || mongoose.model("Warehouse", schema);
