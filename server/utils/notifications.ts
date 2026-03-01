import { Notification } from '../models/Notification';

export type NotificationType = 'low_stock' | 'new_order' | 'payment_due' | 'info';

interface CreateNotificationParams {
  message: string;
  type: NotificationType;
  targetRole?: string;
  relatedId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await Notification.create({
      message: params.message,
      type: params.type,
      read: false,
      targetRole: params.targetRole,
      relatedId: params.relatedId,
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

export async function checkAndNotifyLowStock(product: any) {
  if (product.stockQty <= product.minStockLevel) {
    const productName = product.productName || product.name || 'Unknown Product';
    await createNotification({
      message: `Low stock alert: ${productName} (${product.stockQty} units remaining)`,
      type: 'low_stock',
      targetRole: 'Inventory Manager',
      relatedId: product._id,
    });
  }
}

export async function notifyNewOrder(order: any, customerName: string) {
  await createNotification({
    message: `New order received from ${customerName} - Order #${order.invoiceNumber || order._id}`,
    type: 'new_order',
    targetRole: 'Sales Executive',
    relatedId: order._id,
  });
}

export async function notifyPaymentOverdue(order: any, customerName: string, daysOverdue: number) {
  await createNotification({
    message: `Payment overdue: Order #${order.invoiceNumber || order._id} - ${customerName} (${daysOverdue} days overdue)`,
    type: 'payment_due',
    targetRole: 'Admin',
    relatedId: order._id,
  });
}

export async function notifyPaymentDue(order: any, customerName: string) {
  await createNotification({
    message: `Payment due: Order #${order.invoiceNumber || order._id} - ${customerName}`,
    type: 'payment_due',
    targetRole: 'Sales Executive',
    relatedId: order._id,
  });
}

export async function notifyServiceVisitStatus(visit: any, customerName: string, newStatus: string) {
  const statusMessages: Record<string, string> = {
    inquired: `New service inquiry from ${customerName}`,
    working: `Service work started for ${customerName}`,
    completed: `Service completed for ${customerName}`,
    waiting: `Service waiting for parts - ${customerName}`,
  };

  const message = statusMessages[newStatus] || `Service status updated for ${customerName}: ${newStatus}`;
  
  await createNotification({
    message,
    type: 'info',
    targetRole: 'Service Staff',
    relatedId: visit._id,
  });
}

export async function notifyInventoryAdjustment(product: any, adjustment: any) {
  if (adjustment.type === 'OUT' && product.stockQty <= product.minStockLevel) {
    await checkAndNotifyLowStock(product);
  }
}
