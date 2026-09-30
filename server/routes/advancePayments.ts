import type { Express } from 'express';
import { AdvancePayment } from '../models/AdvancePayment';
import { RegistrationCustomer } from '../models/RegistrationCustomer';
import { RegistrationVehicle } from '../models/RegistrationVehicle';
import { requireAuth, requirePermission } from '../middleware';
import { insertAdvancePaymentSchema, updateAdvancePaymentSchema } from '../schemas';
import { logActivity } from '../utils/activityLogger';
import { resolveDateRange } from '../utils/dateRange';
import { sendCustomerUpdate } from '../services/customerUpdates';
import { escapeRegex, handleRouteError, pagedResponse, paginate, sessionUser } from './helpers';

// Requirement 2: Advance Payment Received.
// Records an advance against a customer and a piece of pending work, with a
// user-editable reminder (default 15 days) linked to that pending work.

export function registerAdvancePaymentRoutes(app: Express) {
  app.get('/api/advance-payments', requireAuth, requirePermission('advancePayments', 'read'), async (req, res) => {
    try {
      const { status, customerId, search, period, date, month, year, fromDate, toDate } = req.query as Record<string, string>;
      const { page, limit, skip } = paginate(req);

      const query: any = {};
      if (status) query.status = status;
      if (customerId) query.customerId = customerId;

      // Only apply a date window when the caller asked for one.
      if (period || date || month || year || fromDate || toDate) {
        const range = resolveDateRange({ period, date, month, year, fromDate, toDate });
        query.receivedDate = { $gte: range.from, $lte: range.to };
      }

      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        query.$or = [
          { customerName: rx },
          { customerMobile: rx },
          { vehicleNumber: rx },
          { itemOrService: rx },
          { relatedWork: rx },
        ];
      }

      const [items, total, totals] = await Promise.all([
        AdvancePayment.find(query).sort({ receivedDate: -1 }).skip(skip).limit(limit).lean(),
        AdvancePayment.countDocuments(query),
        AdvancePayment.aggregate([
          { $match: query },
          {
            $group: {
              _id: '$status',
              amount: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      const summary = totals.reduce(
        (acc: any, row: any) => {
          acc.byStatus[row._id] = { amount: row.amount, count: row.count };
          acc.totalAmount += row.amount;
          acc.totalCount += row.count;
          if (row._id === 'pending') acc.pendingAmount = row.amount;
          return acc;
        },
        { byStatus: {} as Record<string, any>, totalAmount: 0, totalCount: 0, pendingAmount: 0 },
      );

      res.json({ ...pagedResponse(items, total, page, limit), summary });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch advance payments');
    }
  });

  app.get('/api/advance-payments/:id', requireAuth, requirePermission('advancePayments', 'read'), async (req, res) => {
    try {
      const advance = await AdvancePayment.findById(req.params.id).lean();
      if (!advance) return res.status(404).json({ error: 'Advance payment not found' });
      res.json(advance);
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch advance payment');
    }
  });

  app.post('/api/advance-payments', requireAuth, requirePermission('advancePayments', 'create'), async (req, res) => {
    try {
      const data = insertAdvancePaymentSchema.parse(req.body);
      const user = sessionUser(req);

      const customer = await RegistrationCustomer.findById(data.customerId).lean() as any;
      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      let vehicleNumber = data.vehicleNumber;
      if (data.vehicleId) {
        const vehicle = await RegistrationVehicle.findById(data.vehicleId).lean() as any;
        if (vehicle) vehicleNumber = vehicle.vehicleNumber || vehicle.vehicleId;
      }

      const advance = new AdvancePayment({
        ...data,
        customerName: customer.fullName,
        customerMobile: customer.mobileNumber,
        vehicleNumber,
        receivedDate: data.receivedDate || new Date(),
        recordedBy: user.userId,
        recordedByName: user.userName,
      });
      await advance.save();

      // Requirement 6: confirm the advance to the customer automatically.
      const update = await sendCustomerUpdate({
        kind: 'advance_received',
        to: customer.mobileNumber,
        customerId: customer._id.toString(),
        handledBy: user.userId,
        context: {
          customerName: customer.fullName,
          vehicleNumber,
          workDescription: advance.itemOrService,
          paidAmount: advance.amount,
          paymentMode: advance.paymentMode,
        },
      });

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'create',
        resource: 'advance_payment',
        resourceId: advance._id.toString(),
        description: `Recorded advance of ₹${advance.amount} from ${customer.fullName} for ${advance.itemOrService}`,
        ipAddress: req.ip,
      });

      res.status(201).json({ ...advance.toObject(), whatsappUpdate: update });
    } catch (error) {
      handleRouteError(res, error, 'Failed to record advance payment');
    }
  });

  app.patch('/api/advance-payments/:id', requireAuth, requirePermission('advancePayments', 'update'), async (req, res) => {
    try {
      const data = updateAdvancePaymentSchema.parse(req.body);
      const user = sessionUser(req);

      const advance = await AdvancePayment.findById(req.params.id);
      if (!advance) return res.status(404).json({ error: 'Advance payment not found' });

      if (advance.status === 'adjusted' && data.amount !== undefined && data.amount !== advance.amount) {
        return res.status(400).json({ error: 'Cannot change the amount of an advance already adjusted against an invoice' });
      }

      // Changing the reminder window re-derives reminderDate and re-arms the reminder.
      const reminderChanged =
        (data.reminderDays !== undefined && data.reminderDays !== advance.reminderDays) ||
        (data.receivedDate !== undefined);

      Object.assign(advance, data);
      if (reminderChanged) advance.reminderSentAt = undefined;

      await advance.save();

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'update',
        resource: 'advance_payment',
        resourceId: advance._id.toString(),
        description: `Updated advance payment for ${advance.customerName}`,
        details: data,
        ipAddress: req.ip,
      });

      res.json(advance);
    } catch (error) {
      handleRouteError(res, error, 'Failed to update advance payment');
    }
  });

  app.delete('/api/advance-payments/:id', requireAuth, requirePermission('advancePayments', 'delete'), async (req, res) => {
    try {
      const user = sessionUser(req);
      const advance = await AdvancePayment.findById(req.params.id);
      if (!advance) return res.status(404).json({ error: 'Advance payment not found' });

      if (advance.status === 'adjusted') {
        return res.status(400).json({
          error: 'This advance has been adjusted against an invoice and cannot be deleted. Cancel it instead.',
        });
      }

      await AdvancePayment.findByIdAndDelete(req.params.id);

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'delete',
        resource: 'advance_payment',
        resourceId: req.params.id,
        description: `Deleted advance of ₹${advance.amount} from ${advance.customerName}`,
        ipAddress: req.ip,
      });

      res.json({ success: true });
    } catch (error) {
      handleRouteError(res, error, 'Failed to delete advance payment');
    }
  });

  // Pending advances for a customer, used when billing them.
  app.get('/api/advance-payments/customer/:customerId/pending', requireAuth, requirePermission('advancePayments', 'read'), async (req, res) => {
    try {
      const advances = await AdvancePayment.find({
        customerId: req.params.customerId,
        status: 'pending',
      }).sort({ receivedDate: 1 }).lean();

      const totalAvailable = advances.reduce((sum, a: any) => sum + (a.amount || 0), 0);
      res.json({ advances, totalAvailable: Math.round(totalAvailable * 100) / 100 });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch pending advances');
    }
  });
}
