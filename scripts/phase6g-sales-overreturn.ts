import mongoose from "mongoose";
import { Company } from "../server/models/Company";
import { FinancialYear } from "../server/models/FinancialYear";
import { AccountingPeriod } from "../server/models/AccountingPeriod";
import { Invoice } from "../server/models/Invoice";
import { SalesReturn } from "../server/models/SalesReturn";
import { InventoryMovement } from "../server/models/InventoryMovement";
import { postSalesReturnInventory } from "../server/services/inventoryReturns";
const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const company: any = await Company.findOne({ name: "6G Return Test" }).lean();
  const fy: any = await FinancialYear.findOne({
    companyId: company._id,
  }).lean();
  const period: any = await AccountingPeriod.findOne({
    companyId: company._id,
  }).lean();
  const invoice: any = await Invoice.findOne({ companyId: company._id }).lean();
  const movement: any = await InventoryMovement.findOne({
    companyId: company._id,
    movementType: "sales_issue",
  }).lean();
  const product = movement.productId;
  const warehouse = movement.warehouseId;
  const user = company.createdBy;
  const make = (n: number) =>
    SalesReturn.create({
      companyId: company._id,
      financialYearId: fy._id,
      accountingPeriodId: period._id,
      invoiceId: invoice._id,
      returnNumber: `6G-SR-OVER-${n}`,
      reason: "over limit test",
      movementDate: new Date("2026-10-31"),
      idempotencyKey: `6g-over-${n}`,
      status: "approved",
      physicalReceiptAuthorizedBy: user,
      lines: [
        {
          invoiceId: invoice._id,
          invoiceLineReference: "0",
          originalSalesIssueMovementId: movement._id,
          productId: product,
          warehouseId: warehouse,
          returnQuantity: 2,
          originalIssueUnitCostPaise: 100,
          returnValuePaise: 200,
        },
      ],
      createdBy: user,
    });
  const results = await Promise.all(
    [1, 2].map(async (n) => {
      try {
        const item: any = await make(n);
        await postSalesReturnInventory(String(item._id), String(user));
        return "ok";
      } catch {
        return "rejected";
      }
    }),
  );
  const source = await mongoose.connection
    .collection("inventorysourcebalances")
    .findOne({ companyId: company._id, sourceType: "invoice" });
  const count = await InventoryMovement.countDocuments({
    companyId: company._id,
    sourceType: "inventory_return:sales",
  });
  console.log(
    JSON.stringify({
      results,
      returnedQuantity: source?.returnedQuantity,
      movementCount: count,
    }),
  );
  await mongoose.disconnect();
};
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
