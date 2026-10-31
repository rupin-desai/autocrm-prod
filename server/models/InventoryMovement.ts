import mongoose from "mongoose";
import { MAX_ACCOUNTING_PAISE } from "../accountingMoney";

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
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    movementType: {
      type: String,
      enum: [
        "opening_stock",
        "purchase_receipt",
        "sales_issue",
        "purchase_return",
        "sales_return",
        "adjustment_in",
        "adjustment_out",
        "transfer_in",
        "transfer_out",
      ],
      required: true,
    },
    quantityIn: { type: Number, required: true, min: 0 },
    quantityOut: { type: Number, required: true, min: 0 },
    unitCostPaise: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_ACCOUNTING_PAISE,
    },
    totalValuePaise: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_ACCOUNTING_PAISE,
    },
    sourceType: { type: String, required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sourceReference: { type: String, default: "" },
    movementDate: { type: Date, required: true },
    idempotencyKey: { type: String },
    status: {
      type: String,
      enum: ["posted", "reversed"],
      default: "posted",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);
schema.index(
  { companyId: 1, sourceType: 1, sourceId: 1, productId: 1, warehouseId: 1 },
  { unique: true },
);
schema.index({ companyId: 1, productId: 1, warehouseId: 1, movementDate: 1 });
schema.index(
  { companyId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $exists: true, $type: "string" },
    },
  },
);
schema.pre("save", function (next) {
  if (this.quantityIn > 0 && this.quantityOut > 0)
    return next(
      new Error("A movement cannot contain both quantity in and quantity out"),
    );
  if (this.quantityIn === 0 && this.quantityOut === 0)
    return next(
      new Error("A movement must contain quantity in or quantity out"),
    );
  next();
});
schema.pre("findOneAndUpdate", async function (next) {
  const current: any = await this.model
    .findOne(this.getQuery())
    .select("status")
    .lean();
  if (current?.status === "posted")
    return next(
      new Error(
        "Posted inventory movements are immutable; use a reversal movement",
      ),
    );
  next();
});
schema.pre("findOneAndDelete", async function (next) {
  const current: any = await this.model
    .findOne(this.getQuery())
    .select("status")
    .lean();
  if (current?.status === "posted")
    return next(new Error("Posted inventory movements cannot be deleted"));
  next();
});
export const InventoryMovement =
  mongoose.models.InventoryMovement ||
  mongoose.model("InventoryMovement", schema);
