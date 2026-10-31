import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
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
    quantityOnHand: { type: Number, required: true, min: 0, default: 0 },
    reservedQuantity: { type: Number, required: true, min: 0, default: 0 },
    inventoryValuePaise: { type: Number, required: true, min: 0, default: 0 },
    averageCostPaise: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);
schema.index({ companyId: 1, productId: 1, warehouseId: 1 }, { unique: true });
export const WarehouseStock =
  mongoose.models.WarehouseStock || mongoose.model("WarehouseStock", schema);
