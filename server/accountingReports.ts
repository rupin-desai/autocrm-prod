import mongoose from "mongoose";
import { z } from "zod";
import { AccountingVoucher } from "./models/AccountingVoucher";
import { LedgerAccount } from "./models/LedgerAccount";
import { AccountGroup } from "./models/AccountGroup";
import { FinancialYear } from "./models/FinancialYear";
import { OpeningBalance } from "./models/OpeningBalance";
import { WarehouseStock } from "./models/WarehouseStock";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
export const reportQuerySchema = z
  .object({
    companyId: objectId.optional(),
    financialYearId: objectId,
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    asOfDate: z.string().optional(),
    ledgerAccountId: objectId.optional(),
    groupId: objectId.optional(),
    ledgerType: z
      .enum(["general", "cash", "bank", "customer", "supplier"])
      .optional(),
    warehouseId: objectId.optional(),
    productId: objectId.optional(),
    voucherType: z.string().optional(),
    search: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    includeZero: z.coerce.boolean().default(false),
    format: z.enum(["json", "csv"]).default("json"),
  })
  .passthrough();
const day = (value?: string, fallback?: Date) => {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid report date");
  return date;
};
const id = (value: any) => String(value);
async function context(query: any) {
  void AccountGroup;
  const filter: any = { companyId: query.companyId, status: "active" };
  if (query.groupId) filter.groupId = query.groupId;
  if (query.ledgerAccountId) filter._id = query.ledgerAccountId;
  if (query.ledgerType) filter.ledgerType = query.ledgerType;
  const ledgers: any[] = await LedgerAccount.find(filter)
    .populate("groupId", "name code rootCategory normalBalance")
    .lean();
  const fy: any = await FinancialYear.findOne({
    _id: query.financialYearId,
    companyId: query.companyId,
  }).lean();
  if (!fy) throw new Error("Financial year does not belong to this company");
  return { ledgers, fy };
}
async function openingMap(companyId: any, financialYearId: any) {
  const balances: any[] = await OpeningBalance.find({
    companyId,
    financialYearId,
  }).lean();
  const map = new Map<string, { debit: number; credit: number }>();
  for (const item of balances)
    map.set(id(item.ledgerAccountId), {
      debit: Number(item.debitPaise || 0),
      credit: Number(item.creditPaise || 0),
    });
  return map;
}
async function postedVouchers(query: any, from: Date, to: Date) {
  const filter: any = {
    companyId: query.companyId,
    financialYearId: query.financialYearId,
    status: "posted",
    voucherDate: { $gte: from, $lt: new Date(to.getTime() + 86400000) },
  };
  if (query.voucherType) filter.voucherType = query.voucherType;
  if (query.ledgerAccountId)
    filter["lines.ledgerAccountId"] = query.ledgerAccountId;
  if (query.search)
    filter.$or = [
      { narration: { $regex: query.search, $options: "i" } },
      { referenceNumber: { $regex: query.search, $options: "i" } },
      { voucherNumber: { $regex: query.search, $options: "i" } },
    ];
  return AccountingVoucher.find(filter)
    .sort({ voucherDate: 1, voucherNumber: 1, _id: 1 })
    .lean();
}

