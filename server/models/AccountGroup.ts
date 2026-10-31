import mongoose from "mongoose";

const accountGroupSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    parentGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountGroup",
      default: null,
    },
    rootCategory: {
      type: String,
      enum: ["assets", "liabilities", "equity", "income", "expenses"],
      required: true,
    },
    normalBalance: { type: String, enum: ["debit", "credit"], required: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    isSystemGroup: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

accountGroupSchema.index({ companyId: 1, code: 1 }, { unique: true });
accountGroupSchema.index({ companyId: 1, parentGroupId: 1, name: 1 });
accountGroupSchema.index({ companyId: 1, rootCategory: 1, status: 1 });

export const AccountGroup =
  mongoose.models.AccountGroup ||
  mongoose.model("AccountGroup", accountGroupSchema);
