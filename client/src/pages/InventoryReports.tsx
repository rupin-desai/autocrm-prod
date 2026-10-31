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
      (await response.json().catch(() => ({}))).error || "Request failed",
    );
  return response.json();
};
const titles: Record<string, string> = {
  purchase_receipt: "Purchase Receipt Report",
  sales_issue: "Sales Issue Report",
  purchase_return: "Purchase Return Report",
  sales_return: "Sales Return Report",
  stock_adjustment: "Stock Adjustment Report",
  stock_transfer: "Stock Transfer Report",
};
const money = (paise = 0) =>
  `₹${(Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function InventoryReports({ type }: { type: string }) {
  const context = useQuery<any>({
    queryKey: ["/api/accounting/context"],
    queryFn: () => get("/api/accounting/context"),
  });
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const warehouses = useQuery<any[]>({
    queryKey: ["/api/accounting/inventory/warehouses"],
    queryFn: () => get("/api/accounting/inventory/warehouses"),
    enabled: Boolean(context.data?.company?._id),
  });
  const products = useQuery<any>({
    queryKey: ["/api/products"],
    queryFn: () => get("/api/products?limit=500"),
    enabled: Boolean(context.data?.company?._id),
  });
  const params = new URLSearchParams({
    operationType: type,
    page: "1",
    limit: "100",
  });
  if (search) params.set("search", search);
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  if (warehouseId) params.set("warehouseId", warehouseId);
  if (productId) params.set("productId", productId);
  if (context.data?.financialYear?._id)
    params.set("financialYearId", context.data.financialYear._id);
  const report = useQuery<any>({
    queryKey: [
      "/api/accounting/inventory/reports/movements",
      type,
      search,
      fromDate,
      toDate,
      warehouseId,
      productId,
    ],
    queryFn: () => get(`/api/accounting/inventory/reports/movements?${params}`),
    enabled: Boolean(context.data?.company?._id),
  });
  const download = () => {
    window.open(
      `/api/accounting/inventory/reports/movements?${params}&format=csv`,
      "_blank",
    );
  };
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {titles[type] || "Inventory Report"}
        </h1>
        <p className="text-muted-foreground">
          Company: {context.data?.company?.name || "Loading"} · FY:{" "}
          {context.data?.financialYear?.label || "Loading"}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div>
            <Label>Search</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label>From</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <Label>To</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Warehouse</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">All</option>
              {(warehouses.data || []).map((item: any) => (
                <option key={item._id} value={item._id}>
                  {item.warehouseName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Product</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">All</option>
              {(products.data?.products || products.data || []).map(
                (item: any) => (
                  <option key={item._id} value={item._id}>
                    {item.productName || item.name}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={download}>
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{report.data?.total ?? 0} records</CardTitle>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <p>Loading…</p>
          ) : report.isError ? (
            <p className="text-destructive">Unable to load report.</p>
          ) : !report.data?.items?.length ? (
            <p className="text-muted-foreground">No persisted records found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Movement</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.data.items.map((item: any) => (
                  <TableRow key={item._id}>
                    <TableCell>
                      {new Date(item.movementDate).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.movementType}</Badge>
                    </TableCell>
                    <TableCell>{item.productId?.productName || "—"}</TableCell>
                    <TableCell>
                      {item.warehouseId?.warehouseName || "—"}
                    </TableCell>
                    <TableCell>{item.quantityIn}</TableCell>
                    <TableCell>{item.quantityOut}</TableCell>
                    <TableCell>{money(item.totalValuePaise)}</TableCell>
                    <TableCell>
                      {item.sourceReference || item.sourceId}
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
