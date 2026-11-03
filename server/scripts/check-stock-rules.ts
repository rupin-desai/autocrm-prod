import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import session from 'express-session';
import mongoose from 'mongoose';
import { registerRoutes, applyInvoiceStockAdjustment } from '../routes';
import { authenticateUser, createUser } from '../auth';
import { Product } from '../models/Product';
import { InventoryTransaction } from '../models/InventoryTransaction';
import { ProductReturn } from '../models/ProductReturn';
import { ActivityLog } from '../models/ActivityLog';
import { User } from '../models/User';

// Self-check for the stock rules, run through the real routes. It wipes its database, so it
// refuses any database without "test" in the name.
// Run: MONGODB_URI=mongodb://127.0.0.1:27017/autocrm_stock_test npx tsx server/scripts/check-stock-rules.ts
const dbName = new URL(process.env.MONGODB_URI || 'mongodb://x/none').pathname.slice(1);
if (!dbName.includes('test')) {
  console.error(`Refusing to run against "${dbName || 'the default database'}": name must contain "test".`);
  process.exit(1);
}

async function main() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'stock-check', resave: false, saveUninitialized: true }));
  let admin: any;
  app.use((req, _res, next) => {
    Object.assign((req as any).session, { userId: admin?._id.toString(), userRole: 'Admin', userName: 'Check' });
    next();
  });
  const server = await registerRoutes(app);
  await mongoose.connection.dropDatabase();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text, json: text ? JSON.parse(text) : null };
  };

  admin = await createUser('check@test.local', 'secret-pass', 'Check Admin', 'Admin', '9000000001');
  const newProduct = (name: string, stockQty: number) =>
    Product.create({ productName: name, brand: 'B', category: 'C', mrp: 10, sellingPrice: 10, stockQty, minStockLevel: 1 });
  const stock = async (p: any) => (await Product.findById(p._id).lean() as any).stockQty;
  const tx = (p: any, type: string, quantity: unknown, reason = 'check') =>
    call('POST', '/api/inventory-transactions', { productId: p._id, type, quantity, reason });

  // Problem 1: password hashes stay out of responses, and login still works without them.
  const hashed = await newProduct('Hash', 5);
  assert.equal((await tx(hashed, 'IN', 1)).status, 200);
  const list = await call('GET', '/api/inventory-transactions');
  assert.ok(!list.text.includes('passwordHash') && !list.text.includes('$2'), 'hash leaked');
  assert.equal(list.json[0].userId.name, 'Check Admin');
  assert.ok(await authenticateUser('check@test.local', 'secret-pass'), 'login broke');
  assert.equal(await authenticateUser('check@test.local', 'wrong'), null);
  const loaded: any = await User.findById(admin._id);
  loaded.name = 'Check Admin';
  await loaded.save(); // required hash is deselected; saving must still pass

  // Problem 2: deleting reverses only this entry, is logged, and is blocked when linked.
  const del = await newProduct('Delete', 10);
  const adjust = (await tx(del, 'ADJUSTMENT', 3)).json.transaction;
  await tx(del, 'IN', 2);
  assert.equal((await call('DELETE', `/api/inventory-transactions/${adjust._id}`)).status, 200);
  assert.equal(await stock(del), 12, 'later movement was wiped'); // 5 + the 7 the adjustment removed
  assert.equal(await ActivityLog.countDocuments({ resourceId: adjust._id }), 1, 'delete not logged');

  const doubled = (await tx(del, 'IN', 4)).json.transaction;
  const deletes = await Promise.all([1, 2].map(() => call('DELETE', `/api/inventory-transactions/${doubled._id}`)));
  assert.equal(deletes.filter((d) => d.status === 200).length, 1);
  assert.equal(await stock(del), 12, 'double delete reversed twice');

  const spent = await newProduct('Spent', 0);
  const received = (await tx(spent, 'IN', 5)).json.transaction;
  await tx(spent, 'OUT', 4);
  assert.equal((await call('DELETE', `/api/inventory-transactions/${received._id}`)).status, 409);
  assert.equal(await stock(spent), 1);
  assert.ok(await InventoryTransaction.exists({ _id: received._id }), 'refused delete lost the entry');

  const billed = await newProduct('Billed', 5);
  const invoice = { invoiceNumber: 'INV/2026/0001', items: [{ type: 'product', productId: billed._id, quantity: 2, name: 'Billed' }], save: async () => {} };
  await applyInvoiceStockAdjustment(invoice);
  const invoiced: any = await InventoryTransaction.findOne({ productId: billed._id });
  assert.equal((await call('DELETE', `/api/inventory-transactions/${invoiced._id}`)).status, 409, 'invoice entry deletable');
  assert.equal(await stock(billed), 3);
  const rows = (await call('GET', '/api/inventory-transactions')).json;
  assert.equal(rows.find((r: any) => r._id === String(invoiced._id)).canDelete, false);
  assert.equal(rows.find((r: any) => r._id === received._id).canDelete, true);

  // Problem 3: Stock Out cannot go below 0, and a barcode cart only can with an override.
  const low = await newProduct('Low', 2);
  const refused = await tx(low, 'OUT', 3);
  assert.equal(refused.status, 400);
  assert.match(refused.json.error, /Only 2 available/);
  assert.equal(await stock(low), 2);
  const cart = (override?: boolean) => call('POST', '/api/barcode-inventory/stock', { type: 'OUT', items: [{ productId: low._id, quantity: 2, override }] });
  const carts = await Promise.all([cart(), cart()]);
  assert.equal(carts.filter((c) => c.status === 200).length, 1, 'racing carts both applied');
  assert.equal(await stock(low), 0);
  assert.equal((await cart(true)).status, 200);
  assert.equal(await stock(low), -2, 'override must still work');

  // Problem 4: processing a return twice restocks once, and a closed return cannot change.
  const back = await newProduct('Back', 1);
  const ret = (await call('POST', '/api/product-returns', { productId: back._id, quantity: 2, reason: 'r', condition: 'defective', restockable: true })).json;
  const processed = await Promise.all([1, 2].map(() => call('PATCH', `/api/product-returns/${ret._id}`, { status: 'processed', restockable: true })));
  assert.deepEqual(processed.map((p) => p.status).sort(), [200, 409]);
  assert.equal(await stock(back), 3);
  assert.equal(await InventoryTransaction.countDocuments({ returnId: ret._id }), 1);
  assert.equal((await call('PATCH', `/api/product-returns/${ret._id}`, { status: 'rejected' })).status, 409);
  const notStocked = (await call('POST', '/api/product-returns', { productId: back._id, quantity: 9, reason: 'r', condition: 'damaged', restockable: false })).json;
  assert.equal((await call('PATCH', `/api/product-returns/${notStocked._id}`, { status: 'processed' })).status, 200);
  assert.equal(await stock(back), 3, 'non-restockable return added stock');

  // Problem 5: an adjustment can set 0, and blank never counts as 0.
  const zero = await newProduct('Zero', 4);
  assert.equal((await tx(zero, 'ADJUSTMENT', '')).status, 400);
  assert.equal((await tx(zero, 'ADJUSTMENT', 'abc')).status, 400);
  assert.equal(await stock(zero), 4);
  assert.equal((await tx(zero, 'IN', 0)).status, 400);
  assert.equal((await tx(zero, 'ADJUSTMENT', 0)).status, 200);
  assert.equal(await stock(zero), 0);
  assert.equal((await Product.findById(zero._id).lean() as any).status, 'out_of_stock');

  // Problem 6: simultaneous movements all count.
  const busy = await newProduct('Busy', 5);
  await Promise.all(Array.from({ length: 10 }, () => tx(busy, 'IN', 1)));
  assert.equal(await stock(busy), 15, 'lost an IN');
  const outs = await Promise.all(Array.from({ length: 20 }, () => tx(busy, 'OUT', 1)));
  assert.equal(outs.filter((o) => o.status === 200).length, 15);
  assert.equal(await stock(busy), 0, 'oversold under load');

  // Products edit: a change is logged, a price-only save leaves stock alone, negative is refused.
  const edited = await newProduct('Edited', 7);
  const edit = (body: object) => call('PATCH', `/api/products/${edited._id}`, body);
  assert.equal((await edit({ sellingPrice: 20 })).status, 200);
  assert.equal(await stock(edited), 7);
  assert.equal(await InventoryTransaction.countDocuments({ productId: edited._id }), 0);
  assert.equal((await edit({ stockQty: -1 })).status, 400);
  assert.equal((await edit({ stockQty: 4 })).status, 200);
  const logged: any = await InventoryTransaction.findOne({ productId: edited._id }).lean();
  assert.deepEqual([logged.type, logged.previousStock, logged.newStock], ['ADJUSTMENT', 7, 4]);

  // Barcodes: a new part gets the next MAW code, and a scanned label is kept.
  const fresh = (await call('POST', '/api/products', { productName: 'New', brand: 'B', category: 'C', mrp: 1, sellingPrice: 1 })).json;
  assert.match(fresh.barcode, /^MAW-\d{6}$/);
  const labelled = (await call('POST', '/api/products', { productName: 'Label', brand: 'B', category: 'C', mrp: 1, sellingPrice: 1, barcode: '8901234567890' })).json;
  assert.equal(labelled.barcode, '8901234567890');
  assert.equal((await call('GET', '/api/products/barcode/8901234567890')).json._id, labelled._id);
  assert.equal((await call('GET', '/api/products/barcode/MAW-999999')).status, 404);

  await mongoose.connection.dropDatabase();
  console.log('All stock rule checks passed');
  process.exit(0);
}

main().catch(async (error) => {
  console.error('Stock rule check FAILED:', error);
  await mongoose.connection.dropDatabase().catch(() => {});
  process.exit(1);
});
