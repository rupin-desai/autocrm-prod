import { ActivityLog } from "../models/ActivityLog";

interface LogActivityParams {
  userId: string;
  userName: string;
  userRole: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'approve' | 'reject' | 'complete' | 'other';
  resource: 'product' | 'order' | 'customer' | 'employee' | 'inventory' | 'supplier' | 'purchase_order' | 'service_visit' | 'attendance' | 'leave' | 'task' | 'communication' | 'feedback' | 'support_ticket' | 'user' | 'other';
  resourceId?: string;
  description: string;
  details?: any;
  ipAddress?: string;
}

export async function logActivity(params: LogActivityParams) {
  try {
    await ActivityLog.create({
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      description: params.description,
      details: params.details,
      ipAddress: params.ipAddress,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
