import { Invoice } from "./models/Invoice";
import { SalesAccountingSource } from "./models/SalesAccountingSource";
import { AdvanceAllocation } from "./models/AdvanceAllocation";
import { PurchaseBill } from "./models/PurchaseBill";
import { SupplierPayment } from "./models/SupplierPayment";
import { SupplierAdvanceAllocation } from "./models/SupplierAdvanceAllocation";
import { PurchaseReturn } from "./models/PurchaseReturn";
import { Supplier } from "./models/Supplier";
import { LedgerAccount } from "./models/LedgerAccount";
import { AccountingVoucher } from "./models/AccountingVoucher";
import { InventoryMovement } from "./models/InventoryMovement";
import { Product } from "./models/Product";
import { Warehouse } from "./models/Warehouse";
const registeredInventoryModels = [Product, Warehouse, Supplier];
void registeredInventoryModels;

const bucket = (due: Date, asOf: Date) => {
  const days = Math.max(
    0,
    Math.floor((asOf.getTime() - due.getTime()) / 86400000),
  );
  return asOf < due
    ? "notDue"
    : days <= 30
      ? "days0to30"
      : days <= 60
        ? "days31to60"
        : days <= 90
          ? "days61to90"
          : "above90";
};
const date = (value: any) => (value ? new Date(value) : new Date());
async function ledgerBalance(
  companyId: any,
  financialYearId: any,
  ledgerId: any,
  asOf: Date,
) {
  const vouchers: any[] = await AccountingVoucher.find({
    companyId,
    financialYearId,
    status: "posted",
    voucherDate: { $lte: asOf },
    "lines.ledgerAccountId": ledgerId,
  }).lean();
  return vouchers.reduce(
    (sum, voucher) =>
      sum +
      (voucher.lines || [])
        .filter(
          (line: any) => String(line.ledgerAccountId) === String(ledgerId),
        )
        .reduce(
          (inner: number, line: any) =>
            inner +
            Number(line.debitPaise || 0) -
            Number(line.creditPaise || 0),
          0,
        ),
    0,
  );
}
export async function receivablesReport(query: any) {
  const asOf = date(query.asOfDate || query.toDate);
  const invoices: any[] = await Invoice.find({
    companyId: query.companyId,
    ownershipStatus: "verified",
    status: { $in: ["approved", "cancelled"] },
  }).lean();
  const rows: any[] = [];
  for (const invoice of invoices) {
    const payments = await SalesAccountingSource.find({
      companyId: query.companyId,
      sourceType: "invoice_payment",
      sourceId: { $in: (invoice.payments || []).map((item: any) => item._id) },
      status: "posted",
    }).lean();
    const allocations = await AdvanceAllocation.find({
      companyId: query.companyId,
      invoiceId: invoice._id,
      status: "confirmed",
    }).lean();
    const original = Math.round(Number(invoice.totalAmount || 0) * 100);
    const received = payments.reduce(
      (sum, item: any) => sum + Number(item.amountPaise || 0),
      0,
    );
    const allocated = allocations.reduce(
      (sum, item: any) => sum + Number(item.amountPaise || 0),
      0,
    );
    const dueDate = date(invoice.dueDate || invoice.createdAt);
    const outstanding = Math.max(0, original - received - allocated);
    rows.push({
      customerId: invoice.customerId,
      customerName: invoice.customerDetails?.fullName,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.createdAt,
      dueDate,
      originalAmountPaise: original,
      receivedPaise: received,
      allocatedAdvancePaise: allocated,
      creditNotesPaise: 0,
      outstandingPaise: outstanding,
      ageingBucket: bucket(dueDate, asOf),
      sourceLimitation:
        "Credit notes are included only when a posted source record exists.",
    });
  }
  return {
    rows,
    totals: {
      originalPaise: rows.reduce((s, r) => s + r.originalAmountPaise, 0),
      receivedPaise: rows.reduce((s, r) => s + r.receivedPaise, 0),
      allocatedAdvancePaise: rows.reduce(
        (s, r) => s + r.allocatedAdvancePaise,
        0,
      ),
      outstandingPaise: rows.reduce((s, r) => s + r.outstandingPaise, 0),
    },
    asOfDate: asOf,
  };
}
export async function payablesReport(query: any) {
  const asOf = date(query.asOfDate || query.toDate);
  const bills: any[] = await PurchaseBill.find({
    companyId: query.companyId,
    financialYearId: query.financialYearId,
    status: { $in: ["posted", "reversed"] },
  })
    .populate("supplierId", "name supplierCode")
    .lean();
  const rows: any[] = [];
  for (const bill of bills) {
    const payments = await SupplierPayment.find({
      companyId: query.companyId,
      supplierId: bill.supplierId,
      status: "posted",
      "allocations.purchaseBillId": bill._id,
    }).lean();
    const allocations = await SupplierAdvanceAllocation.find({
      companyId: query.companyId,
      purchaseBillId: bill._id,
      status: "confirmed",
    }).lean();
    const returns = await PurchaseReturn.find({
      companyId: query.companyId,
      purchaseBillId: bill._id,
      status: "posted",
    }).lean();
    const paid = payments.reduce(
      (sum, payment: any) =>
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
    const advances = allocations.reduce(
      (sum, item: any) => sum + Number(item.amountPaise || 0),
      0,
    );
    const returned = returns.reduce(
      (sum, item: any) => sum + Number(item.amountPaise || 0),
      0,
    );
    const original = Number(bill.grandTotalPaise || 0);
    const dueDate = date(bill.dueDate || bill.supplierInvoiceDate);
    rows.push({
      supplierId: bill.supplierId?._id || bill.supplierId,
      supplierName: bill.supplierId?.name,
      purchaseBillId: bill._id,
      billNumber: bill.internalBillNumber,
      billDate: bill.supplierInvoiceDate,
      dueDate,
      originalAmountPaise: original,
      paidPaise: paid,
      allocatedAdvancePaise: advances,
      purchaseReturnsPaise: returned,
      outstandingPaise: Math.max(0, original - paid - advances - returned),
      ageingBucket: bucket(dueDate, asOf),
    });
  }
  return {
    rows,
    totals: {
      originalPaise: rows.reduce((s, r) => s + r.originalAmountPaise, 0),
      paidPaise: rows.reduce((s, r) => s + r.paidPaise, 0),
      allocatedAdvancePaise: rows.reduce(
        (s, r) => s + r.allocatedAdvancePaise,
        0,
      ),
      purchaseReturnsPaise: rows.reduce(
        (s, r) => s + r.purchaseReturnsPaise,
        0,
      ),
      outstandingPaise: rows.reduce((s, r) => s + r.outstandingPaise, 0),
    },
    asOfDate: asOf,
  };
}
export async function historicalInventoryValuation(query: any) {
  const asOf = date(query.asOfDate || query.toDate);
  const filter: any = {
    companyId: query.companyId,
    movementDate: { $lte: new Date(asOf.getTime() + 86400000) },
    status: "posted",
  };
  if (query.financialYearId) filter.financialYearId = query.financialYearId;
  if (query.warehouseId) filter.warehouseId = query.warehouseId;
  if (query.productId) filter.productId = query.productId;
  const movements: any[] = await InventoryMovement.find(filter)
    .sort({ movementDate: 1, createdAt: 1, _id: 1 })
    .populate("productId", "productName productId category")
    .populate("warehouseId", "warehouseName warehouseCode")
    .lean();
  const balances = new Map<string, any>();
  for (const movement of movements) {
    const key = `${movement.productId?._id || movement.productId}:${movement.warehouseId?._id || movement.warehouseId}`;
    const item = balances.get(key) || {
      productId: movement.productId,
      warehouseId: movement.warehouseId,
      quantity: 0,
      valuePaise: 0,
      averageCostPaise: 0,
      openingStock: 0,
      receipts: 0,
      issues: 0,
      purchaseReturns: 0,
      salesReturns: 0,
      adjustments: 0,
      transfers: 0,
    };
    const incoming = Number(movement.quantityIn || 0);
    const outgoing = Number(movement.quantityOut || 0);
    item.quantity += incoming - outgoing;
    item.valuePaise +=
      incoming * Number(movement.unitCostPaise || 0) -
      (outgoing * Number(movement.totalValuePaise || 0)) /
        Math.max(1, outgoing);
    item.averageCostPaise =
      item.quantity > 0 ? Math.round(item.valuePaise / item.quantity) : 0;
    if (movement.movementType === "opening_stock") {
      item.openingStock += incoming;
    } else if (movement.movementType === "purchase_receipt")
      item.receipts += incoming;
    else if (movement.movementType === "sales_issue") item.issues += outgoing;
    else if (movement.movementType === "purchase_return")
      item.purchaseReturns += outgoing;
    else if (movement.movementType === "sales_return")
      item.salesReturns += incoming;
    else if (
      movement.movementType === "transfer_in" ||
      movement.movementType === "transfer_out"
    )
      item.transfers += incoming + outgoing;
    else item.adjustments += incoming - outgoing;
    balances.set(key, item);
  }
  const rows = Array.from(balances.values()).map((item) => ({
    ...item,
    stockValuePaise: Math.max(0, Math.round(item.valuePaise)),
  }));
  return {
    asOfDate: asOf,
    rows,
    totalInventoryValuePaise: rows.reduce(
      (sum, row) => sum + row.stockValuePaise,
      0,
    ),
    methodology:
      "Replayed persisted InventoryMovement records in accounting-date order using stored movement values and costs.",
    historicalLimitations: movements.length
      ? []
      : ["No persisted inventory movements were found for the selected scope."],
  };
}
