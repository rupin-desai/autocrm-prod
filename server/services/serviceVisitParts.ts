import { ServiceVisit } from '../models/ServiceVisit';
import { Quotation } from '../models/Quotation';
import { Inquiry } from '../models/Inquiry';
import { Invoice } from '../models/Invoice';
import { Product } from '../models/Product';
import { RegistrationVehicle } from '../models/RegistrationVehicle';
import { getPartById } from '@shared/vehicleData';
import { escapeRegex } from '../routes/helpers';

// The service visit is the job card. Its parts list can be seeded from the
// quotation, the inquiry, or the parts picked at registration, and the
// invoice is then pre-filled from it. These helpers keep those records linked.

export type PartsSource = 'quotation' | 'inquiry' | 'vehicle' | 'manual';

export interface PlannedPart {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  // null when the part is not a catalogue product (no stock to check)
  stockQty: number | null;
}

export interface PartsSourceOption {
  type: Exclude<PartsSource, 'manual'>;
  id?: string;
  label: string;
  status?: string;
  date?: Date;
  // A converted quotation already has an invoice and has already moved stock.
  invoiceId?: string;
  parts: PlannedPart[];
}

const isObjectId = (value: unknown) =>
  typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const LIVE_INVOICE_STATUSES = ['draft', 'pending_approval', 'approved'];

// selectedParts was stored as string[] in older records and as
// {partId, quantity}[] now.
export function normalizeSelectedParts(selectedParts: any): Array<{ partId: string; quantity: number }> {
  if (!selectedParts || !Array.isArray(selectedParts)) {
    return [];
  }

  return selectedParts
    .filter(part => part)
    .map(part => {
      if (typeof part === 'object' && part.partId) {
        return { partId: part.partId, quantity: part.quantity || 1 };
      }
      if (typeof part === 'string') {
        return { partId: part, quantity: 1 };
      }
      return null;
    })
    .filter((part): part is { partId: string; quantity: number } => part !== null);
}

export function findServiceVisitVehicle(visit: any) {
  // RegistrationVehicle stores customerId as a string.
  const customerId = String(visit.customerId?._id || visit.customerId);
  return RegistrationVehicle.findOne({
    customerId,
    $or: [{ vehicleNumber: visit.vehicleReg }, { vehicleId: visit.vehicleReg }],
  }).lean() as Promise<any>;
}

/** Attach live stock to every catalogue part in one query. */
async function withStock(parts: Array<Omit<PlannedPart, 'stockQty'>>): Promise<PlannedPart[]> {
  const ids = Array.from(new Set(parts.map(p => p.productId).filter(isObjectId))) as string[];
  const products = ids.length
    ? await Product.find({ _id: { $in: ids } }, { stockQty: 1 }).lean() as any[]
    : [];
  const stock = new Map(products.map(p => [String(p._id), Number(p.stockQty) || 0]));

  return parts.map(part => ({
    ...part,
    stockQty: part.productId && stock.has(part.productId) ? stock.get(part.productId)! : null,
  }));
}

async function vehiclePartsOption(vehicle: any): Promise<PartsSourceOption | null> {
  const selected = normalizeSelectedParts(vehicle?.selectedParts);
  if (!selected.length) return null;

  const mongoIds = selected
    .map(p => (p.partId.startsWith('product-') ? p.partId.slice('product-'.length) : p.partId))
    .filter(isObjectId);
  const products = mongoIds.length
    ? await Product.find({ _id: { $in: mongoIds } }).lean() as any[]
    : [];
  const byId = new Map(products.map(p => [String(p._id), p]));

  const parts = selected
    .map(({ partId, quantity }) => {
      const mongoId = partId.startsWith('product-') ? partId.slice('product-'.length) : partId;
      const product = byId.get(mongoId);
      if (product) {
        return {
          productId: String(product._id),
          name: product.productName,
          quantity,
          price: Number(product.sellingPrice) || 0,
        };
      }
      const predefined = getPartById(partId);
      if (predefined) {
        return { name: predefined.name, quantity, price: Number(predefined.price) || 0 };
      }
      return null;
    })
    .filter(Boolean) as Array<Omit<PlannedPart, 'stockQty'>>;

  if (!parts.length) return null;
  return { type: 'vehicle', label: 'Parts selected at registration', parts: await withStock(parts) };
}

function quotationOption(quotation: any): Promise<PartsSourceOption> {
  return withStock((quotation.items || []).map((item: any) => {
    // Use the quoted, post-discount unit rate so the job card matches what
    // the customer agreed to.
    const net = Number(item.rate) * (1 - (Number(item.discountPercent) || 0) / 100);
    return {
      productId: item.productId ? String(item.productId) : undefined,
      name: item.name,
      quantity: Number(item.quantity) || 1,
      price: round2(net),
    };
  })).then(parts => ({
    type: 'quotation' as const,
    id: String(quotation._id),
    label: `Quotation ${quotation.quotationNumber}`,
    status: quotation.status,
    date: quotation.quotationDate,
    invoiceId: quotation.convertedInvoiceId ? String(quotation.convertedInvoiceId) : undefined,
    parts,
  }));
}

function inquiryOption(inquiry: any): Promise<PartsSourceOption> {
  return withStock((inquiry.items || []).map((item: any) => ({
    productId: item.productId ? String(item.productId) : undefined,
    name: item.name,
    quantity: Number(item.quantity) || 1,
    price: Number(item.expectedPrice) || 0,
  }))).then(parts => ({
    type: 'inquiry' as const,
    id: String(inquiry._id),
    label: `Inquiry ${inquiry.inquiryNumber}`,
    status: inquiry.status,
    date: inquiry.inquiryDate,
    parts,
  }));
}

