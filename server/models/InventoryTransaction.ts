import mongoose from 'mongoose';

const inventoryTransactionSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  type: { type: String, enum: ['IN', 'OUT', 'RETURN', 'ADJUSTMENT'], required: true },
  quantity: { type: Number, required: true },
  reason: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, default: Date.now },
  
  // Supply details
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  batchNumber: { type: String },
  unitCost: { type: Number },
  
  // Stock details
  previousStock: { type: Number },
  newStock: { type: Number },
  warehouseLocation: { type: String },
  
  // Return details
  returnId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductReturn' },
  
  // Additional notes
  notes: { type: String },
}, { timestamps: true });

export const InventoryTransaction = mongoose.models.InventoryTransaction || 
  mongoose.model('InventoryTransaction', inventoryTransactionSchema);
