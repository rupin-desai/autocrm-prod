import type { Express } from 'express';
import { AdvancePayment } from '../models/AdvancePayment';
import { Inquiry } from '../models/Inquiry';
import { Invoice } from '../models/Invoice';
import { Quotation } from '../models/Quotation';
import { RegistrationCustomer } from '../models/RegistrationCustomer';
import { ServiceVisit } from '../models/ServiceVisit';
import { WarrantyClaim } from '../models/WarrantyClaim';
import { requireAuth, requirePermission } from '../middleware';
import { previousRange, resolveDateRange } from '../utils/dateRange';
import { escapeRegex, handleRouteError, pagedResponse, paginate } from './helpers';

// Requirement 4: Dashboard date/period-wise data and customer analytics.
//
// Every figure here derives from the same resolved [from, to] window, so
// changing the date, month, year or custom range updates all of them together.
//
// Payment-mode collection is aggregated from the invoice payments[] ledger
// rather than the legacy single paymentMethod field, so split-tender payments
// land in the right buckets and the modes sum to the total collected.

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

async function collectionByMode(from: Date, to: Date) {
  const rows = await Invoice.aggregate([
    { $match: { status: 'approved' } },
    { $unwind: '$payments' },
    { $match: { 'payments.transactionDate': { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$payments.paymentMode',
        amount: { $sum: '$payments.amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const byMode: Record<string, number> = { UPI: 0, Cash: 0, Card: 0, 'Net Banking': 0, Cheque: 0 };
  let total = 0;
  let count = 0;

  for (const row of rows) {
    if (row._id) byMode[row._id] = round2(row.amount);
    total += row.amount;
    count += row.count;
  }

  return { byMode, total: round2(total), count };
}

export function registerDashboardPeriodRoutes(app: Express) {
  /**
   * The period-aware dashboard. Accepts period / date / month / year /
   * fromDate+toDate and returns sales, collection by mode, pending, customer
   * counts and service activity for exactly that window.
   */
  app.get('/api/dashboard/period', requireAuth, async (req, res) => {
    try {
      const { period, date, month, year, fromDate, toDate, compare } = req.query as Record<string, string>;
      const range = resolveDateRange({ period, date, month, year, fromDate, toDate });
      const within = { $gte: range.from, $lte: range.to };

      const [
        salesRows,
        collection,
        pendingRow,
        newCustomers,
        totalCustomers,
        visitingCustomers,
        serviceRows,
        invoiceCount,
        advanceRow,
        inquiryCount,
        quotationRow,
        openWarranties,
      ] = await Promise.all([
        // Billed value of invoices raised in the window
        Invoice.aggregate([
          { $match: { createdAt: within, status: { $in: ['approved', 'pending_approval'] } } },
          {
            $group: {
              _id: '$status',
              total: { $sum: '$totalAmount' },
              paid: { $sum: '$paidAmount' },
              due: { $sum: '$dueAmount' },
              count: { $sum: 1 },
            },
          },
        ]),
        collectionByMode(range.from, range.to),
        // Outstanding across all approved invoices, not just this window
        Invoice.aggregate([
          { $match: { status: 'approved', dueAmount: { $gt: 0 } } },
          { $group: { _id: null, pending: { $sum: '$dueAmount' }, count: { $sum: 1 } } },
        ]),
        RegistrationCustomer.countDocuments({ createdAt: within }),
        RegistrationCustomer.countDocuments({}),
        // Distinct customers who had a service visit in the window
        ServiceVisit.distinct('customerId', { createdAt: within }),
        ServiceVisit.aggregate([
          { $match: { createdAt: within } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Invoice.countDocuments({ createdAt: within }),
        AdvancePayment.aggregate([
          { $match: { receivedDate: within } },
          { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Inquiry.countDocuments({ inquiryDate: within }),
        Quotation.aggregate([
          { $match: { quotationDate: within } },
          { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$grandTotal' } } },
        ]),
        WarrantyClaim.countDocuments({ status: { $nin: ['delivered_to_customer', 'cancelled'] } }),
      ]);

      const sales = salesRows.reduce(
        (acc: any, row: any) => {
          if (row._id === 'approved') {
            acc.approvedValue = round2(row.total);
            acc.approvedCount = row.count;
          } else {
            acc.pendingApprovalValue = round2(row.total);
            acc.pendingApprovalCount = row.count;
          }
          acc.totalBilled += row.total;
          return acc;
        },
        { approvedValue: 0, approvedCount: 0, pendingApprovalValue: 0, pendingApprovalCount: 0, totalBilled: 0 },
      );
      sales.totalBilled = round2(sales.totalBilled);

      const serviceStatus = serviceRows.reduce(
        (acc: Record<string, number>, row: any) => ({ ...acc, [row._id]: row.count }),
        {},
      );

      const quotations = quotationRow.reduce(
        (acc: any, row: any) => {
          acc.byStatus[row._id] = { count: row.count, value: round2(row.value) };
          acc.count += row.count;
          acc.value += row.value;
          return acc;
        },
        { byStatus: {} as Record<string, any>, count: 0, value: 0 },
      );
      quotations.value = round2(quotations.value);

      const payload: any = {
        range: {
          from: range.from,
          to: range.to,
          period: range.period,
          label: range.label,
        },
        sales: {
          billed: sales.totalBilled,
          approved: sales.approvedValue,
          pendingApproval: sales.pendingApprovalValue,
          invoiceCount,
        },
        collection: {
          total: collection.total,
          upi: collection.byMode.UPI,
          cash: collection.byMode.Cash,
          card: collection.byMode.Card,
          netBanking: collection.byMode['Net Banking'],
          cheque: collection.byMode.Cheque,
          paymentCount: collection.count,
        },
        pending: {
          amount: round2(pendingRow[0]?.pending || 0),
          invoiceCount: pendingRow[0]?.count || 0,
        },
        customers: {
          // New registrations inside the window
          added: newCustomers,
          // Distinct customers who actually came in during the window
          visited: (visitingCustomers as any[]).length,
          // All-time total, for the headline card
          total: totalCustomers,
        },
        services: {
          total: serviceRows.reduce((sum: number, r: any) => sum + r.count, 0),
          byStatus: serviceStatus,
        },
        advances: {
          amount: round2(advanceRow[0]?.amount || 0),
          count: advanceRow[0]?.count || 0,
        },
        inquiries: { count: inquiryCount },
        quotations,
        warranties: { open: openWarranties },
      };

      // Optional period-over-period comparison for the headline figures.
      if (compare === 'true') {
        const prev = previousRange(range);
        const prevWithin = { $gte: prev.from, $lte: prev.to };
        const [prevSales, prevCollection, prevCustomers] = await Promise.all([
          Invoice.aggregate([
            { $match: { createdAt: prevWithin, status: { $in: ['approved', 'pending_approval'] } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
          ]),
          collectionByMode(prev.from, prev.to),
          RegistrationCustomer.countDocuments({ createdAt: prevWithin }),
        ]);

        const pct = (curr: number, before: number) =>
          before > 0 ? round2(((curr - before) / before) * 100) : null;

        payload.comparison = {
          range: { from: prev.from, to: prev.to },
          billed: round2(prevSales[0]?.total || 0),
          collection: prevCollection.total,
          customersAdded: prevCustomers,
          change: {
            billed: pct(payload.sales.billed, prevSales[0]?.total || 0),
            collection: pct(payload.collection.total, prevCollection.total),
            customersAdded: pct(payload.customers.added, prevCustomers),
          },
        };
      }

      res.json(payload);
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch dashboard data');
    }
  });

  /**
   * How many customers were added or visited in the selected window, with a
   * breakdown for charting. Requirement: "check how many customers were
   * added/visited in a selected Day, Date Range, Month or Year".
   */
  app.get('/api/dashboard/customer-analytics', requireAuth, async (req, res) => {
    try {
      const { period, date, month, year, fromDate, toDate, groupBy } = req.query as Record<string, string>;
      const range = resolveDateRange({ period, date, month, year, fromDate, toDate });
      const within = { $gte: range.from, $lte: range.to };

      // Pick a sensible bucket size for the window unless told otherwise.
      const spanDays = (range.to.getTime() - range.from.getTime()) / 86_400_000;
      const bucket = groupBy || (spanDays <= 1 ? 'hour' : spanDays <= 62 ? 'day' : spanDays <= 366 ? 'month' : 'year');

      const dateFormat =
        bucket === 'hour' ? '%Y-%m-%d %H:00'
        : bucket === 'day' ? '%Y-%m-%d'
        : bucket === 'month' ? '%Y-%m'
        : '%Y';

      const [added, visited, verified, bySource, total] = await Promise.all([
        RegistrationCustomer.aggregate([
          { $match: { createdAt: within } },
          { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
        ServiceVisit.aggregate([
          { $match: { createdAt: within } },
          {
            $group: {
              _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
              customers: { $addToSet: '$customerId' },
            },
          },
          { $project: { count: { $size: '$customers' } } },
          { $sort: { _id: 1 } },
        ]),
        RegistrationCustomer.countDocuments({ createdAt: within, isVerified: true }),
        RegistrationCustomer.aggregate([
          { $match: { createdAt: within } },
          { $group: { _id: '$referralSource', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        RegistrationCustomer.countDocuments({ createdAt: within }),
      ]);

      const visitedTotal = await ServiceVisit.distinct('customerId', { createdAt: within });

      res.json({
        range: { from: range.from, to: range.to, period: range.period, label: range.label },
        groupBy: bucket,
        totals: {
          added: total,
          verified,
          unverified: total - verified,
          visited: (visitedTotal as any[]).length,
        },
        series: {
          added: added.map((r: any) => ({ bucket: r._id, count: r.count })),
          visited: visited.map((r: any) => ({ bucket: r._id, count: r.count })),
        },
        byReferralSource: bySource.map((r: any) => ({ source: r._id || 'Not specified', count: r.count })),
      });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch customer analytics');
    }
  });

  /**
   * The customers behind those numbers: searchable and filterable by the same
   * day / range / month / year window.
   */
  app.get('/api/dashboard/customer-search', requireAuth, requirePermission('customers', 'read'), async (req, res) => {
    try {
      const { period, date, month, year, fromDate, toDate, search, isVerified, activity } =
        req.query as Record<string, string>;
      const { page, limit, skip } = paginate(req);

      const range = resolveDateRange({ period, date, month, year, fromDate, toDate });
      const within = { $gte: range.from, $lte: range.to };

      const query: any = {};

      if (activity === 'visited') {
        // Customers who had a service visit in the window, whenever they registered.
        const ids = await ServiceVisit.distinct('customerId', { createdAt: within });
        query._id = { $in: ids };
      } else {
        query.createdAt = within;
      }

      if (isVerified !== undefined && isVerified !== '') query.isVerified = isVerified === 'true';

      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        query.$or = [
          { fullName: rx },
          { mobileNumber: rx },
          { referenceCode: rx },
          { email: rx },
          { city: rx },
          { district: rx },
        ];
      }

      const [customers, total] = await Promise.all([
        RegistrationCustomer.find(query)
          .select('referenceCode fullName mobileNumber email city district state isVerified otpRequired otpSkipReason registeredBy registeredByRole createdAt')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        RegistrationCustomer.countDocuments(query),
      ]);

      res.json({
        range: { from: range.from, to: range.to, period: range.period, label: range.label },
        ...pagedResponse(customers, total, page, limit),
      });
    } catch (error) {
      handleRouteError(res, error, 'Failed to search customers');
    }
  });
}
