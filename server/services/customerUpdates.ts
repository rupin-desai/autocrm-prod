import { CommunicationLog } from '../models/CommunicationLog';
import { WHATSAPP_TEMPLATES, sendWhatsAppTemplateMessage } from './whatsapp';

// Requirement 6: automatic WhatsApp updates to the customer at important
// work and payment stages. Message text is generated from CRM transaction
// data, and every attempt is logged in the CRM whether or not it delivered.

export type CustomerUpdateKind =
  | 'work_started'
  | 'work_updated'
  | 'work_completed'
  | 'payment_received'
  | 'advance_received'
  | 'quotation_shared'
  | 'warranty_update';

const TEMPLATE_BY_KIND: Record<CustomerUpdateKind, string> = {
  work_started: WHATSAPP_TEMPLATES.workStarted,
  work_updated: WHATSAPP_TEMPLATES.workUpdated,
  work_completed: WHATSAPP_TEMPLATES.workCompleted,
  payment_received: WHATSAPP_TEMPLATES.paymentReceived,
  advance_received: WHATSAPP_TEMPLATES.advanceReceived,
  quotation_shared: WHATSAPP_TEMPLATES.quotationShared,
  warranty_update: WHATSAPP_TEMPLATES.warrantyUpdate,
};

export const formatAmount = (n: number) =>
  `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export interface CustomerUpdateContext {
  customerName: string;
  vehicleNumber?: string;
  workDescription?: string;
  /** Value of the work as it stood before this change. */
  previousAmount?: number;
  /** Value of what was just added. */
  addedAmount?: number;
  /** Revised total after this change. */
  totalAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  invoiceNumber?: string;
  paymentMode?: string;
  addedItems?: Array<{ name: string; quantity?: number; total?: number }>;
  extra?: string;
}

/**
 * Builds the human-readable message for a stage change. This is the CRM's
 * record of what the customer was told, and also supplies the positional
 * parameters for the approved WhatsApp template.
 */
export function buildCustomerUpdateMessage(
  kind: CustomerUpdateKind,
  ctx: CustomerUpdateContext,
): { message: string; params: string[] } {
  const vehicle = ctx.vehicleNumber ? ` (${ctx.vehicleNumber})` : '';
  const work = ctx.workDescription || 'your vehicle work';

  switch (kind) {
    case 'work_started': {
      const message =
        `Hello ${ctx.customerName}, work has started on ${work}${vehicle}. ` +
        `Estimated value: ${formatAmount(ctx.totalAmount || 0)}. We will keep you updated.`;
      return { message, params: [ctx.customerName, work + vehicle, formatAmount(ctx.totalAmount || 0)] };
    }

    case 'work_updated': {
      const itemLines = (ctx.addedItems || [])
        .map((i) => `${i.name}${i.quantity && i.quantity > 1 ? ` x${i.quantity}` : ''}`)
        .join(', ');
      const message =
        `Hello ${ctx.customerName}, additional items have been added to ${work}${vehicle}.` +
        (itemLines ? ` Added: ${itemLines}.` : '') +
        ` Additional amount: ${formatAmount(ctx.addedAmount || 0)}.` +
        ` Previous total: ${formatAmount(ctx.previousAmount || 0)}.` +
        ` Revised total: ${formatAmount(ctx.totalAmount || 0)}.`;
      return {
        message,
        params: [
          ctx.customerName,
          itemLines || 'additional items',
          formatAmount(ctx.addedAmount || 0),
          formatAmount(ctx.totalAmount || 0),
        ],
      };
    }

    case 'work_completed': {
      const message =
        `Hello ${ctx.customerName}, ${work}${vehicle} is complete. ` +
        `Total: ${formatAmount(ctx.totalAmount || 0)}.` +
        (ctx.dueAmount && ctx.dueAmount > 0 ? ` Amount due: ${formatAmount(ctx.dueAmount)}.` : '');
      return { message, params: [ctx.customerName, work + vehicle, formatAmount(ctx.totalAmount || 0)] };
    }

    case 'payment_received': {
      const settled = (ctx.dueAmount || 0) <= 0.01;
      const message =
        `Hello ${ctx.customerName}, we have received your payment of ${formatAmount(ctx.paidAmount || 0)}` +
        (ctx.paymentMode ? ` by ${ctx.paymentMode}` : '') +
        (ctx.invoiceNumber ? ` against invoice ${ctx.invoiceNumber}` : '') + '. ' +
        (settled
          ? 'Your bill is fully settled. Thank you!'
          : `Balance due: ${formatAmount(ctx.dueAmount || 0)}.`);
      return {
        message,
        params: [
          ctx.customerName,
          formatAmount(ctx.paidAmount || 0),
          ctx.invoiceNumber || '-',
          settled ? 'Fully paid' : formatAmount(ctx.dueAmount || 0),
        ],
      };
    }

    case 'advance_received': {
      const message =
        `Hello ${ctx.customerName}, we have received your advance payment of ${formatAmount(ctx.paidAmount || 0)}` +
        (ctx.paymentMode ? ` by ${ctx.paymentMode}` : '') +
        ` for ${work}. Thank you.`;
      return { message, params: [ctx.customerName, formatAmount(ctx.paidAmount || 0), work] };
    }

    case 'quotation_shared': {
      const message =
        `Hello ${ctx.customerName}, your quotation${vehicle} is ready. ` +
        `Estimated total: ${formatAmount(ctx.totalAmount || 0)}.` +
        (ctx.extra ? ` ${ctx.extra}` : '');
      return { message, params: [ctx.customerName, formatAmount(ctx.totalAmount || 0), ctx.extra || ''] };
    }

    case 'warranty_update': {
      const message =
        `Hello ${ctx.customerName}, an update on your warranty item${vehicle}: ${ctx.extra || 'status updated'}.`;
      return { message, params: [ctx.customerName, ctx.extra || 'status updated'] };
    }
  }
}

export interface SendCustomerUpdateResult {
  sent: boolean;
  skipped?: string;
  error?: string;
  message: string;
  providerMessageId?: string;
}

/**
 * Generates, sends and logs a stage update. Never throws: a messaging failure
 * must not roll back the business transaction that triggered it.
 */
export async function sendCustomerUpdate({
  kind,
  to,
  customerId,
  context,
  handledBy,
}: {
  kind: CustomerUpdateKind;
  to?: string | null;
  customerId?: string | null;
  context: CustomerUpdateContext;
  handledBy?: string | null;
}): Promise<SendCustomerUpdateResult> {
  const { message, params } = buildCustomerUpdateMessage(kind, context);

  const log = async (status: string, error?: string, providerMessageId?: string) => {
    if (!customerId) return;
    try {
      await CommunicationLog.create({
        customerId,
        type: 'whatsapp',
        direction: 'outbound',
        subject: `Auto update: ${kind}`,
        message: `${message}${status === 'sent' ? '' : ` [${status}${error ? `: ${error}` : ''}]`}`,
        handledBy: handledBy || undefined,
        date: new Date(),
      });
    } catch (logError) {
      console.error('Failed to write communication log:', logError);
    }
    if (providerMessageId) {
      console.log(`Customer update ${kind} accepted, provider id ${providerMessageId}`);
    }
  };

  const mobile = String(to || '').trim();
  if (!mobile || mobile === '0000000000') {
    await log('skipped_no_phone');
    return { sent: false, skipped: 'no_phone', message };
  }

  const templateName = TEMPLATE_BY_KIND[kind];
  if (!templateName) {
    // The message is still recorded so staff can see what would have gone out.
    await log('skipped_no_template');
    return { sent: false, skipped: 'no_template_configured', message };
  }

  try {
    const result = await sendWhatsAppTemplateMessage({
      to: mobile,
      templateName,
      bodyParams: params,
      logLabel: `Customer update (${kind})`,
    });

    await log(result.success ? 'sent' : 'failed', result.error, result.providerMessageId);
    return {
      sent: result.success,
      error: result.success ? undefined : result.error,
      message,
      providerMessageId: result.providerMessageId,
    };
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Unknown error';
    await log('failed', err);
    return { sent: false, error: err, message };
  }
}
