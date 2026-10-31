import mongoose from "mongoose";

const purchaseAccountingMappingSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
    },
    purchaseGoodsLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    purchaseReturnsLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    purchaseExpensesLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    inputCgstLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    inputSgstLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    inputIgstLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    supplierPayableLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    cashLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    bankLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    upiClearingLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    cardClearingLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    chequeClearingLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    supplierAdvancesLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

purchaseAccountingMappingSchema.index({ companyId: 1 }, { unique: true });
export const PurchaseAccountingMapping =
  mongoose.models.PurchaseAccountingMapping ||
  mongoose.model("PurchaseAccountingMapping", purchaseAccountingMappingSchema);
