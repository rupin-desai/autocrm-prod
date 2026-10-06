import mongoose from 'mongoose';

// A warranty item taken in from a customer, optionally sent out to a vendor
// for repair, and tracked until it comes back and is returned to the customer.
// Distinct from models/Warranty.ts, which is the warranty card issued with a sale.

const vendorDispatchSchema = new mongoose.Schema({
  vendorName: { type: String, required: true },
  vendorContact: { type: String },
  itemName: { type: String, required: true },
  quantity: { type: Number, default: 1, min: 1 },
  givenDate: { type: Date, required: true, default: Date.now },
  problem: { type: String },
  narration: { type: String },

  expectedReturnDate: { type: Date },
  returnedDate: { type: Date },
  resolution: { type: String },
  status: {
    type: String,
    enum: ['with_vendor', 'returned', 'rejected'],
    default: 'with_vendor',
  },

  reminderDays: { type: Number, default: 15, min: 0 },
  reminderDate: { type: Date },
  reminderSentAt: { type: Date },

  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recordedByName: { type: String },
}, { _id: true, timestamps: true });

const warrantyClaimSchema = new mongoose.Schema({
  claimNumber: { type: String, unique: true },

  // --- Customer side: item received from customer ---
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationCustomer' },
  customerName: { type: String, required: true },
  customerMobile: { type: String },

  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationVehicle' },
  vehicleNumber: { type: String },

  itemName: { type: String, required: true },
  quantity: { type: Number, default: 1, min: 1 },
  problem: { type: String, required: true },
  receivedDate: { type: Date, required: true, default: Date.now },

  // Link back to the sale this item came from, when known
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },

  // Reminder for the customer-side item, days chosen by the user
  reminderDays: { type: Number, default: 15, min: 0 },
  reminderDate: { type: Date },
  reminderSentAt: { type: Date },
  reminderEnabled: { type: Boolean, default: true },

  // --- Vendor side: one entry per time the item goes out ---
  vendorDispatches: { type: [vendorDispatchSchema], default: [] },

  status: {
    type: String,
    enum: ['received', 'with_vendor', 'returned_from_vendor', 'resolved', 'delivered_to_customer', 'cancelled'],
    default: 'received',
  },
  resolution: { type: String },
  resolvedAt: { type: Date },
  deliveredAt: { type: Date },

  notes: { type: String },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recordedByName: { type: String },
}, { timestamps: true });

function applyReminder(doc: any, dateField: string) {
  const base = doc[dateField] ? new Date(doc[dateField]) : new Date();
  base.setDate(base.getDate() + (Number(doc.reminderDays) || 0));
  doc.reminderDate = base;
}

warrantyClaimSchema.pre('save', function (next) {
  if (this.isModified('receivedDate') || this.isModified('reminderDays') || !this.reminderDate) {
    applyReminder(this, 'receivedDate');
  }
  for (const dispatch of this.vendorDispatches as any[]) {
    if (!dispatch.reminderDate) {
      applyReminder(dispatch, 'givenDate');
    }
  }
  next();
});

warrantyClaimSchema.index({ customerId: 1, createdAt: -1 });
warrantyClaimSchema.index({ status: 1, receivedDate: -1 });
warrantyClaimSchema.index({ reminderDate: 1, status: 1 });
warrantyClaimSchema.index({ vehicleNumber: 1 });

export const WarrantyClaim = mongoose.models.WarrantyClaim || mongoose.model('WarrantyClaim', warrantyClaimSchema);
