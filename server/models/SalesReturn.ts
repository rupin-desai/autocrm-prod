import mongoose from "mongoose";

const lineSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    invoiceLineReference: { type: String, required: true },
    originalSalesIssueMovementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryMovement",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    returnQuantity: { type: Number, required: true, min: 0 },
    originalIssueUnitCostPaise: { type: Number, required: true, min: 0 },
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
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    returnNumber: { type: String, required: true },
    lines: {
      type: [lineSchema],
      required: true,
      validate: [
        (value: any[]) => value.length > 0,
        "At least one sales return line is required",
      ],
    },
    reason: { type: String, required: true },
    physicalReceiptAuthorizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

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
        "Posted sales returns are immutable; use a compensating workflow",
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
        "Posted sales returns are immutable; use a compensating workflow",
      ),
    );
  next();
});
export const SalesReturn =
  mongoose.models.SalesReturn || mongoose.model("SalesReturn", schema);
