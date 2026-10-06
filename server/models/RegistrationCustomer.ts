import mongoose from 'mongoose';

const registrationCustomerSchema = new mongoose.Schema({
  referenceCode: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  mobileNumber: { type: String, required: true, unique: true },
  alternativeNumber: { type: String, default: null },
  email: { type: String, default: null },
  address: { type: String, default: null },
  city: { type: String, default: null },
  taluka: { type: String, default: null },
  district: { type: String, default: null },
  state: { type: String, default: null },
  pinCode: { type: String, default: null },
  referralSource: { type: String, default: null },
  isVerified: { type: Boolean, default: false },
  // OTP verification is optional. otpRequired records the Yes/No choice made
  // at registration time; otpSkipReason records why it was skipped.
  otpRequired: { type: Boolean, default: true },
  otpSkipReason: {
    type: String,
    enum: ['staff_opted_out', 'low_value_no_phone', 'local_bypass', null],
    default: null,
  },
  otp: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 },
  registeredBy: { type: String, default: null },
  registeredByRole: { type: String, default: null },
}, { timestamps: true });

registrationCustomerSchema.index({ createdAt: -1 });
registrationCustomerSchema.index({ isVerified: 1, createdAt: -1 });

export const RegistrationCustomer = mongoose.models.RegistrationCustomer || mongoose.model('RegistrationCustomer', registrationCustomerSchema);
