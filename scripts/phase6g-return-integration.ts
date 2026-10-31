import mongoose from "mongoose";
import { Company } from "../server/models/Company";
import { FinancialYear } from "../server/models/FinancialYear";
import { AccountingPeriod } from "../server/models/AccountingPeriod";
import { AccountGroup } from "../server/models/AccountGroup";
import { LedgerAccount } from "../server/models/LedgerAccount";
import { Product } from "../server/models/Product";
import { Warehouse } from "../server/models/Warehouse";
import { Supplier } from "../server/models/Supplier";
import { PurchaseBill } from "../server/models/PurchaseBill";
import { PurchaseReturn } from "../server/models/PurchaseReturn";
import { Invoice } from "../server/models/Invoice";
import { SalesReturn } from "../server/models/SalesReturn";
import { InventoryMovement } from "../server/models/InventoryMovement";
import { InventorySourceBalance } from "../server/models/InventorySourceBalance";
import { WarehouseStock } from "../server/models/WarehouseStock";
import { InventoryAccountingMapping } from "../server/models/InventoryAccountingMapping";
import { PurchaseAccountingMapping } from "../server/models/PurchaseAccountingMapping";
import { AccountingVoucher } from "../server/models/AccountingVoucher";
import { postInventoryMovement } from "../server/services/inventoryMovements";
import {
  postPurchaseReturnInventory,
  postSalesReturnInventory,
} from "../server/services/inventoryReturns";

