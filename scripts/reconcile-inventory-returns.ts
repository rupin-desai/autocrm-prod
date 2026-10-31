import mongoose from "mongoose";
import { PurchaseReturn } from "../server/models/PurchaseReturn";
import { SalesReturn } from "../server/models/SalesReturn";
import { InventoryMovement } from "../server/models/InventoryMovement";
import { AccountingVoucher } from "../server/models/AccountingVoucher";

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);
  const purchase = await PurchaseReturn.find({}).lean();
  const sales = await SalesReturn.find({}).lean();
  const report: any = {
    dryRun: true,
    purchaseReturns: { total: purchase.length, manualReview: [] as any[] },
    salesReturns: { total: sales.length, manualReview: [] as any[] },
  };
  for (const item of purchase as any[]) {
    if (!item.lines?.length)
      report.purchaseReturns.manualReview.push({
        id: item._id,
        reason: "missing product-level return lines",
      });
    for (const line of item.lines || []) {
      const movement: any = await InventoryMovement.findOne({
        _id: line.originalReceiptMovementId,
        companyId: item.companyId,
        movementType: "purchase_receipt",
        status: "posted",
      }).lean();
      if (!movement)
        report.purchaseReturns.manualReview.push({
          id: item._id,
          lineId: line._id,
          reason: "missing original purchase receipt movement",
        });
    }
    const voucherCount = await AccountingVoucher.countDocuments({
      companyId: item.companyId,
      sourceType: "purchase_return",
      sourceId: item._id,
    });
    if (item.status === "posted" && voucherCount !== 1)
      report.purchaseReturns.manualReview.push({
        id: item._id,
        reason: `expected one purchase return voucher, found ${voucherCount}`,
      });
  }
  for (const item of sales as any[]) {
    if (!item.lines?.length)
      report.salesReturns.manualReview.push({
        id: item._id,
        reason: "missing product-level return lines",
      });
    for (const line of item.lines || []) {
      const movement: any = await InventoryMovement.findOne({
        _id: line.originalSalesIssueMovementId,
        companyId: item.companyId,
        movementType: "sales_issue",
        status: "posted",
      }).lean();
      if (!movement)
        report.salesReturns.manualReview.push({
          id: item._id,
          lineId: line._id,
          reason: "missing original sales issue movement",
        });
    }
    const voucherCount = await AccountingVoucher.countDocuments({
      companyId: item.companyId,
      sourceType: "sales_return",
      sourceId: item._id,
    });
    if (item.status === "posted" && voucherCount !== 1)
      report.salesReturns.manualReview.push({
        id: item._id,
        reason: `expected one sales return voucher, found ${voucherCount}`,
      });
  }
  report.purchaseReturns.manualReviewCount =
    report.purchaseReturns.manualReview.length;
  report.salesReturns.manualReviewCount =
    report.salesReturns.manualReview.length;
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
};
run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
