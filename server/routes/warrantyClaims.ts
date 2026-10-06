import type { Express } from 'express';
import { WarrantyClaim } from '../models/WarrantyClaim';
import { RegistrationCustomer } from '../models/RegistrationCustomer';
import { requireAuth, requirePermission } from '../middleware';
import {
  insertWarrantyClaimSchema,
  resolveVendorDispatchSchema,
  updateWarrantyClaimSchema,
  vendorDispatchSchema,
} from '../schemas';
import { logActivity } from '../utils/activityLogger';
import { resolveDateRange } from '../utils/dateRange';
import { nextDocumentNumber } from '../utils/documentNumber';
import { sendCustomerUpdate } from '../services/customerUpdates';
import { escapeRegex, handleRouteError, pagedResponse, paginate, sessionUser } from './helpers';

// Requirement 5: Warranty Management.
// Customer side  - item received from the customer, with a reminder.
// Vendor side    - item sent out to a vendor to be fixed, tracked until it
//                  comes back. Both live on one claim so the item can be
//                  followed end to end.

const STATUS_FLOW: Record<string, string[]> = {
  received: ['with_vendor', 'resolved', 'cancelled'],
  with_vendor: ['returned_from_vendor', 'resolved', 'cancelled'],
  returned_from_vendor: ['resolved', 'with_vendor', 'cancelled'],
  resolved: ['delivered_to_customer', 'cancelled'],
  delivered_to_customer: [],
  cancelled: [],
};

