import { AdvancePayment } from '../models/AdvancePayment';
import { Inquiry } from '../models/Inquiry';
import { Notification } from '../models/Notification';
import { Quotation } from '../models/Quotation';
import { WarrantyClaim } from '../models/WarrantyClaim';

// Every module in the v2 requirements carries a user-configurable reminder.
// This sweep turns due reminders into CRM notifications exactly once, using
// reminderSentAt as the idempotency marker so a restart cannot double-fire.

const formatDate = (d?: Date | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const formatAmount = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface ReminderSweepResult {
  advancePayments: number;
  inquiries: number;
  warrantyClaims: number;
  vendorDispatches: number;
  quotations: number;
  total: number;
}

async function raise(opts: {
  message: string;
  source: string;
  relatedId: any;
  dueDate?: Date | null;
  link: string;
}) {
  await Notification.create({
    message: opts.message,
    type: 'reminder',
    source: opts.source,
    relatedId: opts.relatedId,
    dueDate: opts.dueDate || undefined,
    link: opts.link,
    read: false,
  });
}

export async function runReminderSweep(now: Date = new Date()): Promise<ReminderSweepResult> {
  const result: ReminderSweepResult = {
    advancePayments: 0,
    inquiries: 0,
    warrantyClaims: 0,
    vendorDispatches: 0,
    quotations: 0,
    total: 0,
  };

  // --- Advance payments still pending at their reminder date ---
  const advances = await AdvancePayment.find({
    status: 'pending',
    reminderEnabled: true,
    reminderDate: { $lte: now },
    reminderSentAt: { $in: [null, undefined] },
  }).limit(200);

  for (const advance of advances) {
    await raise({
      message:
        `Advance follow-up: ${advance.customerName} paid ${formatAmount(advance.amount)} on ` +
        `${formatDate(advance.receivedDate)} for "${advance.itemOrService}". Pending work not yet closed.`,
      source: 'advance_payment',
      relatedId: advance._id,
      dueDate: advance.reminderDate,
      link: `/advance-payments?highlight=${advance._id}`,
    });
    advance.reminderSentAt = now;
    await advance.save();
    result.advancePayments++;
  }

  // --- Inquiries not yet quoted or closed ---
  const inquiries = await Inquiry.find({
    status: { $in: ['open', 'quoted'] },
    reminderEnabled: true,
    reminderDate: { $lte: now },
    reminderSentAt: { $in: [null, undefined] },
  }).limit(200);

  for (const inquiry of inquiries) {
    const items = (inquiry.items || []).map((i: any) => i.name).join(', ');
    await raise({
      message:
        `Inquiry follow-up: ${inquiry.customerName}` +
        (inquiry.vehicleNumber ? ` (${inquiry.vehicleNumber})` : '') +
        ` asked about ${items || 'items'} on ${formatDate(inquiry.inquiryDate)}.`,
      source: 'inquiry',
      relatedId: inquiry._id,
      dueDate: inquiry.reminderDate,
      link: `/inquiries?highlight=${inquiry._id}`,
    });
    inquiry.reminderSentAt = now;
    await inquiry.save();
    result.inquiries++;
  }

  // --- Warranty items held for the customer, and items out with vendors ---
  const claims = await WarrantyClaim.find({
    status: { $nin: ['delivered_to_customer', 'cancelled'] },
    $or: [
      { reminderEnabled: true, reminderDate: { $lte: now }, reminderSentAt: { $in: [null, undefined] } },
      { 'vendorDispatches.status': 'with_vendor', 'vendorDispatches.reminderDate': { $lte: now } },
    ],
  }).limit(200);

  for (const claim of claims) {
    let dirty = false;

    if (
      claim.reminderEnabled &&
      claim.reminderDate &&
      new Date(claim.reminderDate) <= now &&
      !claim.reminderSentAt
    ) {
      await raise({
        message:
          `Warranty follow-up: ${claim.itemName} x${claim.quantity} received from ${claim.customerName} on ` +
          `${formatDate(claim.receivedDate)} is still unresolved (${claim.status.replace(/_/g, ' ')}).`,
        source: 'warranty_claim',
        relatedId: claim._id,
        dueDate: claim.reminderDate,
        link: `/warranty-claims?highlight=${claim._id}`,
      });
      claim.reminderSentAt = now;
      dirty = true;
      result.warrantyClaims++;
    }

    for (const dispatch of claim.vendorDispatches as any[]) {
      if (
        dispatch.status === 'with_vendor' &&
        dispatch.reminderDate &&
        new Date(dispatch.reminderDate) <= now &&
        !dispatch.reminderSentAt
      ) {
        await raise({
          message:
            `Vendor warranty follow-up: ${dispatch.itemName} x${dispatch.quantity} given to ` +
            `${dispatch.vendorName} on ${formatDate(dispatch.givenDate)} has not come back.`,
          source: 'vendor_warranty',
          relatedId: claim._id,
          dueDate: dispatch.reminderDate,
          link: `/warranty-claims?highlight=${claim._id}&tab=vendor`,
        });
        dispatch.reminderSentAt = now;
        dirty = true;
        result.vendorDispatches++;
      }
    }

    if (dirty) await claim.save();
  }

  // --- Quotations awaiting the customer's expected visit ---
  const quotations = await Quotation.find({
    status: { $in: ['draft', 'sent', 'accepted'] },
    reminderEnabled: true,
    reminderDate: { $lte: now },
    reminderSentAt: { $in: [null, undefined] },
  }).limit(200);

  for (const quotation of quotations) {
    await raise({
      message:
        `Quotation follow-up: ${quotation.quotationNumber} for ${quotation.customerName} ` +
        `(${formatAmount(quotation.grandTotal)})` +
        (quotation.expectedVisitDate ? ` — expected visit ${formatDate(quotation.expectedVisitDate)}.` : '.'),
      source: 'quotation',
      relatedId: quotation._id,
      dueDate: quotation.reminderDate,
      link: `/quotations?highlight=${quotation._id}`,
    });
    quotation.reminderSentAt = now;
    await quotation.save();
    result.quotations++;
  }

  result.total =
    result.advancePayments +
    result.inquiries +
    result.warrantyClaims +
    result.vendorDispatches +
    result.quotations;

  return result;
}

/** Marks quotations past their validity date as expired. */
export async function expireStaleQuotations(now: Date = new Date()): Promise<number> {
  const res = await Quotation.updateMany(
    { status: { $in: ['draft', 'sent'] }, validUntil: { $ne: null, $lt: now } },
    { $set: { status: 'expired' } },
  );
  return res.modifiedCount || 0;
}

let sweepTimer: NodeJS.Timeout | null = null;

/** Starts the periodic sweep. Interval is configurable; default 30 minutes. */
export function startReminderScheduler() {
  if (sweepTimer) return;

  const intervalMs = Number(process.env.REMINDER_SWEEP_INTERVAL_MS || 30 * 60 * 1000);

  const tick = async () => {
    try {
      const expired = await expireStaleQuotations();
      const swept = await runReminderSweep();
      if (swept.total || expired) {
        console.log(
          `[reminders] raised ${swept.total} reminder(s), expired ${expired} quotation(s)`,
        );
      }
    } catch (error) {
      console.error('[reminders] sweep failed:', error);
    }
  };

  // First pass shortly after boot, then on the interval.
  setTimeout(tick, 15_000).unref?.();
  sweepTimer = setInterval(tick, intervalMs);
  sweepTimer.unref?.();
  console.log(`[reminders] scheduler started, interval ${Math.round(intervalMs / 60000)}m`);
}

export function stopReminderScheduler() {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
