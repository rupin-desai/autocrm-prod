import mongoose from "mongoose";
import { MAX_ACCOUNTING_PAISE } from "../accountingMoney";

const voucherLineSchema = new mongoose.Schema(
  {
    ledgerAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
      required: true,
    },
    description: { type: String, default: "" },
    debitPaise: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_ACCOUNTING_PAISE,
    },
    creditPaise: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_ACCOUNTING_PAISE,
    },
  },
  { _id: true },
);

const accountingVoucherSchema = new mongoose.Schema(
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
    voucherNumber: { type: String },
    voucherType: {
      type: String,
      enum: ["journal", "payment", "receipt", "contra", "reversal"],
      required: true,
    },
    voucherDate: { type: Date, required: true },
    status: {
      type: String,
      enum: [
        "draft",
        "pending_approval",
        "approved",
        "posted",
        "reversed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    paymentMode: {
      type: String,
      enum: ["Cash", "Bank Transfer", "UPI", "Cheque"],
    },
    transactionReference: { type: String, default: "" },
    narration: { type: String, default: "" },
    referenceNumber: { type: String, default: "" },
    lines: { type: [voucherLineSchema], default: [] },
    totalDebitPaise: {
      type: Number,
      min: 0,
      max: MAX_ACCOUNTING_PAISE,
      default: 0,
    },
    totalCreditPaise: {
      type: Number,
      min: 0,
      max: MAX_ACCOUNTING_PAISE,
      default: 0,
    },
    sourceType: { type: String, default: "" },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    sourceFingerprint: { type: String },
    idempotencyKey: { type: String },
    idempotencyFingerprint: { type: String },
    // A transaction-scoped claim prevents concurrent requests from both
    // performing posting side effects for the same approved voucher. The claim
    // is rolled back automatically if the posting transaction aborts.
    postingClaimId: { type: mongoose.Schema.Types.ObjectId, index: true },
    postingClaimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postingClaimedAt: { type: Date },
    reversalOfVoucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountingVoucher",
    },
    reversalVoucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountingVoucher",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submittedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postedAt: { type: Date },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reversedAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);

accountingVoucherSchema.index(
  { companyId: 1, financialYearId: 1, voucherNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      voucherNumber: { $exists: true, $type: "string" },
    },
  },
);
accountingVoucherSchema.index({ companyId: 1, voucherDate: -1, status: 1 });
accountingVoucherSchema.index({ companyId: 1, voucherType: 1, status: 1 });
accountingVoucherSchema.index(
  { companyId: 1, sourceFingerprint: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceFingerprint: { $exists: true, $type: "string" },
    },
  },
);
accountingVoucherSchema.index(
  { companyId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $exists: true, $type: "string" },
    },
  },
);
accountingVoucherSchema.index(
  { companyId: 1, sourceType: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceType: { $exists: true, $nin: ["", null] },
      sourceId: { $exists: true },
    },
  },
);
accountingVoucherSchema.index(
  { reversalOfVoucherId: 1 },
  { unique: true, sparse: true },
);
accountingVoucherSchema.index({
  "lines.ledgerAccountId": 1,
  companyId: 1,
  status: 1,
});

accountingVoucherSchema.pre("save", async function (next) {
  const existing: any = this.isNew
    ? null
    : await (this.constructor as any)
        .findById(this._id)
        .select("status")
        .lean();
  if (
    existing?.status === "posted" &&
    this.isModified() &&
    !(this as any).$__.saveOptions?.accountingReversal
  )
    return next(
      new Error("Posted vouchers are immutable; use reversal workflow"),
    );
  next();
});
accountingVoucherSchema.pre("findOneAndUpdate", async function (next) {
  const current: any = await this.model
    .findOne(this.getQuery())
    .select("status")
    .lean();
  if (
    current?.status === "posted" &&
    !(this.getOptions() as any).accountingReversal
  )
    return next(
      new Error("Posted vouchers are immutable; use reversal workflow"),
    );
  next();
});
accountingVoucherSchema.pre("deleteOne", async function (next) {
  const current: any = await this.model
    .findOne(this.getQuery())
    .select("status")
    .lean();
  if (current?.status === "posted")
    return next(new Error("Posted vouchers cannot be deleted"));
  next();
});
accountingVoucherSchema.pre("findOneAndDelete", async function (next) {
  const current: any = await this.model
    .findOne(this.getQuery())
    .select("status")
    .lean();
  if (current?.status === "posted")
    return next(new Error("Posted vouchers cannot be deleted"));
  next();
});

export const AccountingVoucher =
  mongoose.models.AccountingVoucher ||
  mongoose.model("AccountingVoucher", accountingVoucherSchema);