export function registerWarrantyClaimRoutes(app: Express) {
  app.get('/api/warranty-claims', requireAuth, requirePermission('warrantyClaims', 'read'), async (req, res) => {
    try {
      const {
        status, customerId, vendorName, search, openOnly,
        period, date, month, year, fromDate, toDate,
      } = req.query as Record<string, string>;
      const { page, limit, skip } = paginate(req);

      const query: any = {};
      if (status) query.status = status;
      if (customerId) query.customerId = customerId;
      if (vendorName) query['vendorDispatches.vendorName'] = new RegExp(escapeRegex(vendorName), 'i');
      if (openOnly === 'true') query.status = { $nin: ['delivered_to_customer', 'cancelled'] };

      if (period || date || month || year || fromDate || toDate) {
        const range = resolveDateRange({ period, date, month, year, fromDate, toDate });
        query.receivedDate = { $gte: range.from, $lte: range.to };
      }

      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        query.$or = [
          { claimNumber: rx },
          { customerName: rx },
          { customerMobile: rx },
          { vehicleNumber: rx },
          { itemName: rx },
          { problem: rx },
          { 'vendorDispatches.vendorName': rx },
          { 'vendorDispatches.itemName': rx },
        ];
      }

      const [items, total, statusCounts] = await Promise.all([
        WarrantyClaim.find(query).sort({ receivedDate: -1 }).skip(skip).limit(limit).lean(),
        WarrantyClaim.countDocuments(query),
        WarrantyClaim.aggregate([{ $match: query }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      ]);

      const summary = statusCounts.reduce(
        (acc: Record<string, number>, row: any) => ({ ...acc, [row._id]: row.count }),
        {},
      );

      res.json({ ...pagedResponse(items, total, page, limit), summary });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch warranty claims');
    }
  });

  // Flat view of everything currently sitting with a vendor.
  app.get('/api/warranty-claims/vendor-items', requireAuth, requirePermission('warrantyClaims', 'read'), async (req, res) => {
    try {
      const { vendorName, outstandingOnly } = req.query as Record<string, string>;
      const match: any = { 'vendorDispatches.0': { $exists: true } };
      if (vendorName) match['vendorDispatches.vendorName'] = new RegExp(escapeRegex(vendorName), 'i');

      const pipeline: any[] = [
        { $match: match },
        { $unwind: '$vendorDispatches' },
      ];

      if (outstandingOnly === 'true') {
        pipeline.push({ $match: { 'vendorDispatches.status': 'with_vendor' } });
      }

      pipeline.push(
        {
          $project: {
            claimId: '$_id',
            claimNumber: 1,
            customerName: 1,
            customerMobile: 1,
            vehicleNumber: 1,
            claimStatus: '$status',
            dispatch: '$vendorDispatches',
          },
        },
        { $sort: { 'dispatch.givenDate': -1 } },
        { $limit: 200 },
      );

      const rows = await WarrantyClaim.aggregate(pipeline);
      res.json({ items: rows });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch vendor warranty items');
    }
  });

  app.get('/api/warranty-claims/:id', requireAuth, requirePermission('warrantyClaims', 'read'), async (req, res) => {
    try {
      const claim = await WarrantyClaim.findById(req.params.id).lean();
      if (!claim) return res.status(404).json({ error: 'Warranty claim not found' });
      res.json(claim);
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch warranty claim');
    }
  });

  // --- Customer side: receive an item ---
  app.post('/api/warranty-claims', requireAuth, requirePermission('warrantyClaims', 'create'), async (req, res) => {
    try {
      const data = insertWarrantyClaimSchema.parse(req.body);
      const user = sessionUser(req);

      let { customerName, customerMobile } = data;
      if (data.customerId) {
        const customer = await RegistrationCustomer.findById(data.customerId).lean() as any;
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        customerName = customer.fullName;
        customerMobile = customer.mobileNumber;
      }

      const claim = new WarrantyClaim({
        ...data,
        claimNumber: await nextDocumentNumber('WC', 'warranty-claim'),
        customerName,
        customerMobile,
        receivedDate: data.receivedDate || new Date(),
        status: 'received',
        recordedBy: user.userId,
        recordedByName: user.userName,
      });
      await claim.save();

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'create',
        resource: 'warranty_claim',
        resourceId: claim._id.toString(),
        description: `Received warranty item ${claim.itemName} x${claim.quantity} from ${claim.customerName} (${claim.claimNumber})`,
        ipAddress: req.ip,
      });

      res.status(201).json(claim);
    } catch (error) {
      handleRouteError(res, error, 'Failed to create warranty claim');
    }
  });

  app.patch('/api/warranty-claims/:id', requireAuth, requirePermission('warrantyClaims', 'update'), async (req, res) => {
    try {
      const data = updateWarrantyClaimSchema.parse(req.body);
      const user = sessionUser(req);

      const claim = await WarrantyClaim.findById(req.params.id);
      if (!claim) return res.status(404).json({ error: 'Warranty claim not found' });

      // Status moves are constrained to the defined flow.
      if (data.status && data.status !== claim.status) {
        const allowed = STATUS_FLOW[claim.status] || [];
        if (!allowed.includes(data.status)) {
          return res.status(400).json({
            error: `Cannot move a warranty claim from "${claim.status}" to "${data.status}"`,
            allowedTransitions: allowed,
          });
        }
        if (data.status === 'resolved') claim.resolvedAt = new Date();
        if (data.status === 'delivered_to_customer') claim.deliveredAt = new Date();
      }

      const reminderChanged =
        (data.reminderDays !== undefined && data.reminderDays !== claim.reminderDays) ||
        data.receivedDate !== undefined;

      const previousStatus = claim.status;
      Object.assign(claim, data);
      if (reminderChanged) claim.reminderSentAt = undefined;
      await claim.save();

      // Keep the customer informed when the state of their item changes.
      let whatsappUpdate;
      if (data.status && data.status !== previousStatus && claim.customerMobile) {
        whatsappUpdate = await sendCustomerUpdate({
          kind: 'warranty_update',
          to: claim.customerMobile,
          customerId: claim.customerId?.toString(),
          handledBy: user.userId,
          context: {
            customerName: claim.customerName,
            vehicleNumber: claim.vehicleNumber,
            extra: `${claim.itemName} is now "${String(claim.status).replace(/_/g, ' ')}"`,
          },
        });
      }

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'update',
        resource: 'warranty_claim',
        resourceId: claim._id.toString(),
        description: `Updated warranty claim ${claim.claimNumber}` +
          (data.status ? ` (${previousStatus} -> ${data.status})` : ''),
        ipAddress: req.ip,
      });

      res.json({ ...claim.toObject(), whatsappUpdate });
    } catch (error) {
      handleRouteError(res, error, 'Failed to update warranty claim');
    }
  });

  // --- Vendor side: send the item out ---
  app.post('/api/warranty-claims/:id/vendor-dispatch', requireAuth, requirePermission('warrantyClaims', 'update'), async (req, res) => {
    try {
      const data = vendorDispatchSchema.parse(req.body);
      const user = sessionUser(req);

      const claim = await WarrantyClaim.findById(req.params.id);
      if (!claim) return res.status(404).json({ error: 'Warranty claim not found' });

      if (['delivered_to_customer', 'cancelled'].includes(claim.status)) {
        return res.status(400).json({ error: `Cannot dispatch an item on a ${claim.status.replace(/_/g, ' ')} claim` });
      }

      const givenDate = data.givenDate || new Date();
      const reminderDate = new Date(givenDate);
      reminderDate.setDate(reminderDate.getDate() + (data.reminderDays ?? 15));

      claim.vendorDispatches.push({
        ...data,
        givenDate,
        reminderDate,
        status: 'with_vendor',
        recordedBy: user.userId,
        recordedByName: user.userName,
      } as any);

      claim.status = 'with_vendor';
      await claim.save();

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'update',
        resource: 'warranty_claim',
        resourceId: claim._id.toString(),
        description: `Sent ${data.itemName} x${data.quantity} to vendor ${data.vendorName} for claim ${claim.claimNumber}`,
        ipAddress: req.ip,
      });

      res.status(201).json(claim);
    } catch (error) {
      handleRouteError(res, error, 'Failed to record vendor dispatch');
    }
  });

  // --- Vendor side: item comes back ---
  app.patch('/api/warranty-claims/:id/vendor-dispatch/:dispatchId', requireAuth, requirePermission('warrantyClaims', 'update'), async (req, res) => {
    try {
      const data = resolveVendorDispatchSchema.parse(req.body);
      const user = sessionUser(req);

      const claim = await WarrantyClaim.findById(req.params.id);
      if (!claim) return res.status(404).json({ error: 'Warranty claim not found' });

      const dispatch = (claim.vendorDispatches as any).id(req.params.dispatchId);
      if (!dispatch) return res.status(404).json({ error: 'Vendor dispatch not found' });

      if (dispatch.status !== 'with_vendor') {
        return res.status(400).json({ error: `This dispatch is already marked "${dispatch.status}"` });
      }

      dispatch.status = data.status;
      dispatch.returnedDate = data.returnedDate || new Date();
      dispatch.resolution = data.resolution;

      // The claim stays with_vendor while any item is still out.
      const stillOut = (claim.vendorDispatches as any[]).some((d) => d.status === 'with_vendor');
      if (!stillOut && claim.status === 'with_vendor') {
        claim.status = 'returned_from_vendor';
      }

      await claim.save();

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'update',
        resource: 'warranty_claim',
        resourceId: claim._id.toString(),
        description: `Vendor ${dispatch.vendorName} ${data.status} ${dispatch.itemName} for claim ${claim.claimNumber}`,
        ipAddress: req.ip,
      });

      res.json(claim);
    } catch (error) {
      handleRouteError(res, error, 'Failed to update vendor dispatch');
    }
  });

  app.delete('/api/warranty-claims/:id', requireAuth, requirePermission('warrantyClaims', 'delete'), async (req, res) => {
    try {
      const user = sessionUser(req);
      const claim = await WarrantyClaim.findById(req.params.id);
      if (!claim) return res.status(404).json({ error: 'Warranty claim not found' });

      if ((claim.vendorDispatches as any[]).some((d) => d.status === 'with_vendor')) {
        return res.status(400).json({ error: 'Cannot delete a claim while an item is still with a vendor' });
      }

      await WarrantyClaim.findByIdAndDelete(req.params.id);

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'delete',
        resource: 'warranty_claim',
        resourceId: req.params.id,
        description: `Deleted warranty claim ${claim.claimNumber}`,
        ipAddress: req.ip,
      });

      res.json({ success: true });
    } catch (error) {
      handleRouteError(res, error, 'Failed to delete warranty claim');
    }
  });
}
