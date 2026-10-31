import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link2, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, EmptyState, TableSkeleton } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const fields = [
  ["productSalesLedgerId", "Product Sales Income"],
  ["serviceIncomeLedgerId", "Service Income"],
  ["outputCgstLedgerId", "Output CGST"],
  ["outputSgstLedgerId", "Output SGST"],
  ["outputIgstLedgerId", "Output IGST"],
  ["customerAdvancesLedgerId", "Customer Advances Liability"],
  ["cashLedgerId", "Cash"],
  ["upiClearingLedgerId", "UPI Clearing"],
  ["cardClearingLedgerId", "Card Clearing"],
  ["netBankingClearingLedgerId", "Net Banking Clearing"],
  ["chequeClearingLedgerId", "Cheque Clearing"],
] as const;
export default function SalesAccountingMappings() {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string | null>>({});
  const { data: context } = useQuery<any>({
    queryKey: ["/api/accounting/context"],
  });
  const companyId = context?.company?._id;
  const { data: ledgers, isLoading: ledgersLoading } = useQuery<any>({
    queryKey: ["/api/accounting/ledgers", companyId],
    queryFn: async () =>
      (
        await fetch(
          `/api/accounting/ledgers?companyId=${companyId}&limit=100`,
          { credentials: "include" },
        )
      ).json(),
    enabled: Boolean(companyId),
  });
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting/sales-mappings", companyId],
    queryFn: async () =>
      (
        await fetch(`/api/accounting/sales-mappings?companyId=${companyId}`, {
          credentials: "include",
        })
      ).json(),
    enabled: Boolean(companyId),
  });
  useEffect(() => {
    if (data?.mapping)
      setValues(
        Object.fromEntries(
          fields.map(([key]) => [
            key,
            data.mapping[key]?._id || data.mapping[key] || null,
          ]),
        ),
      );
  }, [data]);
  const save = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("PUT", "/api/accounting/sales-mappings", {
          companyId,
          ...values,
        })
      ).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/sales-mappings"],
      });
      toast({ title: "Sales accounting mappings saved" });
    },
    onError: (e: Error) =>
      toast({
        title: "Mapping validation failed",
        description: e.message,
        variant: "destructive",
      }),
  });
  const ledgerItems = ledgers?.items || [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales accounting mappings"
        description="Explicit company-scoped ledger mappings for future sales integration. No CRM transactions are posted here."
        icon={Link2}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Company context</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {context?.company?.name || "No company selected"} ·{" "}
            {context?.financialYear?.label || "No financial year selected"}
          </p>
        </CardContent>
      </Card>
      {isLoading || ledgersLoading ? (
        <TableSkeleton rows={8} />
      ) : !companyId ? (
        <EmptyState title="Select an accounting company first" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Ledger mappings</CardTitle>
            <p className="text-sm text-muted-foreground">
              Missing mappings are allowed, but future accounting posting must
              reject unconfigured items.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map(([key, label]) => (
              <div
                className="grid items-center gap-3 md:grid-cols-[260px_minmax(0,1fr)]"
                key={key}
              >
                <label className="text-sm font-medium">{label}</label>
                <select
                  className="h-10 rounded-md border bg-background px-3"
                  value={values[key] || ""}
                  onChange={(e) =>
                    setValues({ ...values, [key]: e.target.value || null })
                  }
                >
                  <option value="">Not configured</option>
                  {ledgerItems.map((ledger: any) => (
                    <option key={ledger._id} value={ledger._id}>
                      {ledger.code} — {ledger.name} ({ledger.ledgerType})
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save mappings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
