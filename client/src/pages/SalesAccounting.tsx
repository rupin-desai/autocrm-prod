// @ts-nocheck
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileCheck2, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, EmptyState, TableSkeleton } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const money = (p: number) => `₹${((Number(p) || 0) / 100).toFixed(2)}`;
export default function SalesAccounting() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState("");
  const {
    data: invoices,
    isLoading,
    refetch,
  } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    queryFn: async () =>
      (
        await fetch("/api/invoices?status=approved", { credentials: "include" })
      ).json(),
  });
  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
  } = useQuery<any>({
    queryKey: ["/api/accounting/sales/invoice-preview", selectedId],
    queryFn: async () => {
      const r = await fetch(
        `/api/accounting/sales/invoices/${selectedId}/preview`,
        { credentials: "include" },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Preview blocked");
      return d;
    },
    enabled: Boolean(selectedId),
  });
  const post = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "POST",
          `/api/accounting/sales/invoices/${selectedId}/post`,
          {},
        )
      ).json(),
    onSuccess: () => {
      toast({ title: "Invoice posted to accounts" });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onError: (e: Error) =>
      toast({
        title: "Posting blocked",
        description: e.message,
        variant: "destructive",
      }),
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales accounting"
        description="Preview and explicitly post eligible approved invoices. GST-classification blockers are shown without changing CRM values."
        icon={FileCheck2}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Approved invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={6} />
            ) : !(invoices || []).length ? (
              <EmptyState title="No approved invoices" />
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice: any) => (
                  <button
                    className={`w-full rounded border p-3 text-left ${selectedId === invoice._id ? "border-primary" : ""}`}
                    key={invoice._id}
                    onClick={() => setSelectedId(invoice._id)}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {invoice.invoiceNumber}
                      </span>
                      <span className="text-xs">
                        {invoice.ownershipStatus || "unverified"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {invoice.customerDetails?.fullName} · ₹
                      {Number(invoice.totalAmount || 0).toFixed(2)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Accounting preview</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedId ? (
              <EmptyState
                title="Select an invoice"
                description="Choose an approved invoice to preview accounting lines."
              />
            ) : previewLoading ? (
              <TableSkeleton rows={4} />
            ) : previewError ? (
              <div className="rounded border border-destructive/40 p-4 text-sm text-destructive">
                {(previewError as Error).message}
                <p className="mt-2 text-muted-foreground">
                  Posting is unavailable until ownership, mappings and stored
                  GST classification are valid.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm">
                  {preview.invoice.invoiceNumber} ·{" "}
                  {preview.invoice.ownershipStatus}
                </p>
                {preview.lines.map((line: any, i: number) => (
                  <div
                    className="grid grid-cols-3 rounded border p-2 text-sm"
                    key={i}
                  >
                    <span>{line.description}</span>
                    <span>Dr {money(line.debitPaise)}</span>
                    <span>Cr {money(line.creditPaise)}</span>
                  </div>
                ))}
                <p className="text-sm font-medium">
                  Debit {money(preview.totalDebitPaise)} · Credit{" "}
                  {money(preview.totalCreditPaise)}
                </p>
                <Button onClick={() => post.mutate()} disabled={post.isPending}>
                  Post to Accounts
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
