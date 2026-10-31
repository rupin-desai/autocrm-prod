import mongoose from "mongoose";
import { InventoryMovement } from "../models/InventoryMovement";
import { InventorySourceBalance } from "../models/InventorySourceBalance";
import { InventoryAccountingMapping } from "../models/InventoryAccountingMapping";
import { AccountingVoucher } from "../models/AccountingVoucher";
import { PurchaseReturn } from "../models/PurchaseReturn";
import { SalesReturn } from "../models/SalesReturn";
import { PurchaseAccountingMapping } from "../models/PurchaseAccountingMapping";
import { Supplier } from "../models/Supplier";
import { LedgerAccount } from "../models/LedgerAccount";
import { AccountGroup } from "../models/AccountGroup";
import { postInventoryMovement } from "./inventoryMovements";
import { postVoucherInSession } from "./accountingVouchers";

function fail(message: string): never {
  throw new Error(message);
}
async function reserve(
  session: mongoose.ClientSession,
  companyId: any,
  sourceType: "purchase_bill" | "invoice",
  sourceId: any,
  productId: any,
  quantity: number,
  field: "receivedQuantity" | "issuedQuantity",
) {
  const base: any = { companyId, sourceType, sourceId, productId };
  const limitField =
    field === "receivedQuantity" ? "$receivedQuantity" : "$issuedQuantity";
  const item: any = await InventorySourceBalance.findOneAndUpdate(
    {
      ...base,
      $expr: {
        $lte: [
          { $add: [{ $ifNull: ["$returnedQuantity", 0] }, quantity] },
          limitField,
        ],
      },
    },
    { $inc: { returnedQuantity: quantity } },
    { new: true, session },
  );
  if (!item)
    fail(`Return quantity exceeds the available ${sourceType} quantity`);
  return item;
}
async function activeLedger(
  companyId: any,
  id: any,
  session: mongoose.ClientSession,
) {
  const ledger: any = await LedgerAccount.findOne({
    _id: id,
    companyId,
    status: "active",
  })
    .session(session)
    .lean();
  if (!ledger) fail("Return voucher ledger is invalid");
  const group: any = await AccountGroup.findOne({
    _id: ledger.groupId,
    companyId,
    status: "active",
  })
    .session(session)
    .lean();
  if (!group) fail("Return voucher ledger group is invalid");
  return ledger;
}
function total(lines: any[]) {
  return lines.reduce(
    (sum, line) => sum + Number(line.returnValuePaise || 0),
    0,
  );
}

