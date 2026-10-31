import mongoose from "mongoose";
import { PurchaseBill } from "../server/models/PurchaseBill";
import { SupplierPayment } from "../server/models/SupplierPayment";
import { SupplierAdvanceAllocation } from "../server/models/SupplierAdvanceAllocation";
import { PurchaseAccountingSource } from "../server/models/PurchaseAccountingSource";

const uri = process.env.MONGODB_URI || process.env.LOCAL_MONGO_URI;
const apply = process.env.SETTLED_PAISE_BACKFILL_APPLY === "true";

function fail(message: string): never {
  throw new Error(message);
}
function isLocalUri(value: string) {
  try {
    const parsed = new URL(value);
    return (
      !parsed.hostname.includes(".srv") &&
      ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

async function main() {
  if (!uri) fail("Set MONGODB_URI or LOCAL_MONGO_URI");
  if (apply && (!isLocalUri(uri) || process.env.NODE_ENV === "production"))
    fail("Apply mode requires a non-production local MongoDB URI");
  await mongoose.connect(uri);
  const candidates: any[] = await PurchaseBill.find({}).lean();
  const report: any = {
    mode: apply ? "apply" : "dry-run",
    scanned: candidates.length,
    updated: 0,
    manualReview: [],
  };
  for (const bill of candidates) {
    const payments: any[] = await SupplierPayment.find({
      companyId: bill.companyId,
      financialYearId: bill.financialYearId,
      supplierId: bill.supplierId,
      status: "posted",
      "allocations.purchaseBillId": bill._id,
    }).lean();
    const allocations: any[] = await SupplierAdvanceAllocation.find({
      companyId: bill.companyId,
      financialYearId: bill.financialYearId,
      purchaseBillId: bill._id,
      status: "confirmed",
    }).lean();
    const paymentAmount = payments.reduce(
      (sum, payment) =>
        sum +
        payment.allocations
          .filter(
            (item: any) => String(item.purchaseBillId) === String(bill._id),
          )
          .reduce(
            (inner: number, item: any) => inner + Number(item.amountPaise || 0),
            0,
          ),
      0,
    );
    const allocationAmount = allocations.reduce(
      (sum, item) => sum + Number(item.amountPaise || 0),
      0,
    );
    const settlement = paymentAmount + allocationAmount;
    const sourceIds = [
      ...payments.map((item) => ({
        type: "supplier_payment",
        id: item._id,
        voucherId: item.voucherId,
      })),
      ...allocations.map((item) => ({
        type: "advance_allocation",
        id: item._id,
        voucherId: item.voucherId,
      })),
    ];
    const sourceCount = sourceIds.length
      ? await PurchaseAccountingSource.countDocuments({
          companyId: bill.companyId,
          $or: sourceIds.map((item) => ({
            sourceType: item.type,
            sourceId: item.id,
            voucherId: item.voucherId,
          })),
        })
      : 0;
    const reasons: string[] = [];
    if (settlement > Number(bill.grandTotalPaise))
      reasons.push("verified settlement exceeds purchase bill total");
    if (sourceCount !== sourceIds.length)
      reasons.push(
        "one or more posted settlement records lack a matching accounting source",
      );
    const hasStoredSettlement =
      Number.isSafeInteger(bill.settledPaise) && bill.settledPaise >= 0;
    if (hasStoredSettlement && Number(bill.settledPaise) !== settlement)
      reasons.push("stored settledPaise differs from verified settlement");
    if (reasons.length) {
      report.manualReview.push({
        billId: String(bill._id),
        storedSettledPaise: hasStoredSettlement ? bill.settledPaise : null,
        settlementPaise: settlement,
        reasons,
      });
      continue;
    }
    if (apply && !hasStoredSettlement) {
      const updated = await PurchaseBill.updateOne(
        {
          _id: bill._id,
          $or: [{ settledPaise: { $exists: false } }, { settledPaise: null }],
        },
        { $set: { settledPaise: settlement } },
      );
      report.updated += updated.modifiedCount;
    }
  }
  console.log(JSON.stringify(report));
  await mongoose.disconnect();
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
