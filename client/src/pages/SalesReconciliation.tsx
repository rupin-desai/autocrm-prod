// @ts-nocheck
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { PageHeader, EmptyState, TableSkeleton } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function SalesReconciliation() {
  const [invoiceId, setInvoiceId] = useState("");
  const { data: invoices } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    queryFn: async () =>
      (await fetch("/api/invoices", { credentials: "include" })).json(),
  });
  const { data, isLoading, refetch, error } = useQuery<any>({
    queryKey: ["/api/accounting/reconciliation", invoiceId],
    queryFn: async () => {
      const r = await fetch(
        `/api/accounting/sales/reconciliation/invoices/${invoiceId}`,
        { credentials: "include" },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to reconcile");
      return d;
    },
    enabled: Boolean(invoiceId),
  });
  const mismatch =
    data?.mismatches?.invoicePostingMissing ||
    data?.mismatches?.receiptDifferencePaise !== 0;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Reconciliation"
        description="Read-only comparison of CRM source values and posted accounting sources."
        icon={ClipboardCheck}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={!invoiceId}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          >
            <option value="">Select invoice</option>
            {(invoices || []).map((i: any) => (
              <option key={i._id} value={i._id}>
                {i.invoiceNumber} — {i.customerDetails?.fullName}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>
      {!invoiceId ? (
        <EmptyState title="Select an invoice" />
      ) : isLoading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <div className="rounded border border-destructive/40 p-4 text-destructive">
          {error.message}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle
              className={mismatch ? "text-destructive" : "text-emerald-600"}
            >
              {mismatch ? "Mismatch detected" : "Reconciled"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Invoice total: ₹{((data.invoiceTotalPaise || 0) / 100).toFixed(2)}
            </p>
            <p>
              Invoice voucher:{" "}
              {data.invoiceVoucher?.voucherId?.voucherNumber || "Missing"}
            </p>
            <p>
              CRM payments: ₹
              {((data.crmPaymentTotalPaise || 0) / 100).toFixed(2)}
            </p>
            <p>
              Posted receipts: ₹
              {((data.postedReceiptTotalPaise || 0) / 100).toFixed(2)}
            </p>
            <p>
              Confirmed advance allocations: ₹
              {((data.confirmedAdvanceAllocationPaise || 0) / 100).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