/**
 * Records that hold candidate parts for this visit's vehicle, best first:
 * the linked (or latest open) quotation, then the inquiry, then the parts
 * picked at registration.
 */
export async function buildPartsPlan(visitId: string) {
  const visit = await ServiceVisit.findById(visitId).lean() as any;
  if (!visit) return null;

  const vehicle = await findServiceVisitVehicle(visit);
  const regMatch = new RegExp(`^${escapeRegex(String(visit.vehicleReg || '').trim())}$`, 'i');
  const vehicleMatch: any[] = [{ vehicleNumber: regMatch }];
  if (vehicle) vehicleMatch.push({ vehicleId: vehicle._id });

  // A record already claimed by a different visit belongs to that job.
  const unclaimed = { $or: [{ serviceVisitId: null }, { serviceVisitId: visit._id }] };

  const quotation = visit.quotationId
    ? await Quotation.findById(visit.quotationId).lean() as any
    : (await Quotation.find({
        $and: [{ $or: vehicleMatch }, unclaimed],
        status: { $in: ['accepted', 'sent', 'draft', 'converted'] },
        'items.0': { $exists: true },
      }).sort({ quotationDate: -1 }).limit(10).lean() as any[])
        // Prefer one the customer accepted over a newer draft.
        .sort((a, b) => Number(b.status === 'accepted') - Number(a.status === 'accepted'))[0];

  const inquiry = visit.inquiryId
    ? await Inquiry.findById(visit.inquiryId).lean() as any
    : await Inquiry.findOne({
        $and: [{ $or: vehicleMatch }, unclaimed],
        status: { $in: ['open', 'quoted', 'converted'] },
        'items.0': { $exists: true },
      }).sort({ inquiryDate: -1 }).lean() as any;

  const sources = (await Promise.all([
    quotation ? quotationOption(quotation) : null,
    inquiry ? inquiryOption(inquiry) : null,
    vehiclePartsOption(vehicle),
  ])).filter(Boolean) as PartsSourceOption[];

  const current = await withStock((visit.partsUsed || []).map((part: any) => ({
    productId: part.productId ? String(part.productId) : undefined,
    name: part.name || 'Part',
    quantity: Number(part.quantity) || 1,
    price: Number(part.price) || 0,
  })));

  return {
    current,
    currentSource: visit.partsSource || null,
    sources,
  };
}

/** The visit's invoice if it is still live (not rejected or cancelled). */
export async function findLiveVisitInvoice(visit: any) {
  if (!visit?.invoiceId) return null;
  return Invoice.findOne({
    _id: visit.invoiceId,
    status: { $in: LIVE_INVOICE_STATUSES },
  }).lean() as Promise<any>;
}

/**
 * Point the visit at the quotation/inquiry its parts came from, and point
 * those records back at the visit. Passing null unlinks.
 */
export async function linkVisitSources(
  visit: any,
  links: { quotationId?: string | null; inquiryId?: string | null },
) {
  if (links.quotationId !== undefined) {
    const previous = visit.quotationId ? String(visit.quotationId) : null;
    if (previous && previous !== links.quotationId) {
      const unlinked = await Quotation.findOneAndUpdate(
        { _id: previous, serviceVisitId: visit._id },
        { $unset: { serviceVisitId: 1 } },
      ).lean() as any;
      // Drop the invoice the visit only inherited from that quotation.
      if (unlinked?.convertedInvoiceId && String(unlinked.convertedInvoiceId) === String(visit.invoiceId)) {
        visit.invoiceId = undefined;
        visit.invoiceNumber = undefined;
        visit.invoiceDate = undefined;
      }
    }
    if (links.quotationId) {
      const quotation = await Quotation.findById(links.quotationId);
      if (!quotation) {
        throw Object.assign(new Error('Quotation not found'), { statusCode: 404 });
      }
      if (quotation.serviceVisitId && String(quotation.serviceVisitId) !== String(visit._id)) {
        throw Object.assign(
          new Error(`Quotation ${quotation.quotationNumber} is already linked to another service visit`),
          { statusCode: 409 },
        );
      }
      quotation.serviceVisitId = visit._id;
      await quotation.save();
      visit.quotationId = quotation._id;
      // A converted quotation was already billed; the visit shares that invoice
      // so it cannot be billed a second time.
      if (quotation.convertedInvoiceId && !(await findLiveVisitInvoice(visit))) {
        const invoice = await findLiveVisitInvoice({ invoiceId: quotation.convertedInvoiceId });
        if (invoice) {
          visit.invoiceId = invoice._id;
          visit.invoiceNumber = invoice.invoiceNumber;
          visit.invoiceDate = invoice.createdAt;
        }
      }
    } else {
      visit.quotationId = undefined;
    }
  }

  if (links.inquiryId !== undefined) {
    const previous = visit.inquiryId ? String(visit.inquiryId) : null;
    if (previous && previous !== links.inquiryId) {
      await Inquiry.updateOne({ _id: previous, serviceVisitId: visit._id }, { $unset: { serviceVisitId: 1 } });
    }
    if (links.inquiryId) {
      const inquiry = await Inquiry.findById(links.inquiryId);
      if (!inquiry) {
        throw Object.assign(new Error('Inquiry not found'), { statusCode: 404 });
      }
      if (inquiry.serviceVisitId && String(inquiry.serviceVisitId) !== String(visit._id)) {
        throw Object.assign(
          new Error(`Inquiry ${inquiry.inquiryNumber} is already linked to another service visit`),
          { statusCode: 409 },
        );
      }
      inquiry.serviceVisitId = visit._id;
      await inquiry.save();
      visit.inquiryId = inquiry._id;
    } else {
      visit.inquiryId = undefined;
    }
  }
}

export function partsTotal(parts: Array<{ quantity: number; price: number }>) {
  return round2(parts.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.price) || 0), 0));
}
