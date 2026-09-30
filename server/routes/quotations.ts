import type { Express } from 'express';
import { Quotation, computeQuotationTotals } from '../models/Quotation';
import { Inquiry } from '../models/Inquiry';
import { Invoice } from '../models/Invoice';
import { Product } from '../models/Product';
import { RegistrationCustomer } from '../models/RegistrationCustomer';
import { RegistrationVehicle } from '../models/RegistrationVehicle';
import { requireAuth, requirePermission } from '../middleware';
import { insertQuotationSchema, updateQuotationSchema } from '../schemas';
import { logActivity } from '../utils/activityLogger';
import { resolveDateRange } from '../utils/dateRange';
import { nextDocumentNumber } from '../utils/documentNumber';
import { sendCustomerUpdate } from '../services/customerUpdates';
import { escapeRegex, handleRouteError, pagedResponse, paginate, sessionUser } from './helpers';

// Requirement 7: Customer Quotation.
//
// A quotation is inert by design. Creating, editing or sending one touches no
// stock, no invoice, no payment and no sales figure. Only POST /:id/convert
// turns it into a real transaction, and that is the single place where this
// module writes to Invoice or moves stock.

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function registerQuotationRoutes(app: Express) {
  app.get('/api/quotations', requireAuth, requirePermission('quotations', 'read'), async (req, res) => {
    try {
      const { status, customerId, search, period, date, month, year, fromDate, toDate } =
        req.query as Record<string, string>;
      const { page, limit, skip } = paginate(req);
      const user = sessionUser(req);

      const query: any = {};
      if (status) query.status = status;
      if (customerId) query.customerId = customerId;

      // A Sales Executive sees the quotations they raised.
      if (user.userRole === 'Sales Executive') {
        query.createdBy = user.userId;
      }

      if (period || date || month || year || fromDate || toDate) {
        const range = resolveDateRange({ period, date, month, year, fromDate, toDate });
        query.quotationDate = { $gte: range.from, $lte: range.to };
      }

      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        query.$or = [
          { quotationNumber: rx },
          { customerName: rx },
          { customerMobile: rx },
          { vehicleNumber: rx },
          { 'items.name': rx },
        ];
      }

      const [items, total, statusCounts] = await Promise.all([
        Quotation.find(query).sort({ quotationDate: -1 }).skip(skip).limit(limit).lean(),
        Quotation.countDocuments(query),
        Quotation.aggregate([
          { $match: query },
          { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$grandTotal' } } },
        ]),
      ]);

      const summary = statusCounts.reduce(
        (acc: any, row: any) => ({ ...acc, [row._id]: { count: row.count, value: round2(row.value) } }),
        {},
      );

      res.json({ ...pagedResponse(items, total, page, limit), summary });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch quotations');
    }
  });

  app.get('/api/quotations/:id', requireAuth, requirePermission('quotations', 'read'), async (req, res) => {
    try {
      const quotation = await Quotation.findById(req.params.id).lean();
      if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
      res.json(quotation);
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch quotation');
    }
  });

  app.post('/api/quotations', requireAuth, requirePermission('quotations', 'create'), async (req, res) => {
    try {
      const data = insertQuotationSchema.parse(req.body);
      const user = sessionUser(req);

      let { customerName, customerMobile, vehicleNumber, vehicleBrand, vehicleModel, vehicleVariant } = data;

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
          vehicleVariant = vehicle.variant;
        }
      }

      // Totals are derived here, never taken from the request.
      const totals = computeQuotationTotals(data.items);

      const quotation = new Quotation({
        ...data,
        ...totals,
        quotationNumber: await nextDocumentNumber('QT', 'quotation'),
        customerName,
        customerMobile,
        vehicleNumber,
        vehicleBrand,
        vehicleModel,
        vehicleVariant,
        quotationDate: data.quotationDate || new Date(),
        status: 'draft',
        createdBy: user.userId,
        createdByName: user.userName,
        createdByRole: user.userRole,
      });
      await quotation.save();

      if (data.inquiryId) {
        await Inquiry.findByIdAndUpdate(data.inquiryId, {
          $set: { status: 'quoted', quotationId: quotation._id },
        });
      }

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'create',
        resource: 'quotation',
        resourceId: quotation._id.toString(),
        description: `Created quotation ${quotation.quotationNumber} for ${quotation.customerName} (₹${quotation.grandTotal})`,
        ipAddress: req.ip,
      });

      res.status(201).json(quotation);
    } catch (error) {
      handleRouteError(res, error, 'Failed to create quotation');
    }
  });

  app.patch('/api/quotations/:id', requireAuth, requirePermission('quotations', 'update'), async (req, res) => {
    try {
      const data = updateQuotationSchema.parse(req.body);
      const user = sessionUser(req);

      const quotation = await Quotation.findById(req.params.id);
      if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

      if (quotation.status === 'converted') {
        return res.status(400).json({ error: 'A converted quotation can no longer be edited' });
      }

      if (data.items) {
        const totals = computeQuotationTotals(data.items);
        Object.assign(quotation, totals);
        delete (data as any).items;
      }

      const reminderChanged =
        (data.reminderDays !== undefined && data.reminderDays !== quotation.reminderDays) ||
        data.expectedVisitDate !== undefined;

      Object.assign(quotation, data);
      if (reminderChanged) quotation.reminderSentAt = undefined;

      await quotation.save();

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'update',
        resource: 'quotation',
        resourceId: quotation._id.toString(),
        description: `Updated quotation ${quotation.quotationNumber}`,
        ipAddress: req.ip,
      });

      res.json(quotation);
    } catch (error) {
      handleRouteError(res, error, 'Failed to update quotation');
    }
  });

  // Share with the customer. Still changes nothing financial.
  app.post('/api/quotations/:id/send', requireAuth, requirePermission('quotations', 'update'), async (req, res) => {
    try {
      const user = sessionUser(req);
      const quotation = await Quotation.findById(req.params.id);
      if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

      if (quotation.status === 'converted') {
        return res.status(400).json({ error: 'This quotation has already been converted' });
      }

      const update = await sendCustomerUpdate({
        kind: 'quotation_shared',
        to: quotation.customerMobile,
        customerId: quotation.customerId?.toString(),
        handledBy: user.userId,
        context: {
          customerName: quotation.customerName,
          vehicleNumber: quotation.vehicleNumber,
          totalAmount: quotation.grandTotal,
          extra: quotation.validUntil
            ? `Valid until ${new Date(quotation.validUntil).toLocaleDateString('en-IN')}.`
            : undefined,
        },
      });

      if (quotation.status === 'draft') {
        quotation.status = 'sent';
        await quotation.save();
      }

      res.json({ quotation, whatsappUpdate: update });
    } catch (error) {
      handleRouteError(res, error, 'Failed to send quotation');
    }
  });

  /**
   * The one place a quotation becomes a real transaction. Creates a
   * pending_approval invoice and moves stock through the same path the rest of
   * the app uses, then locks the quotation.
   */
  app.post('/api/quotations/:id/convert', requireAuth, requirePermission('quotations', 'convert'), async (req, res) => {
    try {
      const user = sessionUser(req);
      const quotation = await Quotation.findById(req.params.id);
      if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

      if (quotation.status === 'converted') {
        return res.status(400).json({
          error: 'This quotation has already been converted',
          invoiceId: quotation.convertedInvoiceId,
        });
      }
      if (['rejected', 'expired'].includes(quotation.status)) {
        return res.status(400).json({ error: `Cannot convert a ${quotation.status} quotation` });
      }
      if (!quotation.items?.length) {
        return res.status(400).json({ error: 'Cannot convert a quotation with no items' });
      }

      // An invoice must belong to a registered customer.
      if (!quotation.customerId) {
        return res.status(400).json({
          error: 'This quotation is not linked to a registered customer. Register the customer first, then convert.',
          code: 'CUSTOMER_NOT_REGISTERED',
        });
      }

      const customer = await RegistrationCustomer.findById(quotation.customerId).lean() as any;
      if (!customer) return res.status(404).json({ error: 'Linked customer no longer exists' });

      // Re-price against the live catalogue: a quotation may be weeks old.
      const items = [] as any[];
      const priceChanges: any[] = [];

      for (const item of quotation.items as any[]) {
        let unitPrice = item.rate;

        if (item.productId) {
          const product = await Product.findById(item.productId).lean() as any;
          if (product && Number(product.sellingPrice) !== Number(item.rate)) {
            priceChanges.push({
              name: item.name,
              quotedRate: item.rate,
              currentRate: product.sellingPrice,
            });
            if (req.body?.useCurrentPrices) unitPrice = product.sellingPrice;
          }
        }

        const gross = round2(unitPrice * item.quantity);
        const discount = round2((gross * (item.discountPercent || 0)) / 100);
        const net = round2(gross - discount);
        const gstAmount = round2((net * (item.taxPercent || 0)) / 100);

        items.push({
          type: 'product',
          productId: item.productId ? String(item.productId) : undefined,
          name: item.name,
          description: item.description,
          isLabourCharge: !item.productId,
          quantity: item.quantity,
          unitPrice,
          total: round2(net + gstAmount),
          hasGst: (item.taxPercent || 0) > 0,
          gstPercentage: item.taxPercent || 0,
          gstAmount,
        });
      }

      // Surface price drift and let the caller decide, rather than silently
      // billing a stale rate.
      if (priceChanges.length && !req.body?.useCurrentPrices && !req.body?.keepQuotedPrices) {
        return res.status(409).json({
          error: 'Catalogue prices have changed since this quotation was raised',
          code: 'PRICE_CHANGED',
          priceChanges,
          hint: 'Re-send with useCurrentPrices:true to bill at current prices, or keepQuotedPrices:true to honour the quote.',
        });
      }

      const subtotal = round2(items.reduce((sum, i) => sum + i.total, 0));

      const invoice = new Invoice({
        invoiceNumber: await nextDocumentNumber('INV', 'invoice'),
        customerId: customer._id,
        customerDetails: {
          referenceCode: customer.referenceCode,
          fullName: customer.fullName,
          mobileNumber: customer.mobileNumber,
          alternativeNumber: customer.alternativeNumber,
          email: customer.email,
          address: customer.address,
          city: customer.city,
          taluka: customer.taluka,
          district: customer.district,
          state: customer.state,
          pinCode: customer.pinCode,
          isVerified: customer.isVerified,
          registrationDate: customer.createdAt,
        },
        vehicleDetails: quotation.vehicleNumber
          ? [{
              vehicleId: quotation.vehicleId ? String(quotation.vehicleId) : undefined,
              vehicleNumber: quotation.vehicleNumber,
              vehicleBrand: quotation.vehicleBrand,
              vehicleModel: quotation.vehicleModel,
              variant: quotation.vehicleVariant,
            }]
          : [],
        items,
        subtotal,
        discountType: 'none',
        discountValue: 0,
        discountAmount: 0,
        taxRate: 0,
        taxAmount: 0,
        totalAmount: subtotal,
        dueAmount: subtotal,
        createdBy: user.userId,
        status: 'pending_approval',
        notes: `Converted from quotation ${quotation.quotationNumber}`,
        terms: quotation.terms,
      });

      await invoice.save();

      // Move stock through the shared path, and unwind the invoice if it fails.
      try {
        const { applyInvoiceStockAdjustment } = await import('../routes');
        await applyInvoiceStockAdjustment(invoice, user.userId);
      } catch (stockError) {
        await Invoice.findByIdAndDelete(invoice._id);
        throw stockError;
      }

      quotation.status = 'converted';
      quotation.convertedInvoiceId = invoice._id;
      quotation.convertedAt = new Date();
      quotation.convertedBy = user.userId as any;
      await quotation.save();

      if (quotation.inquiryId) {
        await Inquiry.findByIdAndUpdate(quotation.inquiryId, { $set: { status: 'converted' } });
      }

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'update',
        resource: 'quotation',
        resourceId: quotation._id.toString(),
        description: `Converted quotation ${quotation.quotationNumber} into invoice ${invoice.invoiceNumber}`,
        details: { invoiceId: invoice._id.toString(), priceChanges },
        ipAddress: req.ip,
      });

      res.status(201).json({ quotation, invoice, priceChanges });
    } catch (error) {
      handleRouteError(res, error, 'Failed to convert quotation');
    }
  });

  app.delete('/api/quotations/:id', requireAuth, requirePermission('quotations', 'delete'), async (req, res) => {
    try {
      const user = sessionUser(req);
      const quotation = await Quotation.findById(req.params.id);
      if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

      if (quotation.status === 'converted') {
        return res.status(400).json({
          error: 'A converted quotation cannot be deleted because an invoice depends on it',
        });
      }

      await Quotation.findByIdAndDelete(req.params.id);

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'delete',
        resource: 'quotation',
        resourceId: req.params.id,
        description: `Deleted quotation ${quotation.quotationNumber}`,
        ipAddress: req.ip,
      });

      res.json({ success: true });
    } catch (error) {
      handleRouteError(res, error, 'Failed to delete quotation');
    }
  });
}
