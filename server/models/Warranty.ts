import mongoose from 'mongoose';

const warrantySchema = new mongoose.Schema({
  warrantyNumber: { type: String, unique: true },
  
  // Related entities
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationCustomer', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  
  // Product details
  productName: { type: String, required: true },
  serialNumber: { type: String },
  
  // Warranty details
  warrantyType: { 
    type: String, 
    enum: ['manufacturer', 'extended', 'service'],
    required: true 
  },
  durationMonths: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  
  // Coverage
  coverage: { type: String },
  terms: { type: String },
  
  // Status
  status: { 
    type: String, 
    enum: ['active', 'expired', 'claimed', 'void'],
    default: 'active'
  },
  
  // Claims
  claims: [{
    claimDate: { type: Date },
    description: { type: String },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected', 'completed']
    },
    resolutionDate: { type: Date },
    resolutionNotes: { type: String },
  }],
  
}, { timestamps: true });

// Auto-generate warranty number
warrantySchema.pre('save', async function(next) {
  if (!this.warrantyNumber) {
    const currentYear = new Date().getFullYear();
    const lastWarranty = await mongoose.model('Warranty').findOne({
      warrantyNumber: new RegExp(`^WRT/${currentYear}/`)
    }).sort({ createdAt: -1 });
    
    let nextNumber = 1;
    if (lastWarranty && lastWarranty.warrantyNumber) {
      const lastNumber = parseInt(lastWarranty.warrantyNumber.split('/').pop() || '0');
      nextNumber = lastNumber + 1;
    }
    
    this.warrantyNumber = `WRT/${currentYear}/${String(nextNumber).padStart(4, '0')}`;
  }
  
  // Calculate end date if not set
  if (!this.endDate && this.startDate && this.durationMonths) {
    const endDate = new Date(this.startDate);
    endDate.setMonth(endDate.getMonth() + this.durationMonths);
    this.endDate = endDate;
  }
  
  next();
});

// Delete cached model to ensure schema changes are applied
if (mongoose.models.Warranty) {
  delete mongoose.models.Warranty;
}

export const Warranty = mongoose.model('Warranty', warrantySchema);
