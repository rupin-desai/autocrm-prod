import mongoose from 'mongoose';

const advancePaymentSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationCustomer', required: true },
  customerName: { type: String, required: true },
  customerMobile: { type: String },

  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationVehicle' },
  vehicleNumber: { type: String },

  // What the advance is against
  itemOrService: { type: String, required: true },
  relatedWork: { type: String },
  serviceVisitId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceVisit' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

  // Money (stored in rupees, rounded to 2dp on write)
  amount: { type: Number, required: true, min: 0 },
  paymentMode: {
    type: String,
    enum: ['UPI', 'Cash', 'Card', 'Net Banking', 'Cheque'],
    default: 'Cash',
  },
  transactionId: { type: String },
  receivedDate: { type: Date, required: true, default: Date.now },

  // Reminder: default 15 days, editable per record
  reminderDays: { type: Number, default: 15, min: 0 },
  reminderDate: { type: Date },
  reminderSentAt: { type: Date },
  reminderEnabled: { type: Boolean, default: true },

  status: {
    type: String,
    enum: ['pending', 'adjusted', 'refunded', 'cancelled'],
    default: 'pending',
  },
  // Set when the advance is applied to an invoice
  adjustedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  adjustedAt: { type: Date },

  notes: { type: String },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recordedByName: { type: String },
}, { timestamps: true });

// Keep reminderDate derived from receivedDate + reminderDays
advancePaymentSchema.pre('save', function (next) {
  if (this.isModified('receivedDate') || this.isModified('reminderDays') || !this.reminderDate) {
    const base = this.receivedDate ? new Date(this.receivedDate) : new Date();
    base.setDate(base.getDate() + (Number(this.reminderDays) || 0));
    this.reminderDate = base;
  }
  if (this.isModified('amount')) {
    this.amount = Math.round((Number(this.amount) || 0) * 100) / 100;
  }
  next();
});

advancePaymentSchema.index({ customerId: 1, createdAt: -1 });
advancePaymentSchema.index({ status: 1, reminderDate: 1 });
advancePaymentSchema.index({ receivedDate: -1 });

export const AdvancePayment = mongoose.models.AdvancePayment || mongoose.model('AdvancePayment', advancePaymentSchema);
