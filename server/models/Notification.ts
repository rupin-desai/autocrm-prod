import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['low_stock', 'new_order', 'payment_due', 'info'],
    required: true 
  },
  read: { type: Boolean, default: false },
  targetRole: { type: String },
  relatedId: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
