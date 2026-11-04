import type { Express, Request } from "express";
import { requireAuth, requirePermission } from "../middleware";
import { getCompanyForUser, ensureFinancialYear } from "./accountingFoundation";
import {
  reportQuerySchema,
  trialBalance,
  profitLoss,
  balanceSheet,
  cashFlow,
  generalLedger,
  dayBook,
  gstSummary,
} from "../accountingReports";
import {
  receivablesReport,
  payablesReport,
  historicalInventoryValuation,
} from "../reportingSourceReports";

type AuthRequest = Request & {
  session: Request["session"] & {
    accountingCompanyId?: string;
    accountingFinancialYearId?: string;
  };
};
const errorMessage = (error: any) =>
  error?.issues?.[0]?.message || error?.message || "Accounting report failed";
const toCsv = (value: any) => {
  const rows = value?.rows || value?.items || [];
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  return [
    keys.join(","),
    ...rows.map((row: any) =>
      keys
        .map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");
};

export function registerAccountingReportRoutes(app: Express) {
  const handler = (name: string, fn: (query: any) => Promise<any>) =>
    app.get(
      `/api/accounting/reports/${name}`,
      requireAuth,
      requirePermission("accounting", "read"),
      async (req, res) => {
        try {
          const request = req as AuthRequest;
          const parsed: any = reportQuerySchema.parse({
            ...req.query,
            companyId: request.session.accountingCompanyId,
            financialYearId:
              req.query.financialYearId ||
              request.session.accountingFinancialYearId,
          });
          if (!(await getCompanyForUser(request, parsed.companyId)))
            return res
              .status(403)
              .json({ error: "You are not authorized for this company" });
          if (
            !(await ensureFinancialYear(
              request,
              parsed.companyId,
              parsed.financialYearId,
            ))
          )
            return res.status(403).json({
              error: "Financial year does not belong to this company",
            });
          const result = await fn(parsed);
          if (parsed.format === "csv") {
            res.type("text/csv").send(toCsv(result));
            return;
          }
          res.json({
            ...result,
            companyId: parsed.companyId,
            financialYearId: parsed.financialYearId,
          });
        } catch (error) {
          res.status(400).json({ error: errorMessage(error) });
        }
      },
    );
  handler("trial-balance", trialBalance);
  handler("profit-loss", profitLoss);
  handler("balance-sheet", balanceSheet);
  handler("cash-flow", cashFlow);
  handler("general-ledger", generalLedger);
  handler("day-book", dayBook);
  handler("cash-book", cashFlow);
  handler("bank-book", cashFlow);
  handler("inventory-valuation", historicalInventoryValuation);
  handler("gst-summary", gstSummary);
  handler("receivables", receivablesReport);
  handler("payables", payablesReport);
  handler("advances", async (query) => {
    const result: any = await trialBalance(query);
    return {
      rows: result.rows.filter((row: any) =>
        /advance|clearing/i.test(row.name),
      ),
      limitation:
        "Advance and clearing balances are shown from posted ledgers without double-counting source documents.",
    };
  });
  handler("clearing", async (query) => {
    const result: any = await trialBalance(query);
    return {
      rows: result.rows.filter((row: any) => /clearing/i.test(row.name)),
    };
  });
  handler("inventory-valuation-history", historicalInventoryValuation);
}
