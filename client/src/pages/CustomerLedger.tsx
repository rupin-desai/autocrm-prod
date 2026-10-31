// @ts-nocheck
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, RefreshCw } from "lucide-react";
import { PageHeader, EmptyState, TableSkeleton } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const money = (p: number) => `₹${((Number(p) || 0) / 100).toFixed(2)}`;
export default function CustomerLedger() {
  const [customerId, setCustomerId] = useState("");
  const { data: context } = useQuery<any>({
    queryKey: ["/api/accounting/context"],
  });
  const { data: customers } = useQuery<any[]>({
    queryKey: ["/api/dashboard/customer-search"],
    queryFn: async () => {
      const response = await fetch(
        "/api/dashboard/customer-search?period=year&limit=100",
        { credentials: "include" },
      );
      const data = await response.json();
      return data?.customers || data?.items || data || [];
    },
  });
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting/customer-ledger", customerId],
    queryFn: async () => {
      const r = await fetch(
        `/api/accounting/sales/customers/${customerId}/ledger?financialYearId=${context?.financialYear?._id || ""}`,
        { credentials: "include" },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to load ledger");
      return d;
    },
    enabled: Boolean(customerId),
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Ledger"
        description="Posted accounting entries only; CRM paid status is not used as accounting truth."
        icon={BookOpen}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={!customerId}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Customer and financial year</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select customer</option>
            {(customers || []).map((c: any) => (
              <option key={c._id} value={c._id}>
                {c.referenceCode || c._id} — {c.fullName}
              </option>
            ))}
          </select>
          <span className="rounded-md border px-3 py-2 text-sm">
            {context?.company?.name || "No company"} ·{" "}
            {context?.financialYear?.label || "No FY"}
          </span>
        </CardContent>
      </Card>
      {!customerId ? (
        <EmptyState title="Select a customer" />
      ) : isLoading ? (
        <TableSkeleton rows={8} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Ledger · Closing balance {money(data?.balancePaise || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data?.items || []).map((item: any) => (
                <div
                  className="grid gap-2 rounded border p-3 text-sm md:grid-cols-[130px_1fr_130px_130px_150px]"
                  key={`${item.voucherId}-${item.date}`}
                >
                  <span>{new Date(item.date).toLocaleDateString()}</span>
                  <span>
                    {item.voucherNumber || "-"} · {item.narration}
                  </span>
                  <span>Dr {money(item.debitPaise)}</span>
                  <span>Cr {money(item.creditPaise)}</span>
                  <span>Balance {money(item.balancePaise)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
