import type { Express } from 'express';
import { Inquiry } from '../models/Inquiry';
import { RegistrationCustomer } from '../models/RegistrationCustomer';
import { RegistrationVehicle } from '../models/RegistrationVehicle';
import { requireAuth, requirePermission } from '../middleware';
import { insertInquirySchema, updateInquirySchema } from '../schemas';
import { logActivity } from '../utils/activityLogger';
import { resolveDateRange } from '../utils/dateRange';
import { nextDocumentNumber } from '../utils/documentNumber';
import { escapeRegex, handleRouteError, pagedResponse, paginate, sessionUser } from './helpers';

// Requirement 3: Phase I - Customer Inquiry.
// Records what a customer asked about, with search across customer, vehicle,
// inquiry item, date, salesman and status.

export function registerInquiryRoutes(app: Express) {
  app.get('/api/inquiries', requireAuth, requirePermission('inquiries', 'read'), async (req, res) => {
    try {
      const {
        status, customerId, salesmanId, vehicleNumber, item, search,
        period, date, month, year, fromDate, toDate,
      } = req.query as Record<string, string>;
      const { page, limit, skip } = paginate(req);

      const query: any = {};
      if (status) query.status = status;
      if (customerId) query.customerId = customerId;
      if (salesmanId) query.salesmanId = salesmanId;
      if (vehicleNumber) query.vehicleNumber = new RegExp(escapeRegex(vehicleNumber), 'i');
      if (item) query['items.name'] = new RegExp(escapeRegex(item), 'i');

      if (period || date || month || year || fromDate || toDate) {
        const range = resolveDateRange({ period, date, month, year, fromDate, toDate });
        query.inquiryDate = { $gte: range.from, $lte: range.to };
      }

      // Free-text search spans every field the requirement lists.
      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        query.$or = [
          { inquiryNumber: rx },
          { customerName: rx },
          { customerMobile: rx },
          { vehicleNumber: rx },
          { vehicleBrand: rx },
          { vehicleModel: rx },
          { 'items.name': rx },
          { salesmanName: rx },
          { notes: rx },
        ];
      }

      const [items, total, statusCounts] = await Promise.all([
        Inquiry.find(query).sort({ inquiryDate: -1 }).skip(skip).limit(limit).lean(),
        Inquiry.countDocuments(query),
        Inquiry.aggregate([{ $match: query }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      ]);

      const summary = statusCounts.reduce(
        (acc: Record<string, number>, row: any) => ({ ...acc, [row._id]: row.count }),
        {},
      );

      res.json({ ...pagedResponse(items, total, page, limit), summary });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch inquiries');
    }
  });

  app.get('/api/inquiries/:id', requireAuth, requirePermission('inquiries', 'read'), async (req, res) => {
    try {
      const inquiry = await Inquiry.findById(req.params.id).lean();
      if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
      res.json(inquiry);
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch inquiry');
    }
  });

  app.post('/api/inquiries', requireAuth, requirePermission('inquiries', 'create'), async (req, res) => {
    try {
      const data = insertInquirySchema.parse(req.body);
      const user = sessionUser(req);

      let { customerName, customerMobile, vehicleNumber, vehicleBrand, vehicleModel } = data;

      // Fill from the registration records when the inquiry is linked to them,
      // so the inquiry stays readable even if those records change later.
      if (data.customerId) {
        const customer = await RegistrationCustomer.findById(data.customerId).lean() as any;
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        customerName = customer.fullName;
        customerMobile = customer.mobileNumber;
      }

      if (data.vehicleId) {
        const vehicle = await RegistrationVehicle.findById(data.vehicleId).lean() as any;
        if (vehicle) {
          vehicleNumber = vehicle.vehicleNumber || vehicle.vehicleId;
          vehicleBrand = vehicle.vehicleBrand;
          vehicleModel = vehicle.vehicleModel || vehicle.customModel;
        }
      }

      const inquiry = new Inquiry({
        ...data,
        inquiryNumber: await nextDocumentNumber('INQ', 'inquiry'),
        customerName,
        customerMobile,
        vehicleNumber,
        vehicleBrand,
        vehicleModel,
        inquiryDate: data.inquiryDate || new Date(),
        // Default the salesman to whoever recorded it.
        salesmanId: data.salesmanId || user.userId,
        salesmanName: data.salesmanName || user.userName,
        createdBy: user.userId,
      });
      await inquiry.save();

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'create',
        resource: 'inquiry',
        resourceId: inquiry._id.toString(),
        description: `Recorded inquiry ${inquiry.inquiryNumber} from ${inquiry.customerName}`,
        details: { items: data.items.map((i) => i.name) },
        ipAddress: req.ip,
      });

      res.status(201).json(inquiry);
    } catch (error) {
      handleRouteError(res, error, 'Failed to create inquiry');
    }
  });

  app.patch('/api/inquiries/:id', requireAuth, requirePermission('inquiries', 'update'), async (req, res) => {
    try {
      const data = updateInquirySchema.parse(req.body);
      const user = sessionUser(req);

      const inquiry = await Inquiry.findById(req.params.id);
      if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });

      if (inquiry.status === 'converted' && data.status && data.status !== 'converted') {
        return res.status(400).json({ error: 'A converted inquiry cannot be reopened' });
      }

      const reminderChanged =
        (data.reminderDays !== undefined && data.reminderDays !== inquiry.reminderDays) ||
        data.inquiryDate !== undefined;

      Object.assign(inquiry, data);
      if (reminderChanged) inquiry.reminderSentAt = undefined;

      await inquiry.save();

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'update',
        resource: 'inquiry',
        resourceId: inquiry._id.toString(),
        description: `Updated inquiry ${inquiry.inquiryNumber}`,
        details: data,
        ipAddress: req.ip,
      });

      res.json(inquiry);
    } catch (error) {
      handleRouteError(res, error, 'Failed to update inquiry');
    }
  });

  app.delete('/api/inquiries/:id', requireAuth, requirePermission('inquiries', 'delete'), async (req, res) => {
    try {
      const user = sessionUser(req);
      const inquiry = await Inquiry.findById(req.params.id);
      if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });

      if (inquiry.status === 'converted') {
        return res.status(400).json({ error: 'A converted inquiry cannot be deleted' });
      }

      await Inquiry.findByIdAndDelete(req.params.id);

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'delete',
        resource: 'inquiry',
        resourceId: req.params.id,
        description: `Deleted inquiry ${inquiry.inquiryNumber}`,
        ipAddress: req.ip,
      });

      res.json({ success: true });
    } catch (error) {
      handleRouteError(res, error, 'Failed to delete inquiry');
    }
  });

  // What customers have been asking for, to steer purchasing.
  app.get('/api/inquiries/analytics/top-items', requireAuth, requirePermission('inquiries', 'read'), async (req, res) => {
    try {
      const { period, date, month, year, fromDate, toDate } = req.query as Record<string, string>;
      const range = resolveDateRange({ period: period || 'month', date, month, year, fromDate, toDate });

      const rows = await Inquiry.aggregate([
        { $match: { inquiryDate: { $gte: range.from, $lte: range.to } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: { $toLower: '$items.name' },
            name: { $first: '$items.name' },
            inquiryCount: { $sum: 1 },
            totalQuantity: { $sum: '$items.quantity' },
          },
        },
        { $sort: { inquiryCount: -1 } },
        { $limit: 20 },
      ]);

      res.json({ range: { from: range.from, to: range.to, label: range.label }, items: rows });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch inquiry analytics');
    }
  });
}
