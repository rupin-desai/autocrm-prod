import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userRole: { type: String, required: true },
  action: { 
    type: String, 
    enum: [
      'create', 'update', 'delete', 
      'login', 'logout',
      'approve', 'reject', 'complete',
      'other'
    ],
    required: true 
  },
  resource: { 
    type: String,
    enum: [
      'product', 'order', 'customer', 'employee', 
      'inventory', 'supplier', 'purchase_order',
      'service_visit', 'attendance', 'leave', 'task',
      'communication', 'feedback', 'support_ticket', 'user',
      'other'
    ],
    required: true 
  },
  resourceId: { type: String },
  description: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
}, { timestamps: true });

activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ userRole: 1, createdAt: -1 });
activityLogSchema.index({ resource: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
