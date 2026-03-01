import mongoose from 'mongoose';

const productReturnSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  quantity: { type: Number, required: true },
  reason: { type: String, required: true },
  condition: { 
    type: String, 
    enum: ['defective', 'damaged', 'wrong_item', 'not_as_described', 'other'],
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'processed'],
    default: 'pending'
  },
  refundAmount: { type: Number },
  restockable: { type: Boolean, default: false },
  notes: { type: String },
  returnDate: { type: Date, default: Date.now },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedDate: { type: Date },
}, { timestamps: true });

export const ProductReturn = mongoose.models.ProductReturn || mongoose.model('ProductReturn', productReturnSchema);
