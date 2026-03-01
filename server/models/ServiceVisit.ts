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
  partsUsed: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    price: Number,
  }],
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
