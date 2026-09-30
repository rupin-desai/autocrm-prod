import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['low_stock', 'new_order', 'payment_due', 'info', 'reminder'],
    required: true 
  },
  read: { type: Boolean, default: false },
  targetRole: { type: String },
  relatedId: { type: mongoose.Schema.Types.ObjectId },
  // Reminder metadata: which module raised it and where to go in the UI.
  source: {
    type: String,
    enum: ['advance_payment', 'inquiry', 'warranty_claim', 'vendor_warranty', 'quotation'],
  },
  link: { type: String },
  dueDate: { type: Date },
}, { timestamps: true });

notificationSchema.index({ read: 1, createdAt: -1 });
notificationSchema.index({ source: 1, relatedId: 1 });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
