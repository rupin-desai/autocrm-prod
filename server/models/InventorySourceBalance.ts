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
      enum: ["purchase_bill", "invoice"],
      required: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    sourceLineId: { type: mongoose.Schema.Types.ObjectId },
    limitQuantity: { type: Number, required: true, min: 0 },
    receivedQuantity: { type: Number, required: true, min: 0, default: 0 },
    issuedQuantity: { type: Number, required: true, min: 0, default: 0 },
    returnedQuantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

schema.index(
  { companyId: 1, sourceType: 1, sourceId: 1, productId: 1 },
  { unique: true },
);
export const InventorySourceBalance =
  mongoose.models.InventorySourceBalance ||
  mongoose.model("InventorySourceBalance", schema);
