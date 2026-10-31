import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
const get = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => ({}))).error ||
        "Report request failed",
    );
  return response.json();
};
const money = (paise = 0) =>
  `₹${(Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const reports: Record<string, string> = {
  "trial-balance": "Trial Balance",
  "profit-loss": "Profit & Loss",
  "balance-sheet": "Balance Sheet",
  "cash-flow": "Cash Flow",
  "general-ledger": "General Ledger",
  "day-book": "Day Book",
  "cash-book": "Cash Book",
  "bank-book": "Bank Book",
  receivables: "Receivables",
  payables: "Payables",
  "inventory-valuation": "Inventory Valuation",
  "gst-summary": "GST Summary",
  advances: "Advances",
  clearing: "Clearing Accounts",
};
export default function FinancialReports() {
  const [type, setType] = useState("trial-balance");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const context = useQuery<any>({
    queryKey: ["/api/accounting/context"],
    queryFn: () => get("/api/accounting/context"),
  });
  const params = new URLSearchParams({
    financialYearId: context.data?.financialYear?._id || "",
    page: "1",
    limit: "100",
  });
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  const report = useQuery<any>({
    queryKey: ["/api/accounting/reports", type, fromDate, toDate],
    queryFn: () => get(`/api/accounting/reports/${type}?${params}`),
    enabled: Boolean(context.data?.financialYear?._id),
  });
  const data = report.data || {};
  const rows = data.rows || data.items || [];
  const exportCsv = () =>
    window.open(
      `/api/accounting/reports/${type}?${params}&format=csv`,
      "_blank",
    );
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Finance Reports</h1>
        <p className="text-muted-foreground">
          Company: {context.data?.company?.name || "Loading"} · FY:{" "}
          {context.data?.financialYear?.label || "Loading"}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Report selection and filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Report</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {Object.entries(reports).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>From date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <Label>To date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{reports[type]}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <p>Loading…</p>
          ) : report.isError ? (
            <p className="text-destructive">
              {(report.error as Error).message}
            </p>
          ) : type === "profit-loss" ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                Revenue
                <br />
                <strong>{money(data.revenuePaise)}</strong>
              </div>
              <div>
                Expenses
                <br />
                <strong>{money(data.expensesPaise)}</strong>
              </div>
              <div>
                Net profit/loss
                <br />
                <strong>{money(data.netProfitPaise)}</strong>
              </div>
              <div>
                Unclassified
                <br />
                <Badge
                  variant={
                    data.unclassified?.length ? "destructive" : "default"
                  }
                >
                  {data.unclassified?.length || 0}
                </Badge>
              </div>
            </div>
          ) : type === "balance-sheet" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                Assets
                <br />
                <strong>{money(data.assetTotalPaise)}</strong>
              </div>
              <div>
                Liabilities + Equity
                <br />
                <strong>{money(data.liabilitiesAndEquityPaise)}</strong>
              </div>
              <div>
                Status
                <br />
                <Badge variant={data.balanced ? "default" : "destructive"}>
                  {data.balanced
                    ? "Balanced"
                    : `Difference ${money(data.differencePaise)}`}
                </Badge>
              </div>
            </div>
          ) : type === "cash-flow" ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                Opening
                <br />
                <strong>{money(data.openingCashPaise)}</strong>
              </div>
              <div>
                Net movement
                <br />
                <strong>{money(data.netMovementPaise)}</strong>
              </div>
              <div>
                Closing
                <br />
                <strong>{money(data.closingCashPaise)}</strong>
              </div>
              <div className="text-amber-700">{data.limitation}</div>
            </div>
          ) : type === "trial-balance" ? (
            <>
              <div className="mb-3 flex gap-4">
                <span>Total debit: {money(data.totalDebitPaise)}</span>
                <span>Total credit: {money(data.totalCreditPaise)}</span>
                <Badge variant={data.balanced ? "default" : "destructive"}>
                  {data.balanced
                    ? "Balanced"
                    : `Difference ${money(data.differencePaise)}`}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Ledger</TableHead>
                    <TableHead>Opening Dr</TableHead>
                    <TableHead>Opening Cr</TableHead>
                    <TableHead>Period Dr</TableHead>
                    <TableHead>Period Cr</TableHead>
                    <TableHead>Closing Dr</TableHead>
                    <TableHead>Closing Cr</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => (
                    <TableRow key={row.ledgerAccountId}>
                      <TableCell>{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{money(row.openingDebitPaise)}</TableCell>
                      <TableCell>{money(row.openingCreditPaise)}</TableCell>
                      <TableCell>{money(row.periodDebitPaise)}</TableCell>
                      <TableCell>{money(row.periodCreditPaise)}</TableCell>
                      <TableCell>{money(row.closingDebitPaise)}</TableCell>
                      <TableCell>{money(row.closingCreditPaise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : !rows.length ? (
            <p className="text-muted-foreground">
              No posted accounting records found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Ledger/Reference</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Balance/Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any, index: number) => (
                  <TableRow
                    key={
                      row.voucherId || row.ledgerAccountId || row._id || index
                    }
                  >
                    <TableCell>
                      {row.date
                        ? new Date(row.date).toLocaleDateString("en-IN")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {row.voucherNumber || row.voucherType || "—"}
                    </TableCell>
                    <TableCell>
                      {row.ledgerName ||
                        row.name ||
                        row.referenceNumber ||
                        row.productId?.productName ||
                        "—"}
                    </TableCell>
                    <TableCell>
                      {money(
                        row.debitPaise ||
                          row.totalDebitPaise ||
                          row.inventoryValuePaise,
                      )}
                    </TableCell>
                    <TableCell>
                      {money(row.creditPaise || row.totalCreditPaise)}
                    </TableCell>
                    <TableCell>
                      {money(
                        row.runningBalancePaise ||
                          row.totalValuePaise ||
                          row.closingDebitPaise ||
                          row.closingCreditPaise,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