export async function postPurchaseReturnInventory(
  returnId: string,
  userId: string,
) {
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const ret: any = await PurchaseReturn.findById(returnId).session(session);
      if (!ret) fail("Purchase return not found");
      if (ret.status === "posted") {
        result = ret.toObject();
        return;
      }
      if (ret.status !== "approved")
        fail("Only approved purchase returns can be posted");
      if (!ret.lines?.length)
        fail(
          "Product-level receipt linkage is required for inventory return posting",
        );
      const movements: any[] = [];
      for (const line of ret.lines) {
        const original: any = await InventoryMovement.findOne({
          _id: line.originalReceiptMovementId,
          companyId: ret.companyId,
          financialYearId: ret.financialYearId,
          movementType: "purchase_receipt",
          sourceType: "inventory_operation:purchase_receipt",
          sourceReference: String(ret.purchaseBillId),
          status: "posted",
        })
          .session(session)
          .lean();
        if (
          !original ||
          String(original.productId) !== String(line.productId) ||
          String(original.warehouseId) !== String(line.warehouseId)
        )
          fail("Purchase return source receipt linkage is invalid");
        if (
          Number(original.unitCostPaise) !== Number(line.originalUnitCostPaise)
        )
          fail("Original receipt cost does not match stored return cost");
        await reserve(
          session,
          ret.companyId,
          "purchase_bill",
          ret.purchaseBillId,
          line.productId,
          line.returnQuantity,
          "receivedQuantity",
        );
        movements.push(
          await postInventoryMovement(
            {
              companyId: ret.companyId,
              financialYearId: ret.financialYearId,
              accountingPeriodId: ret.accountingPeriodId,
              productId: line.productId,
              warehouseId: line.warehouseId,
              movementType: "purchase_return",
              quantity: line.returnQuantity,
              unitCostPaise: line.originalUnitCostPaise,
              sourceType: "inventory_return:purchase",
              sourceId: ret._id,
              sourceReference: original._id.toString(),
              movementDate: (ret.movementDate || ret.createdAt)
                .toISOString()
                .slice(0, 10),
              idempotencyKey: `${ret.idempotencyKey}:${line._id}`,
            },
            userId,
            session,
          ),
        );
      }
      const inventoryMap: any = await InventoryAccountingMapping.findOne({
        companyId: ret.companyId,
      })
        .session(session)
        .lean();
      if (
        !inventoryMap?.inventoryAssetLedgerId ||
        !inventoryMap.purchaseReceiptClearingLedgerId
      )
        fail("Inventory return mappings are incomplete");
      const purchaseMap: any = await PurchaseAccountingMapping.findOne({
        companyId: ret.companyId,
      })
        .session(session)
        .lean();
      if (!purchaseMap?.purchaseReturnsLedgerId)
        fail("Purchase return accounting mapping is missing");
      const supplier: any = await Supplier.findOne({
        _id: ret.supplierId,
        companyId: ret.companyId,
        status: "active",
      })
        .session(session)
        .lean();
      if (!supplier?.ledgerAccountId)
        fail("Supplier payable ledger is missing");
      const payable = await activeLedger(
        ret.companyId,
        supplier.ledgerAccountId,
        session,
      );
      const purchaseReturns = await activeLedger(
        ret.companyId,
        purchaseMap.purchaseReturnsLedgerId,
        session,
      );
      const clearing = await activeLedger(
        ret.companyId,
        inventoryMap.purchaseReceiptClearingLedgerId,
        session,
      );
      const asset = await activeLedger(
        ret.companyId,
        inventoryMap.inventoryAssetLedgerId,
        session,
      );
      const amount = total(ret.lines);
      if (amount !== Number(ret.amountPaise))
        fail("Return amount does not equal linked receipt value");
      const lines = [
        {
          ledgerAccountId: payable._id,
          debitPaise: amount,
          creditPaise: 0,
          description: "Supplier payable reduced",
        },
        {
          ledgerAccountId: purchaseReturns._id,
          debitPaise: 0,
          creditPaise: amount,
          description: "Purchase return",
        },
        {
          ledgerAccountId: clearing._id,
          debitPaise: amount,
          creditPaise: 0,
          description: "Inventory receipt clearing reversed",
        },
        {
          ledgerAccountId: asset._id,
          debitPaise: 0,
          creditPaise: amount,
          description: "Inventory asset returned",
        },
      ];
      const docs: any[] = await AccountingVoucher.create(
        [
          {
            companyId: ret.companyId,
            financialYearId: ret.financialYearId,
            accountingPeriodId: ret.accountingPeriodId,
            voucherType: "journal",
            voucherDate: ret.movementDate || ret.createdAt,
            narration: `Purchase return ${ret.returnNumber}`,
            referenceNumber: ret.returnNumber,
            sourceType: "purchase_return",
            sourceId: ret._id,
            sourceFingerprint: `purchase_return:${ret.companyId}:${ret._id}`,
            status: "approved",
            lines,
            totalDebitPaise: amount * 2,
            totalCreditPaise: amount * 2,
            createdBy: userId,
            updatedBy: userId,
            approvedBy: userId,
            approvedAt: new Date(),
          },
        ],
        { session },
      );
      const voucher = await postVoucherInSession(
        String(docs[0]._id),
        userId,
        session,
      );
      ret.status = "posted";
      ret.inventoryLinkStatus = "posted";
      ret.inventoryVoucherId = voucher._id;
      ret.inventoryMovementIds = movements.map((item) => item._id);
      await ret.save({ session });
      result = { return: ret.toObject(), movements, voucher };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function postSalesReturnInventory(
  returnId: string,
  userId: string,
) {
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const ret: any = await SalesReturn.findById(returnId).session(session);
      if (!ret) fail("Sales return not found");
      if (ret.status === "posted") {
        result = ret.toObject();
        return;
      }
      if (ret.status !== "approved")
        fail("Only approved sales returns can be posted");
      if (!ret.physicalReceiptAuthorizedBy)
        fail("Authorized physical receipt confirmation is required");
      const movements: any[] = [];
      for (const line of ret.lines) {
        const original: any = await InventoryMovement.findOne({
          _id: line.originalSalesIssueMovementId,
          companyId: ret.companyId,
          financialYearId: ret.financialYearId,
          movementType: "sales_issue",
          sourceType: "inventory_operation:sales_issue",
          sourceReference: String(ret.invoiceId),
          status: "posted",
        })
          .session(session)
          .lean();
        if (
          !original ||
          String(original.productId) !== String(line.productId) ||
          String(original.warehouseId) !== String(line.warehouseId)
        )
          fail("Sales return source issue linkage is invalid");
        if (
          Number(original.unitCostPaise) !==
          Number(line.originalIssueUnitCostPaise)
        )
          fail("Original issue cost does not match stored return cost");
        await reserve(
          session,
          ret.companyId,
          "invoice",
          ret.invoiceId,
          line.productId,
          line.returnQuantity,
          "issuedQuantity",
        );
        movements.push(
          await postInventoryMovement(
            {
              companyId: ret.companyId,
              financialYearId: ret.financialYearId,
              accountingPeriodId: ret.accountingPeriodId,
              productId: line.productId,
              warehouseId: line.warehouseId,
              movementType: "sales_return",
              quantity: line.returnQuantity,
              unitCostPaise: line.originalIssueUnitCostPaise,
              sourceType: "inventory_return:sales",
              sourceId: ret._id,
              sourceReference: original._id.toString(),
              movementDate: (ret.movementDate || ret.createdAt)
                .toISOString()
                .slice(0, 10),
              idempotencyKey: `${ret.idempotencyKey}:${line._id}`,
            },
            userId,
            session,
          ),
        );
      }
      const map: any = await InventoryAccountingMapping.findOne({
        companyId: ret.companyId,
      })
        .session(session)
        .lean();
      if (!map?.inventoryAssetLedgerId || !map.costOfGoodsSoldLedgerId)
        fail("Sales return inventory mappings are incomplete");
      const asset = await activeLedger(
        ret.companyId,
        map.inventoryAssetLedgerId,
        session,
      );
      const cogs = await activeLedger(
        ret.companyId,
        map.costOfGoodsSoldLedgerId,
        session,
      );
      const amount = total(ret.lines);
      const lines = [
        {
          ledgerAccountId: asset._id,
          debitPaise: amount,
          creditPaise: 0,
          description: "Returned inventory restored",
        },
        {
          ledgerAccountId: cogs._id,
          debitPaise: 0,
          creditPaise: amount,
          description: "COGS reversed on sales return",
        },
      ];
      const docs: any[] = await AccountingVoucher.create(
        [
          {
            companyId: ret.companyId,
            financialYearId: ret.financialYearId,
            accountingPeriodId: ret.accountingPeriodId,
            voucherType: "journal",
            voucherDate: ret.movementDate || ret.createdAt,
            narration: `Sales return ${ret.returnNumber}`,
            referenceNumber: ret.returnNumber,
            sourceType: "sales_return",
            sourceId: ret._id,
            sourceFingerprint: `sales_return:${ret.companyId}:${ret._id}`,
            status: "approved",
            lines,
            totalDebitPaise: amount,
            totalCreditPaise: amount,
            createdBy: userId,
            updatedBy: userId,
            approvedBy: userId,
            approvedAt: new Date(),
          },
        ],
        { session },
      );
      const voucher = await postVoucherInSession(
        String(docs[0]._id),
        userId,
        session,
      );
      ret.status = "posted";
      ret.inventoryLinkStatus = "posted";
      ret.inventoryVoucherId = voucher._id;
      ret.inventoryMovementIds = movements.map((item) => item._id);
      await ret.save({ session });
      result = { return: ret.toObject(), movements, voucher };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
