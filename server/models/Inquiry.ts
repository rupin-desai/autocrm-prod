import mongoose from 'mongoose';

const inquiryItemSchema = new mongoose.Schema({
  // productId is optional: customers inquire about things not in the catalogue
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  quantity: { type: Number, default: 1, min: 1 },
  expectedPrice: { type: Number, default: 0 },
  notes: { type: String },
}, { _id: false });

const inquirySchema = new mongoose.Schema({
  inquiryNumber: { type: String, unique: true },

  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationCustomer' },
  customerName: { type: String, required: true },
  customerMobile: { type: String },

  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationVehicle' },
  vehicleNumber: { type: String },
  vehicleBrand: { type: String },
  vehicleModel: { type: String },

  items: { type: [inquiryItemSchema], default: [] },

  inquiryDate: { type: Date, required: true, default: Date.now },

  // "salesman" in the requirements
  salesmanId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  salesmanName: { type: String },

  status: {
    type: String,
    enum: ['open', 'quoted', 'converted', 'lost', 'closed'],
    default: 'open',
  },
  notes: { type: String },

  // Follow-up reminder, user configurable
  reminderDays: { type: Number, default: 7, min: 0 },
  reminderDate: { type: Date },
  reminderSentAt: { type: Date },
  reminderEnabled: { type: Boolean, default: true },

  quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

inquirySchema.pre('save', function (next) {
  if (this.isModified('inquiryDate') || this.isModified('reminderDays') || !this.reminderDate) {
    const base = this.inquiryDate ? new Date(this.inquiryDate) : new Date();
    base.setDate(base.getDate() + (Number(this.reminderDays) || 0));
    this.reminderDate = base;
  }
  next();
});

inquirySchema.index({ customerId: 1, inquiryDate: -1 });
inquirySchema.index({ status: 1, inquiryDate: -1 });
inquirySchema.index({ salesmanId: 1, inquiryDate: -1 });
inquirySchema.index({ vehicleNumber: 1 });
inquirySchema.index({ customerName: 'text', customerMobile: 'text', 'items.name': 'text' });

export const Inquiry = mongoose.models.Inquiry || mongoose.model('Inquiry', inquirySchema);
