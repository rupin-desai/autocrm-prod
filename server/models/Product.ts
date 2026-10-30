import mongoose from 'mongoose';
import { getNextSequence } from './Counter';

const variantSchema = new mongoose.Schema({
  size: String,
  color: String,
}, { _id: false });

const productSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, default: '' },
  productName: { type: String, required: true },
  productId: { type: String },
  hsnNumber: { type: String },
  barcode: { type: String },
  barcodeImage: { type: String },
  category: { type: String, required: true },
  modelCompatibility: [String],
  warranty: String,
  mrp: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  stockQty: { type: Number, default: 0 },
  minStockLevel: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'],
    default: 'in_stock'
  },
  variants: [variantSchema],
  images: [String],
  // E-commerce website publishing. Only products flagged here are exposed by
  // the public storefront feed; everything else stays CRM-internal.
  showOnWebsite: { type: Boolean, default: false },
  websiteTitle: { type: String },
  websiteDescription: { type: String },
  websitePrice: { type: Number },
  websiteUpdatedAt: { type: Date },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
}, { timestamps: true });

export function getProductStockStatus(stockQty: number, minStockLevel: number) {
  const stock = Number(stockQty) || 0;
  const minStock = Number(minStockLevel) || 0;

  if (stock <= 0) {
    return 'out_of_stock';
  }

  if (stock <= minStock) {
    return 'low_stock';
  }

  return 'in_stock';
}

productSchema.index({ showOnWebsite: 1 });
productSchema.index({ category: 1 });
productSchema.index({ stockQty: 1 });
productSchema.index({ barcode: 1 });

productSchema.pre('save', async function(next) {
  this.status = getProductStockStatus(this.stockQty, this.minStockLevel);
  // Every part gets a permanent shop barcode (MAW-001000, MAW-001001, ...) for scanning and labels.
  if (!this.barcode?.trim()) {
    this.barcode = `MAW-${String(999 + await getNextSequence('productBarcode')).padStart(6, '0')}`;
  }
  next();
});

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
