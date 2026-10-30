import type { Express } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Product, getProductStockStatus } from '../models/Product';
import { InventoryTransaction } from '../models/InventoryTransaction';
import { requireAuth, requirePermission } from '../middleware';
import { checkAndNotifyLowStock } from '../utils/notifications';
import { logActivity } from '../utils/activityLogger';
import { handleRouteError, sessionUser } from './helpers';

// Barcode stock desk. Staff scan parts into a cart and confirm the whole cart
// at once, so stock only changes here, on confirm. Lookup and product creation
// reuse /api/products/barcode/:barcode and POST /api/products.

const stockCartSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  reference: z.string().trim().max(200).optional(),
  items: z.array(z.object({
    productId: z.string().refine((id) => mongoose.isValidObjectId(id), 'Invalid product id'),
    quantity: z.number().int().positive(),
    override: z.boolean().optional(),
  })).min(1).max(200),
});

export function registerBarcodeInventoryRoutes(app: Express) {
  app.post('/api/barcode-inventory/stock', requireAuth, requirePermission('inventory', 'create'), async (req, res) => {
    try {
      const { type, reference, items } = stockCartSchema.parse(req.body);
      const user = sessionUser(req);

      const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } }).lean();
      const byId = new Map(products.map((p: any) => [String(p._id), p]));
      const missing = items.filter((i) => !byId.has(i.productId)).map((i) => i.productId);
      if (missing.length) {
        return res.status(404).json({ error: 'Some products no longer exist', missing });
      }

      if (type === 'OUT') {
        const shortages = items
          .map((i) => ({ productId: i.productId, requested: i.quantity, override: i.override, stockQty: Number(byId.get(i.productId).stockQty) || 0 }))
          .filter((s) => !s.override && s.requested > s.stockQty);
        if (shortages.length) {
          return res.status(400).json({ error: 'Not enough stock', shortages });
        }
      }

      const sign = type === 'IN' ? 1 : -1;
      const updated: any[] = [];
      try {
        for (const item of items) {
          // $inc so two counters scanning the same part cannot overwrite each other's count.
          const product: any = await Product.findByIdAndUpdate(item.productId, { $inc: { stockQty: sign * item.quantity } }, { new: true });
          if (!product) throw new Error(`Product ${item.productId} disappeared during the update`);
          updated.push(product);

          const newStock = Number(product.stockQty) || 0;
          const previousStock = newStock - sign * item.quantity;
          product.status = getProductStockStatus(newStock, product.minStockLevel);
          await Product.updateOne({ _id: product._id }, { status: product.status });
          await InventoryTransaction.create({
            productId: product._id,
            type,
            quantity: item.quantity,
            reason: reference || `Barcode stock ${type}`,
            userId: user.userId,
            previousStock,
            newStock,
            notes: type === 'OUT' && item.quantity > previousStock ? `Override: only ${previousStock} in stock` : undefined,
          });
        }
      } catch (error) {
        // Nothing rolls back, so report the lines already applied; the client drops them instead of applying them twice.
        console.error('Barcode stock update stopped partway:', error);
        return res.status(500).json({
          error: `Stock update stopped after ${updated.length} of ${items.length} items. Applied items were removed from the cart.`,
          appliedProductIds: updated.map((p) => String(p._id)),
        });
      }

      const lowStock = updated.filter((p) => (Number(p.stockQty) || 0) <= (Number(p.minStockLevel) || 0));
      if (type === 'OUT') {
        // Stock is already saved; a failed notification must not turn this into an error.
        await Promise.allSettled(lowStock.map((p) => checkAndNotifyLowStock(p)));
      }

      await logActivity({
        ...user,
        action: 'update',
        resource: 'inventory',
        resourceId: 'barcode-cart',
        description: `Barcode stock ${type}: ${items.length} item(s)${reference ? ` (${reference})` : ''}`,
        details: { items },
        ipAddress: req.ip,
      });

      res.json({ products: updated, lowStock });
    } catch (error) {
      handleRouteError(res, error, 'Failed to update stock');
    }
  });

  app.get('/api/barcode-inventory/movements/:productId', requireAuth, requirePermission('inventory', 'read'), async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.productId)) {
        return res.status(400).json({ error: 'Invalid product id' });
      }
      const movements = await InventoryTransaction.find({ productId: req.params.productId })
        .populate('userId', 'name')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
      res.json(movements);
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch stock movements');
    }
  });
}
