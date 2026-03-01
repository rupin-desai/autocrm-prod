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
  otp: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null },
  registeredBy: { type: String, default: null },
  registeredByRole: { type: String, default: null },
}, { timestamps: true });

export const RegistrationCustomer = mongoose.models.RegistrationCustomer || mongoose.model('RegistrationCustomer', registrationCustomerSchema);
