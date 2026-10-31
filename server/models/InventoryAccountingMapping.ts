import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
    },
    inventoryAssetLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    costOfGoodsSoldLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    purchaseReceiptClearingLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    stockAdjustmentGainLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    stockAdjustmentLossLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    inventoryOpeningBalanceLedgerId: {
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
schema.index({ companyId: 1 }, { unique: true });
export const InventoryAccountingMapping =
  mongoose.models.InventoryAccountingMapping ||
  mongoose.model("InventoryAccountingMapping", schema);
