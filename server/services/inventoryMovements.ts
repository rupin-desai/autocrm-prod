import mongoose from "mongoose";
import crypto from "crypto";
import { Product, getProductStockStatus } from "../models/Product";
import { Warehouse } from "../models/Warehouse";
import { WarehouseStock } from "../models/WarehouseStock";
import { InventoryMovement } from "../models/InventoryMovement";
import { InventoryOperation } from "../models/InventoryOperation";
import { InventorySourceBalance } from "../models/InventorySourceBalance";
import { PurchaseBill } from "../models/PurchaseBill";
import { Invoice } from "../models/Invoice";
import { AccountingPeriod } from "../models/AccountingPeriod";
import { FinancialYear } from "../models/FinancialYear";
import { calculateWeightedAverageCost, movementValue } from "../inventoryLogic";
import { InventoryAccountingMapping } from "../models/InventoryAccountingMapping";
import { AccountingVoucher } from "../models/AccountingVoucher";
import { postVoucherInSession } from "./accountingVouchers";

function fail(message: string): never {
  throw new Error(message);
}
const movementDirection = (type: string) =>
  [
    "opening_stock",
    "purchase_receipt",
    "sales_return",
    "adjustment_in",
    "transfer_in",
  ].includes(type)
    ? "in"
    : "out";

async function reserveSourceQuantity(
  session: mongoose.ClientSession,
  data: {
    companyId: any;
    financialYearId: any;
    sourceType: "purchase_bill" | "invoice";
    sourceId: any;
    productId: any;
    sourceLineId?: any;
    quantity: number;
    limitQuantity: number;
    field: "receivedQuantity" | "issuedQuantity" | "returnedQuantity";
  },
) {
  const field = data.field;
  const updated: any = await InventorySourceBalance.findOneAndUpdate(
    {
      companyId: data.companyId,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      productId: data.productId,
      $expr: {
        $lte: [
          { $add: [{ $ifNull: [`$${field}`, 0] }, data.quantity] },
          "$limitQuantity",
        ],
      },
    },
    {
      $setOnInsert: {
        companyId: data.companyId,
        financialYearId: data.financialYearId,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        productId: data.productId,
        sourceLineId: data.sourceLineId,
        limitQuantity: data.limitQuantity,
      },
      $inc: { [field]: data.quantity },
    },
    { upsert: true, new: true, session },
  );
  if (!updated)
    fail(`Inventory quantity exceeds the eligible ${data.sourceType} quantity`);
  return updated;
}

export async function postInventoryMovement(
  data: any,
  userId: string,
  session?: mongoose.ClientSession,
) {
  const run = async (s: mongoose.ClientSession) => {
    const existing: any = await InventoryMovement.findOne({
      companyId: data.companyId,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      productId: data.productId,
      warehouseId: data.warehouseId,
    })
      .session(s)
      .lean();
    if (existing) return existing;
    const [fy, period, warehouse, product]: any[] = await Promise.all([
      FinancialYear.findOne({
        _id: data.financialYearId,
        companyId: data.companyId,
      })
        .session(s)
        .lean(),
      AccountingPeriod.findOne({
        _id: data.accountingPeriodId,
        companyId: data.companyId,
        financialYearId: data.financialYearId,
      })
        .session(s)
        .lean(),
      Warehouse.findOne({
        _id: data.warehouseId,
        companyId: data.companyId,
        isActive: true,
        ownershipStatus: "verified",
      })
        .session(s)
        .lean(),
      Product.findOne({
        _id: data.productId,
        companyId: data.companyId,
        ownershipStatus: "verified",
      })
        .session(s)
        .lean(),
    ]);
    if (!fy) fail("Financial year does not belong to the company");
    if (!period || period.status !== "open")
      fail("Accounting period is locked or closed");
    const movementDate = new Date(`${data.movementDate}T00:00:00.000Z`);
    if (
      movementDate < new Date(fy.startDate) ||
      movementDate > new Date(fy.endDate) ||
      movementDate < new Date(period.startDate) ||
      movementDate > new Date(period.endDate)
    )
      fail("Movement date is outside the open accounting period");
    if (!warehouse) fail("Verified active warehouse not found");
    if (!product) fail("Verified company-owned product not found");
    const direction = movementDirection(data.movementType);
    const stock: any = await WarehouseStock.findOne({
      companyId: data.companyId,
      productId: data.productId,
      warehouseId: data.warehouseId,
    }).session(s);
    const oldQuantity = Number(stock?.quantityOnHand || 0);
    const oldValue = Number(stock?.inventoryValuePaise || 0);
    const oldAverage = Number(stock?.averageCostPaise || 0);
    const unitCostPaise =
      direction === "out" && !data.unitCostPaise
        ? oldAverage
        : Number(data.unitCostPaise);
    const totalValuePaise = movementValue(data.quantity, unitCostPaise);
    if (direction === "out" && oldQuantity < data.quantity)
      fail("Insufficient warehouse stock");
    const newQuantity =
      direction === "in"
        ? oldQuantity + data.quantity
        : oldQuantity - data.quantity;
    const newValue =
      direction === "in"
        ? oldValue + totalValuePaise
        : Math.max(0, oldValue - totalValuePaise);
    const averageCostPaise =
      newQuantity > 0
        ? direction === "in"
          ? calculateWeightedAverageCost(
              oldQuantity,
              oldValue,
              data.quantity,
              totalValuePaise,
            )
          : oldAverage
        : 0;
    await WarehouseStock.findOneAndUpdate(
      {
        companyId: data.companyId,
        productId: data.productId,
        warehouseId: data.warehouseId,
      },
      {
        $set: {
          quantityOnHand: newQuantity,
          inventoryValuePaise: newValue,
          averageCostPaise,
          reservedQuantity: Number(stock?.reservedQuantity || 0),
        },
      },
      { upsert: true, new: true, session: s },
    );
    const productFilter: any = {
      _id: product._id,
      companyId: data.companyId,
      ownershipStatus: "verified",
    };
    if (direction === "out") productFilter.stockQty = { $gte: data.quantity };
    const updatedProduct: any = await Product.findOneAndUpdate(
      productFilter,
      {
        $inc: { stockQty: direction === "in" ? data.quantity : -data.quantity },
      },
      { new: true, session: s },
    );
    if (!updatedProduct)
      fail("Legacy product stock compatibility update failed");
    updatedProduct.status = getProductStockStatus(
      updatedProduct.stockQty,
      updatedProduct.minStockLevel,
    );
    await updatedProduct.save({ session: s });
    const created: any[] = await InventoryMovement.create(
      [
        {
          ...data,
          quantityIn: direction === "in" ? data.quantity : 0,
          quantityOut: direction === "out" ? data.quantity : 0,
          unitCostPaise,
          totalValuePaise,
          movementDate,
          createdBy: userId,
          status: "posted",
        },
      ],
      { session: s },
    );
    return created[0].toObject();
  };
  if (session) return run(session);
  const s = await mongoose.startSession();
  try {
    let result: any;
    await s.withTransaction(async () => {
      result = await run(s);
    });
    return result;
  } finally {
    await s.endSession();
  }
}