export async function trialBalance(query: any) {
  const { ledgers, fy } = await context(query);
  const from = day(query.fromDate, fy.startDate)!;
  const to = day(query.toDate, new Date())!;
  const [opening, vouchers] = await Promise.all([
    openingMap(query.companyId, query.financialYearId),
    postedVouchers(query, from, to),
  ]);
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const voucher of vouchers as any[])
    for (const line of voucher.lines || []) {
      const item = totals.get(id(line.ledgerAccountId)) || {
        debit: 0,
        credit: 0,
      };
      item.debit += Number(line.debitPaise || 0);
      item.credit += Number(line.creditPaise || 0);
      totals.set(id(line.ledgerAccountId), item);
    }
  const rows = ledgers
    .map((ledger: any) => {
      const open = opening.get(id(ledger._id)) || {
        debit:
          ledger.openingBalanceType === "debit"
            ? Number(ledger.openingBalancePaise || 0)
            : 0,
        credit:
          ledger.openingBalanceType === "credit"
            ? Number(ledger.openingBalancePaise || 0)
            : 0,
      };
      const period = totals.get(id(ledger._id)) || { debit: 0, credit: 0 };
      const debit = open.debit + period.debit;
      const credit = open.credit + period.credit;
      return {
        ledgerAccountId: ledger._id,
        code: ledger.code,
        name: ledger.name,
        group: ledger.groupId,
        openingDebitPaise: open.debit,
        openingCreditPaise: open.credit,
        periodDebitPaise: period.debit,
        periodCreditPaise: period.credit,
        closingDebitPaise: Math.max(0, debit - credit),
        closingCreditPaise: Math.max(0, credit - debit),
      };
    })
    .filter(
      (row) =>
        query.includeZero ||
        row.openingDebitPaise ||
        row.openingCreditPaise ||
        row.periodDebitPaise ||
        row.periodCreditPaise,
    );
  const totalDebitPaise = rows.reduce(
    (sum, row) => sum + row.closingDebitPaise,
    0,
  );
  const totalCreditPaise = rows.reduce(
    (sum, row) => sum + row.closingCreditPaise,
    0,
  );
  return {
    rows,
    totalDebitPaise,
    totalCreditPaise,
    differencePaise: totalDebitPaise - totalCreditPaise,
    balanced: totalDebitPaise === totalCreditPaise,
    fromDate: from,
    toDate: to,
  };
}
export async function generalLedger(query: any) {
  const { ledgers, fy } = await context(query);
  const from = day(query.fromDate, fy.startDate)!;
  const to = day(query.toDate, new Date())!;
  const opening = await openingMap(query.companyId, query.financialYearId);
  const vouchers: any[] = await postedVouchers(query, from, to);
  const rows: any[] = [];
  for (const ledger of ledgers) {
    let running =
      (opening.get(id(ledger._id))?.debit || 0) -
      (opening.get(id(ledger._id))?.credit || 0);
    for (const voucher of vouchers)
      for (const line of voucher.lines || [])
        if (id(line.ledgerAccountId) === id(ledger._id)) {
          const debit = Number(line.debitPaise || 0);
          const credit = Number(line.creditPaise || 0);
          running += debit - credit;
          rows.push({
            ledgerAccountId: ledger._id,
            ledgerCode: ledger.code,
            ledgerName: ledger.name,
            date: voucher.voucherDate,
            voucherId: voucher._id,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            narration: voucher.narration,
            referenceNumber: voucher.referenceNumber,
            debitPaise: debit,
            creditPaise: credit,
            runningBalancePaise: running,
          });
        }
  }
  return {
    rows: rows.slice((query.page - 1) * query.limit, query.page * query.limit),
    total: rows.length,
  };
}
export async function dayBook(query: any) {
  const { fy } = await context(query);
  const from = day(query.fromDate, fy.startDate)!;
  const to = day(query.toDate, new Date())!;
  const vouchers: any[] = await postedVouchers(query, from, to);
  const rows = vouchers.map((voucher) => ({
    voucherId: voucher._id,
    date: voucher.voucherDate,
    voucherNumber: voucher.voucherNumber,
    voucherType: voucher.voucherType,
    narration: voucher.narration,
    referenceNumber: voucher.referenceNumber,
    totalDebitPaise: voucher.totalDebitPaise,
    totalCreditPaise: voucher.totalCreditPaise,
    status: voucher.status,
    sourceType: voucher.sourceType,
    sourceId: voucher.sourceId,
  }));
  return {
    rows: rows.slice((query.page - 1) * query.limit, query.page * query.limit),
    total: rows.length,
  };
}
export async function profitLoss(query: any) {
  const tb: any = await trialBalance(query);
  const rows = tb.rows.filter((row: any) =>
    ["income", "expenses"].includes(row.group?.rootCategory),
  );
  let revenue = 0;
  let expenses = 0;
  for (const row of rows) {
    if (row.group.rootCategory === "income")
      revenue += row.periodCreditPaise - row.periodDebitPaise;
    else expenses += row.periodDebitPaise - row.periodCreditPaise;
  }
  return {
    revenuePaise: revenue,
    expensesPaise: expenses,
    grossProfitPaise: revenue - expenses,
    netProfitPaise: revenue - expenses,
    rows,
    unclassified: tb.rows.filter((row: any) => !row.group?.rootCategory),
  };
}
export async function balanceSheet(query: any) {
  const tb: any = await trialBalance({ ...query, includeZero: true });
  const assets = tb.rows.filter(
    (row: any) => row.group?.rootCategory === "assets",
  );
  const liabilities = tb.rows.filter((row: any) =>
    ["liabilities", "equity"].includes(row.group?.rootCategory),
  );
  const profit: any = await profitLoss(query);
  const assetTotal = assets.reduce(
    (sum: number, row: any) =>
      sum + row.closingDebitPaise - row.closingCreditPaise,
    0,
  );
  const liabilityTotal =
    liabilities.reduce(
      (sum: number, row: any) =>
        sum + row.closingCreditPaise - row.closingDebitPaise,
      0,
    ) + profit.netProfitPaise;
  return {
    assets,
    liabilities,
    currentProfitPaise: profit.netProfitPaise,
    assetTotalPaise: assetTotal,
    liabilitiesAndEquityPaise: liabilityTotal,
    differencePaise: assetTotal - liabilityTotal,
    balanced: assetTotal === liabilityTotal,
  };
}
export async function cashFlow(query: any) {
  const { ledgers } = await context(query);
  const cashLedgers = ledgers.filter((ledger: any) =>
    ["cash", "bank"].includes(ledger.ledgerType),
  );
  const gl: any = await generalLedger({
    ...query,
    ledgerAccountId: undefined,
    page: 1,
    limit: 100000,
  });
  const rows = gl.rows.filter((row: any) =>
    cashLedgers.some(
      (ledger: any) => id(ledger._id) === id(row.ledgerAccountId),
    ),
  );
  const opening = cashLedgers.reduce(
    (sum: number, ledger: any) =>
      sum +
      Number(
        ledger.openingBalanceType === "debit"
          ? ledger.openingBalancePaise
          : -(ledger.openingBalancePaise || 0),
      ),
    0,
  );
  const net = rows.reduce(
    (sum: number, row: any) => sum + row.debitPaise - row.creditPaise,
    0,
  );
  return {
    openingCashPaise: opening,
    operatingPaise: 0,
    investingPaise: 0,
    financingPaise: 0,
    unclassifiedPaise: net,
    netMovementPaise: net,
    closingCashPaise: opening + net,
    limitation:
      "Cash-flow classification requires explicit activity mappings; unclassified cash/bank movements are shown separately.",
    rows,
  };
}
export async function inventoryValuation(query: any) {
  const filter: any = { companyId: query.companyId };
  if (query.warehouseId) filter.warehouseId = query.warehouseId;
  if (query.productId) filter.productId = query.productId;
  const items: any[] = await WarehouseStock.find(filter)
    .populate("productId", "productName productId category")
    .populate("warehouseId", "warehouseName warehouseCode")
    .lean();
  return {
    items,
    totalInventoryValuePaise: items.reduce(
      (sum, item) => sum + Number(item.inventoryValuePaise || 0),
      0,
    ),
  };
}
export async function gstSummary(query: any) {
  const { ledgers } = await context(query);
  return {
    rows: [],
    missingClassification: ledgers
      .filter((ledger: any) => /gst|cgst|sgst|igst/i.test(ledger.name))
      .map((ledger: any) => ({ ledgerId: ledger._id, name: ledger.name })),
    limitation:
      "GST amounts are not recalculated or inferred. Explicit verified tax classification is required.",
  };
}
