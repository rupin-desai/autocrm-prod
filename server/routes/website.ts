import type { Express } from 'express';
import { Product } from '../models/Product';
import { requireAuth, requirePermission } from '../middleware';
import { bulkWebsiteVisibilitySchema, websiteVisibilitySchema } from '../schemas';
import { logActivity } from '../utils/activityLogger';
import { escapeRegex, handleRouteError, pagedResponse, paginate, sessionUser } from './helpers';

// Requirement 8: E-commerce website product selection.
// Staff choose which catalogue items appear on the storefront. Only flagged
// products are exposed by the public feed; everything else stays internal.

export function registerWebsiteRoutes(app: Express) {
  // --- CRM side: choose what is published ---
  app.get('/api/website/products', requireAuth, requirePermission('website', 'read'), async (req, res) => {
    try {
      const { search, category, visibility } = req.query as Record<string, string>;
      const { page, limit, skip } = paginate(req);

      const query: any = {};
      if (category) query.category = category;
      if (visibility === 'shown') query.showOnWebsite = true;
      if (visibility === 'hidden') query.showOnWebsite = { $ne: true };

      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        query.$or = [{ productName: rx }, { brand: rx }, { category: rx }, { barcode: rx }];
      }

      const [items, total, shownCount] = await Promise.all([
        Product.find(query)
          .select('productName brand model category mrp sellingPrice stockQty status showOnWebsite websiteTitle websiteDescription websitePrice websiteUpdatedAt')
          .sort({ productName: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(query),
        Product.countDocuments({ showOnWebsite: true }),
      ]);

      res.json({ ...pagedResponse(items, total, page, limit), publishedCount: shownCount });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch website products');
    }
  });

  app.patch('/api/website/products/:id', requireAuth, requirePermission('website', 'update'), async (req, res) => {
    try {
      const data = websiteVisibilitySchema.parse(req.body);
      const user = sessionUser(req);

      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      product.showOnWebsite = data.showOnWebsite;
      if (data.websiteTitle !== undefined) product.websiteTitle = data.websiteTitle;
      if (data.websiteDescription !== undefined) product.websiteDescription = data.websiteDescription;
      if (data.websitePrice !== undefined && data.websitePrice !== null) product.websitePrice = data.websitePrice;
      product.websiteUpdatedAt = new Date();
      await product.save();

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'update',
        resource: 'website',
        resourceId: product._id.toString(),
        description: `${data.showOnWebsite ? 'Published' : 'Unpublished'} "${product.productName}" on the website`,
        ipAddress: req.ip,
      });

      res.json(product);
    } catch (error) {
      handleRouteError(res, error, 'Failed to update website visibility');
    }
  });

  app.post('/api/website/products/bulk', requireAuth, requirePermission('website', 'update'), async (req, res) => {
    try {
      const data = bulkWebsiteVisibilitySchema.parse(req.body);
      const user = sessionUser(req);

      const result = await Product.updateMany(
        { _id: { $in: data.productIds } },
        { $set: { showOnWebsite: data.showOnWebsite, websiteUpdatedAt: new Date() } },
      );

      await logActivity({
        userId: user.userId,
        userName: user.userName,
        userRole: user.userRole,
        action: 'update',
        resource: 'website',
        description: `${data.showOnWebsite ? 'Published' : 'Unpublished'} ${result.modifiedCount} product(s) on the website`,
        details: { productIds: data.productIds },
        ipAddress: req.ip,
      });

      res.json({ success: true, modified: result.modifiedCount });
    } catch (error) {
      handleRouteError(res, error, 'Failed to bulk update website visibility');
    }
  });

  // --- Public storefront feed ---
  // Read-only, paginated, and limited to the fields a storefront needs. It
  // deliberately exposes no cost, supplier, stock count or internal id beyond
  // what is required to render and order a product.
  app.get('/api/public/website/products', async (req, res) => {
    try {
      const { search, category } = req.query as Record<string, string>;
      const { page, limit, skip } = paginate(req, 24, 100);

      const query: any = { showOnWebsite: true };
      if (category) query.category = category;
      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        query.$or = [{ productName: rx }, { brand: rx }, { websiteTitle: rx }];
      }

      const [products, total] = await Promise.all([
        Product.find(query)
          .select('productName websiteTitle websiteDescription brand model category mrp sellingPrice websitePrice images warranty stockQty modelCompatibility')
          .sort({ productName: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(query),
      ]);

      const items = products.map((p: any) => ({
        id: p._id.toString(),
        name: p.websiteTitle || p.productName,
        description: p.websiteDescription || null,
        brand: p.brand,
        model: p.model,
        category: p.category,
        mrp: p.mrp,
        price: p.websitePrice ?? p.sellingPrice,
        images: p.images || [],
        warranty: p.warranty || null,
        inStock: (Number(p.stockQty) || 0) > 0,
        fitsModels: p.modelCompatibility || [],
      }));

      res.json({ ...pagedResponse(items, total, page, limit) });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch published products');
    }
  });

  app.get('/api/public/website/products/:id', async (req, res) => {
    try {
      const product = await Product.findOne({ _id: req.params.id, showOnWebsite: true })
        .select('productName websiteTitle websiteDescription brand model category mrp sellingPrice websitePrice images warranty stockQty modelCompatibility variants')
        .lean() as any;

      if (!product) return res.status(404).json({ error: 'Product not found' });

      res.json({
        id: product._id.toString(),
        name: product.websiteTitle || product.productName,
        description: product.websiteDescription || null,
        brand: product.brand,
        model: product.model,
        category: product.category,
        mrp: product.mrp,
        price: product.websitePrice ?? product.sellingPrice,
        images: product.images || [],
        warranty: product.warranty || null,
        inStock: (Number(product.stockQty) || 0) > 0,
        fitsModels: product.modelCompatibility || [],
        variants: product.variants || [],
      });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch product');
    }
  });

  app.get('/api/public/website/categories', async (_req, res) => {
    try {
      const categories = await Product.distinct('category', { showOnWebsite: true });
      res.json({ categories: categories.filter(Boolean).sort() });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch categories');
    }
  });
}