export async function postInventoryTransfer(data: any, userId: string) {
  const s = await mongoose.startSession();
  try {
    let result: any;
    await s.withTransaction(async () => {
      const sourceId = new mongoose.Types.ObjectId(
        crypto
          .createHash("md5")
          .update(`${data.companyId}:${data.idempotencyKey}`)
          .digest("hex")
          .slice(0, 24),
      );
      const out = await postInventoryMovement(
        {
          ...data,
          warehouseId: data.sourceWarehouseId,
          movementType: "transfer_out",
          sourceId,
          sourceType: "stock_transfer",
          idempotencyKey: `${data.idempotencyKey}:out`,
        },
        userId,
        s,
      );
      const incoming = await postInventoryMovement(
        {
          ...data,
          warehouseId: data.destinationWarehouseId,
          movementType: "transfer_in",
          sourceId,
          sourceType: "stock_transfer",
          idempotencyKey: `${data.idempotencyKey}:in`,
          unitCostPaise: out.unitCostPaise,
        },
        userId,
        s,
      );
      result = { out, incoming };
    });
    return result;
  } finally {
    await s.endSession();
  }
}

export async function postInventoryOperation(
  operationId: string,
  userId: string,
) {
  const s = await mongoose.startSession();
  try {
    let result: any;
    await s.withTransaction(async () => {
      const operation: any =
        await InventoryOperation.findById(operationId).session(s);
      if (!operation) fail("Inventory operation not found");
      if (operation.status === "posted") {
        result = operation.toObject();
        return;
      }
      if (operation.status !== "approved")
        fail("Only approved inventory operations can be posted");
      if (["purchase_return", "sales_return"].includes(operation.operationType))
        fail(
          "Return inventory operations require verified source-specific return workflow",
        );
      let sourceDocument: any = null;
      if (operation.operationType === "purchase_receipt") {
        sourceDocument = await PurchaseBill.findOne({
          _id: operation.sourceId,
          companyId: operation.companyId,
          status: { $in: ["approved", "posted"] },
        })
          .session(s)
          .lean();
        if (!sourceDocument)
          fail("Approved or posted purchase bill is required");
      }
      if (operation.operationType === "sales_issue") {
        sourceDocument = await Invoice.findOne({
          _id: operation.sourceId,
          companyId: operation.companyId,
          ownershipStatus: "verified",
          status: "approved",
        })
          .session(s)
          .lean();
        if (!sourceDocument) fail("Verified approved invoice is required");
      }
      const movementType =
        operation.operationType === "purchase_receipt" ||
        operation.operationType === "opening_stock"
          ? operation.operationType
          : operation.operationType === "sales_issue"
            ? "sales_issue"
            : operation.operationType === "stock_adjustment"
              ? operation.reason.toLowerCase().includes("increase")
                ? "adjustment_in"
                : "adjustment_out"
              : "adjustment_in";
      const movements: any[] = [];
      for (const item of operation.items) {
        if (operation.operationType === "purchase_receipt") {
          const lines = (sourceDocument.lines || []).filter(
            (line: any) =>
              line.type === "product" &&
              String(line.productId) === String(item.productId) &&
              (!item.sourceLineId ||
                String(line._id) === String(item.sourceLineId)),
          );
          if (!lines.length)
            fail("Receipt item is not present on the purchase bill");
          await reserveSourceQuantity(s, {
            companyId: operation.companyId,
            financialYearId: operation.financialYearId,
            sourceType: "purchase_bill",
            sourceId: operation.sourceId,
            productId: item.productId,
            sourceLineId: lines.length === 1 ? lines[0]._id : undefined,
            quantity: item.quantity,
            limitQuantity: lines.reduce(
              (sum: number, line: any) => sum + Number(line.quantity || 0),
              0,
            ),
            field: "receivedQuantity",
          });
        }
        if (operation.operationType === "sales_issue") {
          const lines = (sourceDocument.items || []).filter(
            (line: any) =>
              line.type === "product" &&
              String(line.productId) === String(item.productId),
          );
          if (!lines.length)
            fail("Issue item is not present on the sales invoice");
          await reserveSourceQuantity(s, {
            companyId: operation.companyId,
            financialYearId: operation.financialYearId,
            sourceType: "invoice",
            sourceId: operation.sourceId,
            productId: item.productId,
            quantity: item.quantity,
            limitQuantity: lines.reduce(
              (sum: number, line: any) => sum + Number(line.quantity || 0),
              0,
            ),
            field: "issuedQuantity",
          });
        }
        movements.push(
          await postInventoryMovement(
            {
              companyId: operation.companyId,
              financialYearId: operation.financialYearId,
              accountingPeriodId: operation.accountingPeriodId,
              productId: item.productId,
              warehouseId: operation.warehouseId,
              movementType,
              quantity: item.quantity,
              unitCostPaise: item.unitCostPaise,
              sourceType: `inventory_operation:${operation.operationType}`,
              sourceId: operation._id,
              sourceReference: operation.sourceId.toString(),
              movementDate: operation.movementDate.toISOString().slice(0, 10),
              idempotencyKey: `${operation.idempotencyKey}:${item.productId}`,
            },
            userId,
            s,
          ),
        );
      }
      const totalValuePaise = movements.reduce(
        (sum, item) => sum + Number(item.totalValuePaise || 0),
        0,
      );
      const mapping: any = await InventoryAccountingMapping.findOne({
        companyId: operation.companyId,
      })
        .session(s)
        .lean();
      if (!mapping) fail("Inventory accounting mappings are not configured");
      const accounts: Record<string, [any, any]> = {
        purchase_receipt: [
          mapping.inventoryAssetLedgerId,
          mapping.purchaseReceiptClearingLedgerId,
        ],
        sales_issue: [
          mapping.costOfGoodsSoldLedgerId,
          mapping.inventoryAssetLedgerId,
        ],
        opening_stock: [
          mapping.inventoryAssetLedgerId,
          mapping.inventoryOpeningBalanceLedgerId,
        ],
        adjustment_in: [
          mapping.inventoryAssetLedgerId,
          mapping.stockAdjustmentGainLedgerId,
        ],
        adjustment_out: [
          mapping.stockAdjustmentLossLedgerId,
          mapping.inventoryAssetLedgerId,
        ],
      };
      const [debitLedgerId, creditLedgerId] = accounts[movementType];
      if (!debitLedgerId || !creditLedgerId)
        fail(`Inventory accounting mapping is missing for ${movementType}`);
      const voucherDocs: any[] = await AccountingVoucher.create(
        [
          {
            companyId: operation.companyId,
            financialYearId: operation.financialYearId,
            accountingPeriodId: operation.accountingPeriodId,
            voucherType: "journal",
            voucherDate: operation.movementDate,
            narration: `Inventory ${operation.operationType}`,
            sourceType: "inventory_operation",
            sourceId: operation._id,
            sourceFingerprint: `inventory:operation:${operation._id}`,
            status: "approved",
            lines: [
              {
                ledgerAccountId: debitLedgerId,
                debitPaise: totalValuePaise,
                creditPaise: 0,
                description: `Inventory ${operation.operationType}`,
              },
              {
                ledgerAccountId: creditLedgerId,
                debitPaise: 0,
                creditPaise: totalValuePaise,
                description: `Inventory ${operation.operationType}`,
              },
            ],
            totalDebitPaise: totalValuePaise,
            totalCreditPaise: totalValuePaise,
            createdBy: userId,
            updatedBy: userId,
            approvedBy: userId,
            approvedAt: new Date(),
          },
        ],
        { session: s },
      );
      const voucher = await postVoucherInSession(
        String(voucherDocs[0]._id),
        userId,
        s,
      );
      operation.status = "posted";
      operation.postedBy = userId;
      operation.postedAt = new Date();
      operation.voucherId = voucher._id;
      await operation.save({ session: s });
      result = { operation: operation.toObject(), movements, voucher };
    });
    return result;
  } finally {
    await s.endSession();
  }
}
