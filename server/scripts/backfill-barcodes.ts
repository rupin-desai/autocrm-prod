import { connectDB } from '../db';
import { Product, nextProductBarcode } from '../models/Product';

// One-off: gives every product saved before the barcode hook existed its own MAW barcode,
// so it can be scanned and labelled. Only fills blanks, so it is safe to run again.
// Run: MONGODB_URI=<target> npx tsx server/scripts/backfill-barcodes.ts
async function backfillBarcodes() {
  await connectDB();

  const products = await Product.find(
    { $or: [{ barcode: { $exists: false } }, { barcode: null }, { barcode: /^\s*$/ }] },
    { _id: 1 },
  ).sort({ createdAt: 1 }).lean();

  // updateOne, not save: legacy records may fail validation, and save() would overwrite a discontinued status.
  for (const product of products as any[]) {
    await Product.updateOne({ _id: product._id }, { barcode: await nextProductBarcode() });
  }

  console.log(`Assigned barcodes to ${products.length} product(s). Total products: ${await Product.countDocuments()}`);
  process.exit(0);
}

backfillBarcodes().catch((error) => {
  console.error('Barcode backfill failed:', error);
  process.exit(1);
});
