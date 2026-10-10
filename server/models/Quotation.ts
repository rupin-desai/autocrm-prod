import mongoose from 'mongoose';

// A quotation is a pre-sale document. It deliberately touches nothing else:
// no stock movement, no invoice, no payment, no sales figures. Only the
// explicit convert step creates a real transaction.

const quotationItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  description: { type: String },
  quantity: { type: Number, default: 1, min: 1 },
  rate: { type: Number, required: true, min: 0 },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  taxPercent: { type: Number, default: 0, min: 0 },
  // All three are computed server-side; never trusted from the client.
  discountAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
}, { _id: false });

const quotationSchema = new mongoose.Schema({
  quotationNumber: { type: String, unique: true },

  // Customer may be an existing registration or a walk-in name + number only
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationCustomer' },
  customerName: { type: String, required: true },
  customerMobile: { type: String, required: true },

  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationVehicle' },
  vehicleNumber: { type: String },
  vehicleBrand: { type: String },
  vehicleModel: { type: String },
  vehicleVariant: { type: String },

  items: { type: [quotationItemSchema], default: [] },

  subtotal: { type: Number, default: 0 },
  totalDiscount: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },

  quotationDate: { type: Date, required: true, default: Date.now },
  validUntil: { type: Date },

  // "Set a reminder for when the customer is expected to come for work"
  expectedVisitDate: { type: Date },
  reminderDays: { type: Number, default: 7, min: 0 },
  reminderDate: { type: Date },
  reminderSentAt: { type: Date },
  reminderEnabled: { type: Boolean, default: true },

  status: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'rejected', 'converted', 'expired'],
    default: 'draft',
  },

  // Set only on conversion. Presence of this is what makes it a real transaction.
  convertedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  convertedAt: { type: Date },
  convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  inquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inquiry' },
  serviceVisitId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceVisit' },

  notes: { type: String },
  terms: { type: String },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String },
  createdByRole: { type: String },
}, { timestamps: true });

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Totals are always derived here, never accepted from the request body.
export function computeQuotationTotals(items: any[]) {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  const computed = (items || []).map((item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const rate = Math.max(0, Number(item.rate) || 0);
    const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
    const taxPercent = Math.max(0, Number(item.taxPercent) || 0);

    const gross = round2(quantity * rate);
    const discountAmount = round2((gross * discountPercent) / 100);
    const net = round2(gross - discountAmount);
    const taxAmount = round2((net * taxPercent) / 100);
    const total = round2(net + taxAmount);

    subtotal += gross;
    totalDiscount += discountAmount;
    totalTax += taxAmount;

    return {
      ...item,
      quantity,
      rate,
      discountPercent,
      taxPercent,
      discountAmount,
      taxAmount,
      total,
    };
  });

  return {
    items: computed,
    subtotal: round2(subtotal),
    totalDiscount: round2(totalDiscount),
    totalTax: round2(totalTax),
    grandTotal: round2(subtotal - totalDiscount + totalTax),
  };
}

quotationSchema.pre('save', function (next) {
  const base = this.expectedVisitDate
    ? new Date(this.expectedVisitDate)
    : new Date(this.quotationDate || Date.now());
  if (this.isModified('expectedVisitDate') || this.isModified('reminderDays') || !this.reminderDate) {
    if (this.expectedVisitDate) {
      this.reminderDate = new Date(this.expectedVisitDate);
    } else {
      base.setDate(base.getDate() + (Number(this.reminderDays) || 0));
      this.reminderDate = base;
    }
  }
  next();
});

quotationSchema.index({ customerId: 1, quotationDate: -1 });
quotationSchema.index({ status: 1, quotationDate: -1 });
quotationSchema.index({ createdBy: 1, quotationDate: -1 });
quotationSchema.index({ customerMobile: 1 });

export const Quotation = mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema);
