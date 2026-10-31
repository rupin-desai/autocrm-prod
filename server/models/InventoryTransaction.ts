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

// Invoices, orders and returns keep their own record of these movements, so deleting the
// entry would apply the stock change again when that document is later reversed.
// shortcut: matches the generated reason text because older records have no source field, add one if new generated reasons appear.
export function isLinkedTransaction(tx: any) {
  return Boolean(tx.returnId) || /^((Rejected invoice|Deleted invoice|Invoice stock reversal|Invoice) INV|Order ORD-)/.test(tx.reason || '');
}
