import mongoose from "mongoose";
import { User } from "../server/models/User";
import { Company } from "../server/models/Company";
import { FinancialYear } from "../server/models/FinancialYear";
import { AccountingPeriod } from "../server/models/AccountingPeriod";
import { AccountGroup } from "../server/models/AccountGroup";
import { LedgerAccount } from "../server/models/LedgerAccount";
import { Product } from "../server/models/Product";
import { Warehouse } from "../server/models/Warehouse";
import { WarehouseStock } from "../server/models/WarehouseStock";
import { InventoryMovement } from "../server/models/InventoryMovement";
import { InventoryOperation } from "../server/models/InventoryOperation";
import { InventoryAccountingMapping } from "../server/models/InventoryAccountingMapping";
import { AccountingVoucher } from "../server/models/AccountingVoucher";
import {
  postInventoryMovement,
  postInventoryOperation,
  postInventoryTransfer,
} from "../server/services/inventoryMovements";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const id = () => new mongoose.Types.ObjectId();
  const user = id();
  const company: any = await Company.create({
    name: "Phase 6C Test",
    legalName: "Phase 6C Test",
    authorizedUserIds: [user],
    createdBy: user,
  });
  await User.create({
    _id: user,
    name: "Phase 6C User",
    email: `phase6c-${Date.now()}@example.test`,
    mobileNumber: `9199${String(Date.now()).slice(-8)}`,
    passwordHash: "test",
    role: "Admin",
    isActive: true,
  });
  const fy: any = await FinancialYear.create({
    companyId: company._id,
    label: "2026-27-6C",
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
    label: "6C",
    startDate: fy.startDate,
    endDate: fy.endDate,
    status: "open",
  });
  const assetGroup: any = await AccountGroup.create({
    companyId: company._id,
    name: "6C Assets",
    code: "6C-A",
    rootCategory: "assets",
    normalBalance: "debit",
    createdBy: user,
  });
  const expenseGroup: any = await AccountGroup.create({
    companyId: company._id,
    name: "6C Expenses",
    code: "6C-E",
    rootCategory: "expenses",
    normalBalance: "debit",
    createdBy: user,
  });
  const liabilityGroup: any = await AccountGroup.create({
    companyId: company._id,
    name: "6C Liability",
    code: "6C-L",
    rootCategory: "liabilities",
    normalBalance: "credit",
    createdBy: user,
  });
  const equityGroup: any = await AccountGroup.create({
    companyId: company._id,
    name: "6C Equity",
    code: "6C-Q",
    rootCategory: "equity",
    normalBalance: "credit",
    createdBy: user,
  });
  const makeLedger = (code: string, name: string, groupId: any) =>
    LedgerAccount.create({
      companyId: company._id,
      groupId,
      code,
      name,
      createdBy: user,
    });
  const asset: any = await makeLedger(
    "6C-ASSET",
    "Inventory Asset",
    assetGroup,
  );
  const cogs: any = await makeLedger("6C-COGS", "COGS", expenseGroup);
  const clearing: any = await makeLedger(
    "6C-CLEAR",
    "Receipt Clearing",
    liabilityGroup,
  );
  const gain: any = await makeLedger("6C-GAIN", "Adjustment Gain", equityGroup);
  const loss: any = await makeLedger(
    "6C-LOSS",
    "Adjustment Loss",
    expenseGroup,
  );
  const opening: any = await makeLedger(
    "6C-OPEN",
    "Opening Balance",
    equityGroup,
  );
  await InventoryAccountingMapping.create({
    companyId: company._id,
    inventoryAssetLedgerId: asset._id,
    costOfGoodsSoldLedgerId: cogs._id,
    purchaseReceiptClearingLedgerId: clearing._id,
    stockAdjustmentGainLedgerId: gain._id,
    stockAdjustmentLossLedgerId: loss._id,
    inventoryOpeningBalanceLedgerId: opening._id,
    updatedBy: user,
  });
  const p: any = await Product.create({
    companyId: company._id,
    ownershipStatus: "verified",
    brand: "6C",
    productName: "6C Product",
    category: "6C",
    mrp: 100,
    sellingPrice: 100,
    stockQty: 0,
    createdBy: user,
  });
  const w1: any = await Warehouse.create({
    companyId: company._id,
    warehouseName: "6C Main",
    warehouseCode: "6C-MAIN",
    ownershipStatus: "verified",
    createdBy: user,
  });
  const w2: any = await Warehouse.create({
    companyId: company._id,
    warehouseName: "6C Second",
    warehouseCode: "6C-SECOND",
    ownershipStatus: "verified",
    createdBy: user,
  });
  const base = {
    companyId: company._id,
    financialYearId: fy._id,
    accountingPeriodId: period._id,
    productId: p._id,
    warehouseId: w1._id,
    quantity: 10,
    unitCostPaise: 1000,
    sourceType: "6c-test",
    sourceId: id(),
    sourceReference: "6C",
    movementDate: "2026-10-31",
    idempotencyKey: `6c-${Date.now()}`,
  };
  const openingMovement: any = await postInventoryMovement(
    { ...base, movementType: "opening_stock" },
    String(user),
  );
  const duplicate = await postInventoryMovement(
    { ...base, sourceId: base.sourceId },
    String(user),
  );
  const operation: any = await InventoryOperation.create({
    companyId: company._id,
    financialYearId: fy._id,
    accountingPeriodId: period._id,
    operationType: "opening_stock",
    sourceType: "6c-operation",
    sourceId: id(),
    warehouseId: w1._id,
    items: [{ productId: p._id, quantity: 1, unitCostPaise: 1000 }],
    status: "approved",
    idempotencyKey: `6c-op-${Date.now()}`,
    createdBy: user,
  });
  const posted = await postInventoryOperation(
    String(operation._id),
    String(user),
  );
  const race = await Promise.all(
    [1, 2].map((n) =>
      postInventoryMovement(
        {
          ...base,
          movementType: "sales_issue",
          quantity: 6,
          sourceId: id(),
          idempotencyKey: `6c-race-${Date.now()}-${n}`,
        },
        String(user),
      )
        .then(() => "ok")
        .catch(() => "rejected"),
    ),
  );
  const transfer = await postInventoryTransfer(
    {
      companyId: company._id,
      financialYearId: fy._id,
      accountingPeriodId: period._id,
      productId: p._id,
      sourceWarehouseId: w1._id,
      destinationWarehouseId: w2._id,
      quantity: 1,
      unitCostPaise: 1000,
      movementDate: "2026-10-31",
      idempotencyKey: `6c-transfer-${Date.now()}`,
    },
    String(user),
  );
  const stock: any = await WarehouseStock.find({
    companyId: company._id,
  }).lean();
  const movements = await InventoryMovement.countDocuments({
    companyId: company._id,
  });
  const vouchers = await AccountingVoucher.find({
    companyId: company._id,
    status: "posted",
  }).lean();
  console.log(
    JSON.stringify({
      openingPosted: !!openingMovement,
      duplicateIdempotent:
        String(duplicate._id) === String(openingMovement._id),
      operationVoucher: !!posted.voucher,
      race,
      transferMovements: !!transfer.out && !!transfer.incoming,
      movements,
      stock,
      balanced: vouchers.every(
        (v: any) => v.totalDebitPaise === v.totalCreditPaise,
      ),
    }),
  );
  await mongoose.disconnect();
};
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
