import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sourceLineId: { type: mongoose.Schema.Types.ObjectId },
    quantity: { type: Number, required: true, min: 0 },
    unitCostPaise: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
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
    accountingPeriodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountingPeriod",
      required: true,
    },
    operationType: {
      type: String,
      enum: [
        "purchase_receipt",
        "sales_issue",
        "purchase_return",
        "sales_return",
        "stock_adjustment",
        "opening_stock",
      ],
      required: true,
    },
    sourceType: { type: String, required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    items: { type: [itemSchema], required: true },
    status: {
      type: String,
      enum: [
        "draft",
        "submitted",
        "approved",
        "posted",
        "reversed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    reason: { type: String, default: "" },
    notes: { type: String, default: "" },
    movementDate: { type: Date, default: Date.now },
    idempotencyKey: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postedAt: { type: Date },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountingVoucher",
    },
  },
  { timestamps: true },
);
schema.index({ companyId: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ companyId: 1, operationType: 1, sourceType: 1, sourceId: 1 });
export const InventoryOperation =
  mongoose.models.InventoryOperation ||
  mongoose.model("InventoryOperation", schema);
