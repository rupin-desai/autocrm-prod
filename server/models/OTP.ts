import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  mobileNumber: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['employee_verification', 'phone_update', 'role_selection', 'login'], default: 'login' },
  expiresAt: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTP = mongoose.models.OTP || mongoose.model('OTP', otpSchema);
