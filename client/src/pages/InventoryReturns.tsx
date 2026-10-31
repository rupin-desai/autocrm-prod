import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const get = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => ({}))).error || "Request failed",
    );
  return response.json();
};
export default function InventoryReturns({
  kind,
}: {
  kind: "purchase" | "sales";
}) {
  const context = useQuery<any>({
    queryKey: ["/api/accounting/context"],
    queryFn: () => get("/api/accounting/context"),
  });
  const [sourceId, setSourceId] = useState("");
  const bills = useQuery<any[]>({
    queryKey: ["/api/accounting/purchase/bills"],
    queryFn: () =>
      get(
        `/api/accounting/purchase/bills?companyId=${context.data?.company?._id || ""}&financialYearId=${context.data?.financialYear?._id || ""}&status=posted`,
      ),
    enabled: kind === "purchase" && Boolean(context.data?.company?._id),
  });
  const invoices = useQuery<any>({
    queryKey: ["/api/invoices"],
    queryFn: () => get("/api/invoices?limit=500"),
    enabled: kind === "sales" && Boolean(context.data?.company?._id),
  });
  const eligibility = useQuery<any>({
    queryKey: ["/api/accounting/inventory/returns/eligible", kind, sourceId],
    queryFn: () =>
      get(
        `/api/accounting/inventory/returns/eligible?companyId=${context.data?.company?._id}&financialYearId=${context.data?.financialYear?._id}&${kind === "purchase" ? "purchaseBillId" : "invoiceId"}=${sourceId}`,
      ),
    enabled: Boolean(
      sourceId &&
        context.data?.company?._id &&
        context.data?.financialYear?._id,
    ),
  });
  const options =
    kind === "purchase"
      ? bills.data || []
      : invoices.data?.invoices || invoices.data || [];
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {kind === "purchase" ? "Purchase Returns" : "Sales Returns"}
        </h1>
        <p className="text-muted-foreground">
          Select a posted source and inspect verified eligible movements before
          return posting.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Original source</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>
            {kind === "purchase"
              ? "Posted purchase bill"
              : "Approved sales invoice"}
          </Label>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
          >
            <option value="">Select source</option>
            {options
              .filter((item: any) =>
                kind === "purchase"
                  ? item.status === "posted"
                  : item.status === "approved",
              )
              .map((item: any) => (
                <option key={item._id} value={item._id}>
                  {item.internalBillNumber || item.invoiceNumber}
                </option>
              ))}
          </select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Eligible source movements</CardTitle>
        </CardHeader>
        <CardContent>
          {eligibility.isLoading ? (
            <p>Loading…</p>
          ) : eligibility.isError ? (
            <p className="text-destructive">
              {(eligibility.error as Error).message}
            </p>
          ) : !sourceId ? (
            <p className="text-muted-foreground">Select a source document.</p>
          ) : !eligibility.data?.eligible?.length ? (
            <p className="text-muted-foreground">
              No verified receipt/issue movement is eligible for return.
            </p>
          ) : (
            <div className="space-y-2">
              {eligibility.data.eligible.map((item: any) => (
                <div
                  key={item.movement._id}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <span>
                    {item.movement.productId?.productName ||
                      item.movement.productId}{" "}
                    ·{" "}
                    {item.movement.warehouseId?.warehouseName ||
                      item.movement.warehouseId}
                  </span>
                  <Badge>{item.availableQuantity} available</Badge>
                </div>
              ))}
              <p className="text-sm text-amber-700">
                Return posting remains blocked until product-line, voucher and
                source-link transaction workflow is completed safely.
              </p>
              <Button disabled>Post return</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
