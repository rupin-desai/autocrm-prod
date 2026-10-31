import mongoose from "mongoose";
import { Product } from "../server/models/Product";
import { InventoryTransaction } from "../server/models/InventoryTransaction";

const uri = process.env.MONGODB_URI || process.env.LOCAL_MONGO_URI;
const apply = process.env.INVENTORY_MIGRATION_APPLY === "true";
function fail(message: string): never {
  throw new Error(message);
}
function local(value: string) {
  try {
    const host = new URL(value).hostname;
    return ["127.0.0.1", "localhost", "::1"].includes(host);
  } catch {
    return false;
  }
}
async function main() {
  if (!uri) fail("Set MONGODB_URI or LOCAL_MONGO_URI");
  if (apply && (!local(uri) || process.env.NODE_ENV === "production"))
    fail("Apply mode requires a local non-production MongoDB URI");
  await mongoose.connect(uri);
  const products: any[] = await Product.find({}).lean();
  const report: any = {
    mode: apply ? "apply" : "dry-run",
    productsScanned: products.length,
    manualReview: [],
    changes: 0,
  };
  for (const product of products) {
    const transactions: any[] = await InventoryTransaction.find({
      productId: product._id,
    })
      .sort({ date: 1, createdAt: 1 })
      .lean();
    let calculated = 0;
    let ambiguous = false;
    const seen = new Set<string>();
    for (const transaction of transactions) {
      if (seen.has(String(transaction._id))) ambiguous = true;
      seen.add(String(transaction._id));
      if (transaction.type === "ADJUSTMENT") ambiguous = true;
      else
        calculated += ["IN", "RETURN"].includes(transaction.type)
          ? Number(transaction.quantity || 0)
          : -Number(transaction.quantity || 0);
    }
    const reasons: string[] = [];
    if (!product.companyId || product.ownershipStatus !== "verified")
      reasons.push("missing or unverified company ownership");
    if (ambiguous)
      reasons.push(
        "adjustment or duplicate legacy movement requires manual review",
      );
    if (calculated !== Number(product.stockQty || 0))
      reasons.push(
        `legacy balance ${calculated} differs from Product.stockQty ${Number(product.stockQty || 0)}`,
      );
    if (reasons.length)
      report.manualReview.push({
        productId: String(product._id),
        productName: product.productName,
        reasons,
      });
  }
  console.log(JSON.stringify(report));
  await mongoose.disconnect();
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
