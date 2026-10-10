import mongoose from 'mongoose';

const serviceVisitSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationCustomer', required: true },
  vehicleReg: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['inquired', 'working', 'waiting', 'completed'],
    default: 'inquired'
  },
  handlerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notes: String,
  // Parts planned for / fitted on this job. productId is optional so parts
  // quoted or inquired about outside the catalogue can still be tracked.
  partsUsed: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    quantity: { type: Number, default: 1, min: 1 },
    price: { type: Number, default: 0, min: 0 },
  }],
  // Where the parts list came from, so the job can be traced end to end.
  partsSource: { type: String, enum: ['quotation', 'inquiry', 'vehicle', 'manual'] },
  quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  inquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inquiry' },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  stageTimestamps: {
    inquired: Date,
    working: Date,
    waiting: Date,
    completed: Date,
  },
  totalAmount: { type: Number, default: 0 },
  beforeImages: [{ type: String }],
  afterImages: [{ type: String }],
  invoiceNumber: { type: String },
  invoiceDate: { type: Date },
}, { timestamps: true });

serviceVisitSchema.pre('save', function(next) {
  if (!this.stageTimestamps) {
    this.stageTimestamps = {};
  }
  if (!this.stageTimestamps.inquired) {
    this.stageTimestamps.inquired = new Date();
  }
  if (this.isModified('status') && this.status) {
    (this.stageTimestamps as any)[this.status] = new Date();
  }
  next();
});

export const ServiceVisit = mongoose.models.ServiceVisit || mongoose.model('ServiceVisit', serviceVisitSchema);