const id = () => new mongoose.Types.ObjectId();
const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);
  const user = id();
  const company: any = await Company.create({
    name: "6G Return Test",
    legalName: "6G Return Test",
    authorizedUserIds: [user],
    createdBy: user,
  });
  const fy: any = await FinancialYear.create({
    companyId: company._id,
    label: "6G-2026-27",
    startDate: new Date("2026-04-01"),
    endDate: new Date("2027-03-31"),
    status: "active",
    isCurrent: true,
    createdBy: user,
  });
  const period: any = await AccountingPeriod.create({
    companyId: company._id,
    financialYearId: fy._id,
    periodNumber: 1,
    label: "6G",
    startDate: fy.startDate,
    endDate: fy.endDate,
    status: "open",
  });
  const groups: any = {};
  for (const [code, root, balance] of [
    ["A", "assets", "debit"],
    ["E", "expenses", "debit"],
    ["L", "liabilities", "credit"],
    ["I", "income", "credit"],
    ["Q", "equity", "credit"],
  ])
    groups[code] = await AccountGroup.create({
      companyId: company._id,
      name: `6G ${code}`,
      code: `6G-${code}`,
      rootCategory: root,
      normalBalance: balance,
      createdBy: user,
    });
  const ledger = async (
    code: string,
    name: string,
    group: any,
    ledgerType = "general",
  ) =>
    LedgerAccount.create({
      companyId: company._id,
      code: `6G-${code}`,
      name,
      groupId: group._id,
      ledgerType,
      createdBy: user,
    });
  const asset: any = await ledger("ASSET", "Inventory Asset", groups.A);
  const cogs: any = await ledger("COGS", "COGS", groups.E);
  const clearing: any = await ledger("CLEAR", "Receipt Clearing", groups.L);
  const returns: any = await ledger("RET", "Purchase Returns", groups.I);
  const payable: any = await ledger(
    "PAY",
    "Supplier Payable",
    groups.L,
    "supplier",
  );
  const opening: any = await ledger("OPEN", "Opening", groups.Q);
  await InventoryAccountingMapping.create({
    companyId: company._id,
    inventoryAssetLedgerId: asset._id,
    costOfGoodsSoldLedgerId: cogs._id,
    purchaseReceiptClearingLedgerId: clearing._id,
    stockAdjustmentGainLedgerId: returns._id,
    stockAdjustmentLossLedgerId: cogs._id,
    inventoryOpeningBalanceLedgerId: opening._id,
    updatedBy: user,
  });
  await PurchaseAccountingMapping.create({
    companyId: company._id,
    purchaseReturnsLedgerId: returns._id,
    supplierPayableLedgerId: payable._id,
    updatedBy: user,
  });
  const supplier: any = await Supplier.create({
    companyId: company._id,
    supplierCode: "6G-SUP",
    name: "6G Supplier",
    ledgerAccountId: payable._id,
    createdBy: user,
  });
  const product: any = await Product.create({
    companyId: company._id,
    ownershipStatus: "verified",
    brand: "6G",
    productName: "6G Product",
    category: "6G",
    mrp: 100,
    sellingPrice: 100,
    stockQty: 0,
    createdBy: user,
  });
  const warehouse: any = await Warehouse.create({
    companyId: company._id,
    warehouseName: "6G Warehouse",
    warehouseCode: "6G-W",
    ownershipStatus: "verified",
    createdBy: user,
  });
  const bill: any = await PurchaseBill.create({
    companyId: company._id,
    financialYearId: fy._id,
    supplierId: supplier._id,
    supplierInvoiceNumber: "6G-BILL",
    supplierInvoiceDate: new Date("2026-10-31"),
    internalBillNumber: "6G-PB-1",
    lines: [
      {
        productId: product._id,
        description: "6G Product",
        type: "product",
        quantity: 10,
        ratePaise: 100,
        taxablePaise: 1000,
        totalPaise: 1000,
      },
    ],
    subtotalPaise: 1000,
    grandTotalPaise: 1000,
    status: "posted",
    createdBy: user,
  });
  const receipt: any = await postInventoryMovement(
    {
      companyId: company._id,
      financialYearId: fy._id,
      accountingPeriodId: period._id,
      productId: product._id,
      warehouseId: warehouse._id,
      movementType: "purchase_receipt",
      quantity: 10,
      unitCostPaise: 100,
      sourceType: "inventory_operation:purchase_receipt",
      sourceId: id(),
      sourceReference: String(bill._id),
      movementDate: "2026-10-31",
      idempotencyKey: `6g-receipt-${Date.now()}`,
    },
    String(user),
  );
  await InventorySourceBalance.create({
    companyId: company._id,
    financialYearId: fy._id,
    sourceType: "purchase_bill",
    sourceId: bill._id,
    productId: product._id,
    limitQuantity: 10,
    receivedQuantity: 10,
    returnedQuantity: 0,
  });
  const makePurchaseReturn = (n: string, quantity: number) =>
    PurchaseReturn.create({
      companyId: company._id,
      financialYearId: fy._id,
      accountingPeriodId: period._id,
      supplierId: supplier._id,
      purchaseBillId: bill._id,
      returnNumber: n,
      amountPaise: quantity * 100,
      reason: "6G test",
      movementDate: new Date("2026-10-31"),
      idempotencyKey: `6g-${n}`,
      status: "approved",
      lines: [
        {
          productId: product._id,
          purchaseBillId: bill._id,
          purchaseBillLineReference: bill.lines[0]._id,
          originalReceiptMovementId: receipt._id,
          warehouseId: warehouse._id,
          returnQuantity: quantity,
          originalUnitCostPaise: 100,
          returnValuePaise: quantity * 100,
        },
      ],
      createdBy: user,
    });
  const firstPurchase: any = await makePurchaseReturn("6G-PR-1", 2);
  const postedPurchase: any = await postPurchaseReturnInventory(
    String(firstPurchase._id),
    String(user),
  );
  const purchaseRaces: any[] = await Promise.all(
    [1, 2].map(async (n) => {
      try {
        const item: any = await makePurchaseReturn(`6G-PR-RACE-${n}`, 5);
        await postPurchaseReturnInventory(String(item._id), String(user));
        return "ok";
      } catch {
        return "rejected";
      }
    }),
  );
  const invoice: any = await Invoice.create({
    companyId: company._id,
    ownershipStatus: "verified",
    invoiceNumber: "6G-INV-1",
    customerId: id(),
    customerDetails: { fullName: "6G Customer", mobileNumber: "9999999999" },
    items: [
      {
        type: "product",
        productId: String(product._id),
        name: "6G Product",
        quantity: 2,
        unitPrice: 100,
        total: 200,
        hasGst: false,
        gstAmount: 0,
      },
    ],
    subtotal: 200,
    taxAmount: 0,
    totalAmount: 200,
    dueAmount: 200,
    status: "approved",
    createdBy: user,
  });
  const issue: any = await postInventoryMovement(
    {
      companyId: company._id,
      financialYearId: fy._id,
      accountingPeriodId: period._id,
      productId: product._id,
      warehouseId: warehouse._id,
      movementType: "sales_issue",
      quantity: 2,
      unitCostPaise: 100,
      sourceType: "inventory_operation:sales_issue",
      sourceId: id(),
      sourceReference: String(invoice._id),
      movementDate: "2026-10-31",
      idempotencyKey: `6g-issue-${Date.now()}`,
    },
    String(user),
  );
  await InventorySourceBalance.create({
    companyId: company._id,
    financialYearId: fy._id,
    sourceType: "invoice",
    sourceId: invoice._id,
    productId: product._id,
    limitQuantity: 2,
    issuedQuantity: 2,
    returnedQuantity: 0,
  });
  const makeSalesReturn = (n: string) =>
    SalesReturn.create({
      companyId: company._id,
      financialYearId: fy._id,
      accountingPeriodId: period._id,
      invoiceId: invoice._id,
      returnNumber: n,
      reason: "6G test",
      movementDate: new Date("2026-10-31"),
      idempotencyKey: `6g-${n}`,
      status: "approved",
      physicalReceiptAuthorizedBy: user,
      lines: [
        {
          invoiceId: invoice._id,
          invoiceLineReference: "0",
          originalSalesIssueMovementId: issue._id,
          productId: product._id,
          warehouseId: warehouse._id,
          returnQuantity: 1,
          originalIssueUnitCostPaise: 100,
          returnValuePaise: 100,
        },
      ],
      createdBy: user,
    });
  const salesRaces: any[] = await Promise.all(
    [1, 2].map(async (n) => {
      try {
        const item: any = await makeSalesReturn(`6G-SR-${n}`);
        await postSalesReturnInventory(String(item._id), String(user));
        return "ok";
      } catch {
        return "rejected";
      }
    }),
  );
  const stock: any = await WarehouseStock.findOne({
    companyId: company._id,
  }).lean();
  const sourceBalances: any[] = await InventorySourceBalance.find({
    companyId: company._id,
  }).lean();
  const movements: any[] = await InventoryMovement.find({
    companyId: company._id,
  }).lean();
  const vouchers: any[] = await AccountingVoucher.find({
    companyId: company._id,
    status: "posted",
  }).lean();
  console.log(
    JSON.stringify({
      purchasePosted: Boolean(postedPurchase.voucher),
      purchaseRaces,
      salesRaces,
      stock,
      sourceBalances,
      movementCount: movements.length,
      voucherCount: vouchers.length,
      balanced: vouchers.every(
        (v: any) => Number(v.totalDebitPaise) === Number(v.totalCreditPaise),
      ),
    }),
  );
  await mongoose.disconnect();
};
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
