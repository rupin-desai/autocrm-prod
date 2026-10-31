import mongoose from "mongoose";

const lineSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    purchaseBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseBill",
    },
    purchaseBillLineReference: { type: mongoose.Schema.Types.ObjectId },
    originalReceiptMovementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryMovement",
      required: true,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    returnQuantity: { type: Number, required: true, min: 0 },
    originalUnitCostPaise: { type: Number, required: true, min: 0 },
    returnValuePaise: { type: Number, required: true, min: 0 },
  },
  { _id: true },
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
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    purchaseBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseBill",
      required: true,
    },
    returnNumber: { type: String, required: true },
    amountPaise: { type: Number, required: true, min: 1 },
    taxAmountPaise: { type: Number, default: 0, min: 0 },
    reason: { type: String, required: true },
    lines: { type: [lineSchema], default: [] },
    inventoryLinkStatus: {
      type: String,
      enum: ["unverified", "verified", "posted", "blocked"],
      default: "unverified",
      index: true,
    },
    accountingPeriodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountingPeriod",
      index: true,
    },
    movementDate: { type: Date },
    idempotencyKey: { type: String },
    inventoryVoucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountingVoucher",
    },
    inventoryMovementIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "InventoryMovement" },
    ],
    status: {
      type: String,
      enum: ["draft", "approved", "posted", "reversed", "cancelled"],
      default: "draft",
      index: true,
    },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountingVoucher",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);
schema.pre("validate", async function (next) {
  const bill: any = await mongoose
    .model("PurchaseBill")
    .findById(this.purchaseBillId)
    .select("grandTotalPaise")
    .lean();
  if (bill && this.amountPaise > bill.grandTotalPaise)
    return next(
      new Error(
        "Purchase return cannot exceed the original purchase bill amount",
      ),
    );
  next();
});
schema.index({ companyId: 1, returnNumber: 1 }, { unique: true });
schema.index(
  { companyId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true },
);
schema.pre("save", async function (next) {
  const current: any = this.isNew
    ? null
    : await (this.constructor as any)
        .findById(this._id)
        .select("status")
        .lean();
  if (current?.status === "posted" && this.isModified())
    return next(
      new Error(
        "Posted purchase returns are immutable; use a compensating workflow",
      ),
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
        "Posted purchase returns are immutable; use a compensating workflow",
      ),
    );
  next();
});
export const PurchaseReturn =
  mongoose.models.PurchaseReturn || mongoose.model("PurchaseReturn", schema);
