import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  description: { type: String },
  
  // Discount details
  discountType: { 
    type: String, 
    enum: ['percentage', 'fixed'],
    required: true 
  },
  discountValue: { type: Number, required: true },
  
  // Usage limits
  maxUses: { type: Number, default: 0 }, // 0 means unlimited
  usedCount: { type: Number, default: 0 },
  maxUsesPerCustomer: { type: Number, default: 1 },
  
  // Validity
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  
  // Conditions
  minPurchaseAmount: { type: Number, default: 0 },
  maxDiscountAmount: { type: Number }, // For percentage discounts
  applicableOn: { 
    type: String, 
    enum: ['all', 'products', 'services'],
    default: 'all'
  },
  
  // Status
  isActive: { type: Boolean, default: true },
  
  // Tracking
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  usageHistory: [{
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationCustomer' },
    usedAt: { type: Date, default: Date.now },
    discountApplied: { type: Number },
  }],
  
}, { timestamps: true });

// Method to validate coupon
couponSchema.methods.isValid = function(customerId?: string, purchaseAmount?: number) {
  const now = new Date();
  
  // Check if active
  if (!this.isActive) {
    return { valid: false, reason: 'Coupon is inactive' };
  }
  
  // Check validity period
  if (now < this.validFrom) {
    return { valid: false, reason: 'Coupon not yet valid' };
  }
  if (now > this.validUntil) {
    return { valid: false, reason: 'Coupon has expired' };
  }
  
  // Check max uses
  if (this.maxUses > 0 && this.usedCount >= this.maxUses) {
    return { valid: false, reason: 'Coupon usage limit reached' };
  }
  
  // Check customer usage
  if (customerId && this.maxUsesPerCustomer > 0) {
    const customerUsage = this.usageHistory.filter(
      (h: any) => h.customerId?.toString() === customerId
    ).length;
    
    if (customerUsage >= this.maxUsesPerCustomer) {
      return { valid: false, reason: 'Coupon usage limit reached for this customer' };
    }
  }
  
  // Check minimum purchase amount
  if (purchaseAmount !== undefined && purchaseAmount < this.minPurchaseAmount) {
    return { valid: false, reason: `Minimum purchase amount of ₹${this.minPurchaseAmount} required` };
  }
  
  return { valid: true };
};

// Method to calculate discount
couponSchema.methods.calculateDiscount = function(amount: number) {
  if (this.discountType === 'percentage') {
    let discount = (amount * this.discountValue) / 100;
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
    return discount;
  } else {
    return Math.min(this.discountValue, amount);
  }
};

export const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
