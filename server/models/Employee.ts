import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, unique: true },
  name: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Admin', 'Manager', 'Inventory Manager', 'Sales Executive', 'HR Manager', 'Service Staff'],
    required: true 
  },
  contact: { type: String, required: true },
  email: { type: String },
  salary: { type: Number },
  joiningDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  panNumber: { type: String },
  aadharNumber: { type: String },
  photo: { type: String },
  documents: [{ type: String }],
}, { timestamps: true });

export const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);
