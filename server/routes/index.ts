import type { Express } from 'express';
import { requireAuth, requireRole } from '../middleware';
import { expireStaleQuotations, runReminderSweep } from '../services/reminders';
import { Notification } from '../models/Notification';
import { handleRouteError, paginate, pagedResponse } from './helpers';
import { registerAdvancePaymentRoutes } from './advancePayments';
import { registerInquiryRoutes } from './inquiries';
import { registerWarrantyClaimRoutes } from './warrantyClaims';
import { registerQuotationRoutes } from './quotations';
import { registerWebsiteRoutes } from './website';
import { registerDashboardPeriodRoutes } from './dashboardPeriod';

// Modules added for the v2 requirements. Kept out of the main routes.ts so
// each feature stays readable on its own.
export function registerV2Routes(app: Express) {
  registerAdvancePaymentRoutes(app);
  registerInquiryRoutes(app);
  registerWarrantyClaimRoutes(app);
  registerQuotationRoutes(app);
  registerWebsiteRoutes(app);
  registerDashboardPeriodRoutes(app);
  registerReminderRoutes(app);
}

function registerReminderRoutes(app: Express) {
  // Due reminders, newest first. Read by the notification bell and the
  // reminders panel.
  app.get('/api/reminders', requireAuth, async (req, res) => {
    try {
      const { source, unreadOnly } = req.query as Record<string, string>;
      const { page, limit, skip } = paginate(req, 25, 100);

      const query: any = { type: 'reminder' };
      if (source) query.source = source;
      if (unreadOnly === 'true') query.read = false;

      const [items, total, unread] = await Promise.all([
        Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Notification.countDocuments(query),
        Notification.countDocuments({ type: 'reminder', read: false }),
      ]);

      res.json({ ...pagedResponse(items, total, page, limit), unreadCount: unread });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch reminders');
    }
  });

  // Manual sweep, so staff do not have to wait for the next scheduled pass.
  app.post('/api/reminders/run-sweep', requireAuth, requireRole('Admin', 'Manager'), async (_req, res) => {
    try {
      const expired = await expireStaleQuotations();
      const result = await runReminderSweep();
      res.json({ ...result, quotationsExpired: expired });
    } catch (error) {
      handleRouteError(res, error, 'Failed to run reminder sweep');
    }
  });
}
