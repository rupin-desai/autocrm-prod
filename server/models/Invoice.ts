import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  type: { type: String, enum: ['product', 'service'], required: true },
  productId: { type: String },
  name: { type: String, required: true },
  description: { type: String },
  isLabourCharge: { type: Boolean, default: false },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true },
  hasGst: { type: Boolean, default: false },
  gstAmount: { type: Number, default: 0 },
  warrantyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warranty' },
  hasWarranty: { type: Boolean, default: false },
  warrantyCards: [{
    url: { type: String },
    filename: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  }],
}, { _id: false });

const paymentEntrySchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  paymentMode: { 
    type: String, 
    enum: ['UPI', 'Cash', 'Card', 'Net Banking', 'Cheque'],
    required: true 
  },
  transactionId: { type: String },
  transactionDate: { type: Date, default: Date.now },
  notes: { type: String },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: true, timestamps: true });

const customerDetailsSchema = new mongoose.Schema({
  referenceCode: { type: String },
  fullName: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  alternativeNumber: { type: String },
  email: { type: String },
  address: { type: String },
  city: { type: String },
  taluka: { type: String },
  district: { type: String },
  state: { type: String },
  pinCode: { type: String },
  referralSource: { type: String },
  isVerified: { type: Boolean },
  registrationDate: { type: Date },
}, { _id: false });

const vehicleDetailsSchema = new mongoose.Schema({
  vehicleId: { type: String },
  vehicleNumber: { type: String },
  vehicleBrand: { type: String },
  vehicleModel: { type: String },
  customModel: { type: String },
  variant: { type: String },
  color: { type: String },
  yearOfPurchase: { type: Number },
  vehiclePhoto: { type: String },
  isNewVehicle: { type: Boolean },
  chassisNumber: { type: String },
  selectedParts: [{ type: String }],
  vehicleRegistrationDate: { type: Date },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true },
  
  // Related entities (for reference)
  serviceVisitId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceVisit' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationCustomer', required: true },
  
  // Full customer details embedded in invoice
  customerDetails: { type: customerDetailsSchema, required: true },
  
  // Vehicle details (can be single or multiple)
  vehicleDetails: [vehicleDetailsSchema],
  
  // Items
  items: [invoiceItemSchema],
  
  // Pricing
  subtotal: { type: Number, required: true },
  discountType: { type: String, enum: ['percentage', 'fixed', 'none'], default: 'none' },
  discountValue: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  couponCode: { type: String },
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
  
  // Tax
  taxRate: { type: Number, default: 18 }, // GST percentage
  taxAmount: { type: Number, required: true },
  
  // Total
  totalAmount: { type: Number, required: true },
  
  // Payment
  paymentStatus: { 
    type: String, 
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  paymentMethod: {
    type: String,
    enum: ['UPI', 'Cash', 'Card', 'Net Banking', 'Cheque'],
  },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, required: true },
  payments: [paymentEntrySchema],
  
  // Approval workflow
  status: { 
    type: String, 
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'cancelled'],
    default: 'draft'
  },
  approvalStatus: {
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
  },
  
  // Staff
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  salesExecutiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  
  // Notifications
  notificationsSent: {
    email: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    whatsappSentAt: { type: Date },
  },
  
  // PDF
  pdfPath: { type: String },
  pdfAccessToken: { type: String },
  pdfTokenExpiry: { type: Date },
  
  // Additional
  notes: { type: String },
  terms: { type: String },
  dueDate: { type: Date },
  
}, { timestamps: true });

// Auto-generate invoice number on save
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const currentYear = new Date().getFullYear();
    const lastInvoice = await mongoose.model('Invoice').findOne({
      invoiceNumber: new RegExp(`^INV/${currentYear}/`)
    }).sort({ createdAt: -1 });
    
    let nextNumber = 1;
    if (lastInvoice && lastInvoice.invoiceNumber) {
      const lastNumber = parseInt(lastInvoice.invoiceNumber.split('/').pop() || '0');
      nextNumber = lastNumber + 1;
    }
    
    this.invoiceNumber = `INV/${currentYear}/${String(nextNumber).padStart(4, '0')}`;
  }
  next();
});

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
