import mongoose from "mongoose";

const salesAccountingMappingSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
    },
    productSalesLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    serviceIncomeLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    outputCgstLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    outputSgstLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    outputIgstLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    customerAdvancesLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    cashLedgerId: {
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
    netBankingClearingLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerAccount",
    },
    chequeClearingLedgerId: {
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

export const SalesAccountingMapping =
  mongoose.models.SalesAccountingMapping ||
  mongoose.model("SalesAccountingMapping", salesAccountingMappingSchema);
