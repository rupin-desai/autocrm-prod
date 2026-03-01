import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  employeeId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobileNumber: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Admin', 'Manager', 'Inventory Manager', 'Sales Executive', 'HR Manager', 'Service Staff'],
    default: 'Service Staff'
  },
  isActive: { type: Boolean, default: true },
  department: { type: String },
  salary: { type: Number },
  joiningDate: { type: Date, default: Date.now },
  panNumber: { type: String },
  aadharNumber: { type: String },
  photo: { type: String },
  documents: [{ type: String }],
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
