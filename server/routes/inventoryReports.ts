import type { Express, Request } from "express";
import { requireAuth, requirePermission } from "../middleware";
import { getCompanyForUser, ensureFinancialYear } from "./accountingFoundation";
import { InventoryMovement } from "../models/InventoryMovement";
import { InventoryOperation } from "../models/InventoryOperation";
import { WarehouseStock } from "../models/WarehouseStock";
import { InventoryAccountingMapping } from "../models/InventoryAccountingMapping";
import { AccountingVoucher } from "../models/AccountingVoucher";

type AuthRequest = Request & {
  session: Request["session"] & {
    userId?: string;
    accountingCompanyId?: string;
    accountingFinancialYearId?: string;
  };
};
const errorMessage = (error: any) =>
  error?.issues?.[0]?.message || error?.message || "Inventory report failed";
const dateValue = (value: any) => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date filter");
  return date;
};

async function context(req: AuthRequest) {
  const companyId = String(req.session.accountingCompanyId || "");
  if (!companyId || !(await getCompanyForUser(req, companyId)))
    throw new Error("Accounting company context is required");
  const financialYearId = String(
    req.query.financialYearId || req.session.accountingFinancialYearId || "",
  );
  if (
    financialYearId &&
    !(await ensureFinancialYear(req, companyId, financialYearId))
  )
    throw new Error("Invalid financial year context");
  return { companyId, financialYearId };
}

export function registerInventoryReportRoutes(app: Express) {
  app.get(
    "/api/accounting/inventory/reports/movements",
    requireAuth,
    requirePermission("inventory", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const { companyId, financialYearId } = await context(request);
        const query: any = { companyId };
        if (financialYearId) query.financialYearId = financialYearId;
        for (const field of ["warehouseId", "productId"])
          if (req.query[field]) query[field] = req.query[field];
        if (req.query.operationType)
          query.movementType =
            req.query.operationType === "stock_adjustment"
              ? { $in: ["adjustment_in", "adjustment_out"] }
              : req.query.operationType === "stock_transfer"
                ? { $in: ["transfer_in", "transfer_out"] }
                : req.query.operationType;
        if (req.query.fromDate || req.query.toDate) {
          query.movementDate = {};
          if (req.query.fromDate)
            query.movementDate.$gte = dateValue(req.query.fromDate);
          if (req.query.toDate)
            query.movementDate.$lt = new Date(
              dateValue(req.query.toDate).getTime() + 86400000,
            );
        }
        const search = String(req.query.search || "").trim();
        if (search) query.sourceReference = { $regex: search, $options: "i" };
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
        const [items, total] = await Promise.all([
          InventoryMovement.find(query)
            .populate("productId", "productName productId")
            .populate("warehouseId", "warehouseName warehouseCode")
            .sort({ movementDate: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          InventoryMovement.countDocuments(query),
        ]);
        if (String(req.query.format) === "csv") {
          res
            .type("text/csv")
            .send(
              [
                "date,movement,product,warehouse,quantityIn,quantityOut,value,reference",
                ...items.map((item: any) =>
                  [
                    new Date(item.movementDate).toISOString(),
                    item.movementType,
                    item.productId?.productName || item.productId,
                    item.warehouseId?.warehouseName || item.warehouseId,
                    item.quantityIn,
                    item.quantityOut,
                    item.totalValuePaise,
                    item.sourceReference || "",
                  ]
                    .map((value) => `"${String(value).replace(/"/g, '""')}"`)
                    .join(","),
                ),
              ].join("\n"),
            );
          return;
        }
        res.json({
          items,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        });
      } catch (error) {
        res.status(400).json({ error: errorMessage(error) });
      }
    },
  );

  app.get(
    "/api/accounting/inventory/reconciliation",
    requireAuth,
    requirePermission("inventory", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const { companyId, financialYearId } = await context(request);
        const stockQuery: any = { companyId };
        const movementQuery: any = { companyId, status: "posted" };
        if (financialYearId) movementQuery.financialYearId = financialYearId;
        for (const field of ["warehouseId", "productId"])
          if (req.query[field]) {
            stockQuery[field] = req.query[field];
            movementQuery[field] = req.query[field];
          }
        if (req.query.fromDate || req.query.toDate) {
          movementQuery.movementDate = {};
          if (req.query.fromDate)
            movementQuery.movementDate.$gte = dateValue(req.query.fromDate);
          if (req.query.toDate)
            movementQuery.movementDate.$lt = new Date(
              dateValue(req.query.toDate).getTime() + 86400000,
            );
        }
        const [stocks, movements, mappingResult] = await Promise.all([
          WarehouseStock.find(stockQuery).lean(),
          InventoryMovement.find(movementQuery).lean(),
          InventoryAccountingMapping.findOne({ companyId }).lean(),
        ]);
        const mapping: any = mappingResult;
        const movementValuePaise = movements.reduce(
          (sum, item: any) =>
            sum +
            (item.movementType === "sales_issue" ||
            item.movementType === "purchase_return" ||
            item.movementType === "adjustment_out" ||
            item.movementType === "transfer_out"
              ? -Number(item.totalValuePaise || 0)
              : Number(item.totalValuePaise || 0)),
          0,
        );
        const stockValuePaise = stocks.reduce(
          (sum, item: any) => sum + Number(item.inventoryValuePaise || 0),
          0,
        );
        const voucherQuery: any = {
          companyId,
          status: "posted",
          sourceType: "inventory_operation",
        };
        if (financialYearId) voucherQuery.financialYearId = financialYearId;
        const vouchers: any[] =
          await AccountingVoucher.find(voucherQuery).lean();
        const assetId = mapping?.inventoryAssetLedgerId
          ? String(mapping.inventoryAssetLedgerId)
          : "";
        const inventoryLedgerBalancePaise = vouchers.reduce(
          (sum, voucher: any) =>
            sum +
            (voucher.lines || [])
              .filter((line: any) => String(line.ledgerAccountId) === assetId)
              .reduce(
                (inner: number, line: any) =>
                  inner +
                  Number(line.debitPaise || 0) -
                  Number(line.creditPaise || 0),
                0,
              ),
          0,
        );
        const duplicateVoucherGroups = vouchers.reduce(
          (groups: Record<string, number>, voucher: any) => {
            const key = `${voucher.sourceType}:${voucher.sourceId}`;
            groups[key] = (groups[key] || 0) + 1;
            return groups;
          },
          {},
        );
        const duplicateVouchers = Object.entries(duplicateVoucherGroups)
          .filter(([, count]) => count > 1)
          .map(([source]) => source);
        const unpostedOperationCount = await InventoryOperation.countDocuments({
          companyId,
          ...(financialYearId ? { financialYearId } : {}),
          status: { $nin: ["posted", "cancelled", "reversed"] },
        });
        res.json({
          companyId,
          financialYearId: financialYearId || null,
          stockValuePaise,
          movementValuePaise,
          inventoryLedgerBalancePaise,
          valuationDifferencePaise: stockValuePaise - movementValuePaise,
          ledgerDifferencePaise: stockValuePaise - inventoryLedgerBalancePaise,
          duplicateVouchers,
          unpostedOperationCount,
          timingDifferencePaise:
            movementValuePaise - inventoryLedgerBalancePaise,
          requiresManualReview:
            !mapping ||
            duplicateVouchers.length > 0 ||
            unpostedOperationCount > 0 ||
            stockValuePaise !== movementValuePaise ||
            stockValuePaise !== inventoryLedgerBalancePaise,
        });
      } catch (error) {
        res.status(400).json({ error: errorMessage(error) });
      }
    },
  );
}
