import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const get = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => ({}))).error || "Request failed",
    );
  return response.json();
};
const fields = [
  "inventoryAssetLedgerId",
  "costOfGoodsSoldLedgerId",
  "purchaseReceiptClearingLedgerId",
  "stockAdjustmentGainLedgerId",
  "stockAdjustmentLossLedgerId",
  "inventoryOpeningBalanceLedgerId",
];

export default function InventoryMappings() {
  const { toast } = useToast();
  const context = useQuery<any>({
    queryKey: ["/api/accounting/context"],
    queryFn: () => get("/api/accounting/context"),
  });
  const companyId = context.data?.company?._id || "";
  const mappings = useQuery<any>({
    queryKey: ["/api/accounting/inventory/mappings"],
    queryFn: () => get("/api/accounting/inventory/mappings"),
    enabled: Boolean(companyId),
  });
  const ledgers = useQuery<any>({
    queryKey: ["/api/accounting/ledgers", companyId],
    queryFn: () =>
      get(
        `/api/accounting/ledgers?companyId=${companyId}&status=active&limit=100`,
      ),
    enabled: Boolean(companyId),
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const current = mappings.data?.mapping || {};
  const options = ledgers.data?.items || [];
  const save = useMutation({
    mutationFn: () =>
      apiRequest("PUT", "/api/accounting/inventory/mappings", {
        companyId,
        ...values,
      }),
    onSuccess: () => {
      toast({ title: "Inventory mappings saved" });
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/inventory/mappings"],
      });
    },
    onError: (error: any) =>
      toast({ title: error.message, variant: "destructive" }),
  });
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Inventory Accounting Mappings
        </h1>
        <p className="text-muted-foreground">
          Company: {context.data?.company?.name || "Loading"}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Eligible company ledgers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mappings.isLoading || ledgers.isLoading ? (
            <p>Loading…</p>
          ) : mappings.isError || ledgers.isError ? (
            <p className="text-destructive">
              Unable to load mappings or ledgers.
            </p>
          ) : (
            fields.map((field) => (
              <div key={field}>
                <Label>{field}</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={values[field] ?? current[field]?._id ?? ""}
                  onChange={(event) =>
                    setValues({ ...values, [field]: event.target.value })
                  }
                >
                  <option value="">Not configured</option>
                  {options.map((ledger: any) => (
                    <option key={ledger._id} value={ledger._id}>
                      {ledger.code} — {ledger.name} (
                      {ledger.groupId?.name ||
                        ledger.groupId?.rootCategory ||
                        "group"}
                      )
                    </option>
                  ))}
                </select>
                {(values[field] || current[field]) && (
                  <Badge variant="outline" className="mt-1">
                    Company-scoped active ledger
                  </Badge>
                )}
              </div>
            ))
          )}
          <Button
            onClick={() => save.mutate()}
            disabled={!companyId || save.isPending}
          >
            Save mappings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
