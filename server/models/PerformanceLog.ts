import mongoose from 'mongoose';

const performanceLogSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: { type: String, required: true },
  employeeCode: { type: String },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  totalSales: { type: Number, default: 0 },
  orderCount: { type: Number, default: 0 },
  avgOrderValue: { type: Number, default: 0 },
  attendanceRate: { type: Number, default: 0 },
  tasksCompleted: { type: Number, default: 0 },
  customerFeedbackScore: { type: Number, default: 0 },
  performanceScore: { type: Number, default: 0 },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

performanceLogSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

export const PerformanceLog = mongoose.models.PerformanceLog || mongoose.model('PerformanceLog', performanceLogSchema);
