import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const money = (paise = 0) =>
  `₹${(Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const get = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => ({}))).error || "Request failed",
    );
  return response.json();
};
const Select = ({ value, onChange, children }: any) => (
  <select
    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {children}
  </select>
);

export default function InventoryAccounting() {
  const [location] = useLocation();
  const { toast } = useToast();
  const section = location.includes("warehouses")
    ? "warehouses"
    : location.includes("stock-ledger")
      ? "ledger"
      : location.includes("valuation")
        ? "valuation"
        : location.includes("mappings")
          ? "mappings"
          : location.includes("receipts")
            ? "receipts"
            : location.includes("issues")
              ? "issues"
              : location.includes("adjustments")
                ? "adjustments"
                : location.includes("opening-stock")
                  ? "opening"
                  : location.includes("transfers")
                    ? "transfers"
                    : location.includes("reconciliation")
                      ? "reconciliation"
                      : "summary";
  const context = useQuery<any>({
    queryKey: ["/api/accounting/context"],
    queryFn: () => get("/api/accounting/context"),
  });
  const warehouses = useQuery<any[]>({
    queryKey: ["/api/accounting/inventory/warehouses"],
    queryFn: () => get("/api/accounting/inventory/warehouses"),
    enabled: Boolean(context.data?.company?._id),
  });
  const summary = useQuery<any[]>({
    queryKey: ["/api/accounting/inventory/stock-summary", section],
    queryFn: () => get("/api/accounting/inventory/stock-summary"),
    enabled: section === "summary",
  });
  const ledger = useQuery<any[]>({
    queryKey: ["/api/accounting/inventory/ledger"],
    queryFn: () => get("/api/accounting/inventory/ledger"),
    enabled: section === "ledger",
  });
  const valuation = useQuery<any>({
    queryKey: ["/api/accounting/inventory/valuation"],
    queryFn: () => get("/api/accounting/inventory/valuation"),
    enabled: section === "valuation",
  });
  const mappings = useQuery<any>({
    queryKey: ["/api/accounting/inventory/mappings"],
    queryFn: () => get("/api/accounting/inventory/mappings"),
    enabled: section === "mappings",
  });
  const ledgers = useQuery<any>({
    queryKey: ["/api/accounting/ledgers", context.data?.company?._id],
    queryFn: () =>
      get(
        `/api/accounting/ledgers?companyId=${context.data?.company?._id || ""}&status=active&limit=100`,
      ),
    enabled: section === "mappings" && Boolean(context.data?.company?._id),
  });
  const operations = useQuery<any[]>({
    queryKey: ["/api/accounting/inventory/operations", section],
    queryFn: () =>
      get(
        `/api/accounting/inventory/operations?operationType=${section === "receipts" ? "purchase_receipt" : section === "issues" ? "sales_issue" : section === "adjustments" ? "stock_adjustment" : section === "opening" ? "opening_stock" : ""}`,
      ),
    enabled: [
      "receipts",
      "issues",
      "adjustments",
      "opening",
      "reconciliation",
    ].includes(section),
  });
  const reconciliation = useQuery<any>({
    queryKey: ["/api/accounting/inventory/reconciliation"],
    queryFn: () => get("/api/accounting/inventory/reconciliation"),
    enabled: section === "reconciliation",
  });
  const products = useQuery<any>({
    queryKey: ["/api/products"],
    queryFn: () => get("/api/products?limit=500"),
    enabled: [
      "receipts",
      "issues",
      "adjustments",
      "opening",
      "transfers",
    ].includes(section),
  });
  const bills = useQuery<any[]>({
    queryKey: ["/api/accounting/purchase/bills"],
    queryFn: () =>
      get(
        `/api/accounting/purchase/bills?companyId=${context.data?.company?._id || ""}&financialYearId=${context.data?.financialYear?._id || ""}`,
      ),
    enabled: section === "receipts",
  });
  const invoices = useQuery<any>({
    queryKey: ["/api/invoices"],
    queryFn: () => get("/api/invoices?limit=500"),
    enabled: section === "issues",
  });
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [address, setAddress] = useState("");
  const [mappingForm, setMappingForm] = useState<any>({});
  const [operationSource, setOperationSource] = useState("");
  const [operationProduct, setOperationProduct] = useState("");
  const [operationWarehouse, setOperationWarehouse] = useState("");
  const [operationQuantity, setOperationQuantity] = useState("");
  const [operationCost, setOperationCost] = useState("");
  const [operationReason, setOperationReason] = useState("");
  const [operationKey, setOperationKey] = useState(
    () => `inventory-${Date.now()}`,
  );
  const [destinationWarehouse, setDestinationWarehouse] = useState("");
  const createWarehouse = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/accounting/inventory/warehouses", {
        warehouseName,
        warehouseCode,
        address,
      }),
    onSuccess: () => {
      toast({ title: "Warehouse created" });
      setWarehouseName("");
      setWarehouseCode("");
      setAddress("");
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/inventory/warehouses"],
      });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  const saveMappings = useMutation({
    mutationFn: () =>
      apiRequest("PUT", "/api/accounting/inventory/mappings", mappingForm),
    onSuccess: () => {
      toast({ title: "Inventory mappings saved" });
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/inventory/mappings"],
      });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  const operationType =
    section === "receipts"
      ? "purchase_receipt"
      : section === "issues"
        ? "sales_issue"
        : section === "adjustments"
          ? "stock_adjustment"
          : "opening_stock";
  const createOperation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/accounting/inventory/operations", {
        financialYearId: context.data?.financialYear?._id,
        accountingPeriodId: context.data?.period?._id,
        operationType,
        sourceType:
          operationType === "purchase_receipt"
            ? "purchase_bill"
            : operationType === "sales_issue"
              ? "invoice"
              : operationType,
        sourceId: operationSource || operationProduct,
        warehouseId: operationWarehouse,
        items: [
          {
            productId: operationProduct,
            quantity: Number(operationQuantity),
            unitCostPaise: Math.round(Number(operationCost || 0) * 100),
          },
        ],
        reason: operationReason,
        movementDate: new Date().toISOString().slice(0, 10),
        idempotencyKey: operationKey,
        status: "draft",
      }),
    onSuccess: () => {
      toast({ title: "Inventory operation saved as draft" });
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/inventory/operations"],
      });
      setOperationKey(`inventory-${Date.now()}`);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  const createTransfer = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/accounting/inventory/transfers", {
        financialYearId: context.data?.financialYear?._id,
        accountingPeriodId: context.data?.period?._id,
        productId: operationProduct,
        sourceWarehouseId: operationWarehouse,
        destinationWarehouseId: destinationWarehouse,
        quantity: Number(operationQuantity),
        unitCostPaise: Math.round(Number(operationCost || 0) * 100),
        movementDate: new Date().toISOString().slice(0, 10),
        idempotencyKey: operationKey,
        sourceReference: "UI transfer",
      }),
    onSuccess: () => {
      toast({ title: "Stock transfer posted" });
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/inventory/stock-summary"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/inventory/ledger"],
      });
      setOperationKey(`inventory-${Date.now()}`);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  const operationAction = async (
    id: string,
    action: "submitted" | "approved" | "post",
  ) => {
    try {
      await apiRequest(
        "POST",
        action === "post"
          ? `/api/accounting/inventory/operations/${id}/post`
          : `/api/accounting/inventory/operations/${id}/status`,
        action === "post" ? {} : { status: action },
      );
      toast({ title: `Operation ${action}` });
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/inventory/operations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/inventory/stock-summary"],
      });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };
  const ledgerOptions = ledgers.data?.items || [];
  const title: Record<string, string> = {
    summary: "Stock Summary",
    warehouses: "Warehouses",
    ledger: "Stock Ledger",
    valuation: "Inventory Valuation",
    mappings: "Inventory Accounting Mappings",
    receipts: "Purchase Receipts",
    issues: "Sales Issues",
    adjustments: "Stock Adjustments",
    opening: "Opening Stock",
    transfers: "Stock Transfers",
    reconciliation: "Inventory Reconciliation",
  };
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">{title[section]}</h1>
        <p className="text-muted-foreground">
          Company: {context.data?.company?.name || "Loading"} · FY:{" "}
          {context.data?.financialYear?.label || "Loading"}
        </p>
      </div>
      {section === "transfers" && (
        <Card>
          <CardHeader>
            <CardTitle>Transfer stock between warehouses</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Product</Label>
              <Select value={operationProduct} onChange={setOperationProduct}>
                <option value="">Select product</option>
                {(products.data?.products || products.data || []).map(
                  (p: any) => (
                    <option key={p._id} value={p._id}>
                      {p.productName || p.name || p.productId}
                    </option>
                  ),
                )}
              </Select>
            </div>
            <div>
              <Label>Source warehouse</Label>
              <Select
                value={operationWarehouse}
                onChange={setOperationWarehouse}
              >
                <option value="">Select warehouse</option>
                {(warehouses.data || []).map((w: any) => (
                  <option key={w._id} value={w._id}>
                    {w.warehouseName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Destination warehouse</Label>
              <Select
                value={destinationWarehouse}
                onChange={setDestinationWarehouse}
              >
                <option value="">Select warehouse</option>
                {(warehouses.data || []).map((w: any) => (
                  <option key={w._id} value={w._id}>
                    {w.warehouseName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="0.0001"
                value={operationQuantity}
                onChange={(e) => setOperationQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label>Unit cost ₹</Label>
              <Input
                type="number"
                min="0"
                value={operationCost}
                onChange={(e) => setOperationCost(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                disabled={
                  !operationProduct ||
                  !operationWarehouse ||
                  !destinationWarehouse ||
                  operationWarehouse === destinationWarehouse ||
                  !operationQuantity ||
                  createTransfer.isPending
                }
                onClick={() => createTransfer.mutate()}
              >
                Post transfer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {section === "warehouses" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Create warehouse</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={warehouseName}
                  onChange={(e) => setWarehouseName(e.target.value)}
                />
              </div>
              <div>
                <Label>Code</Label>
                <Input
                  value={warehouseCode}
                  onChange={(e) => setWarehouseCode(e.target.value)}
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  disabled={
                    !warehouseName ||
                    !warehouseCode ||
                    createWarehouse.isPending
                  }
                  onClick={() => createWarehouse.mutate()}
                >
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Company warehouses</CardTitle>
            </CardHeader>
            <CardContent>
              {warehouses.isLoading ? (
                <p>Loading…</p>
              ) : warehouses.isError ? (
                <p className="text-destructive">Unable to load warehouses.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Default</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(warehouses.data || []).map((item: any) => (
                      <TableRow key={item._id}>
                        <TableCell>{item.warehouseName}</TableCell>
                        <TableCell>{item.warehouseCode}</TableCell>
                        <TableCell>
                          <Badge>{item.isActive ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                        <TableCell>{item.isDefault ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {section === "summary" && (
        <Card>
          <CardHeader>
            <CardTitle>Warehouse stock balances</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <p>Loading…</p>
            ) : summary.isError ? (
              <p className="text-destructive">Unable to load stock summary.</p>
            ) : !summary.data?.length ? (
              <p className="text-muted-foreground">
                No warehouse stock balances found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>On hand</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Average cost</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.data.map((item: any) => (
                    <TableRow key={item._id}>
                      <TableCell>
                        {item.productId?.productName ||
                          item.productId?.productId ||
                          "—"}
                      </TableCell>
                      <TableCell>
                        {item.warehouseId?.warehouseName || "—"}
                      </TableCell>
                      <TableCell>{item.quantityOnHand}</TableCell>
                      <TableCell>{item.availableQuantity}</TableCell>
                      <TableCell>{money(item.averageCostPaise)}</TableCell>
                      <TableCell>{money(item.inventoryValuePaise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
      {section === "ledger" && (
        <Card>
          <CardHeader>
            <CardTitle>Immutable stock ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {ledger.isLoading ? (
              <p>Loading…</p>
            ) : ledger.isError ? (
              <p className="text-destructive">Unable to load stock ledger.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Movement</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead>Running balance</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ledger.data || []).map((item: any) => (
                    <TableRow key={item._id}>
                      <TableCell>
                        {new Date(item.movementDate).toLocaleDateString(
                          "en-IN",
                        )}
                      </TableCell>
                      <TableCell>{item.sourceReference || item._id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.movementType}</Badge>
                      </TableCell>
                      <TableCell>{item.quantityIn}</TableCell>
                      <TableCell>{item.quantityOut}</TableCell>
                      <TableCell>{item.runningBalance}</TableCell>
                      <TableCell>{money(item.totalValuePaise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
      {section === "valuation" && (
        <Card>
          <CardHeader>
            <CardTitle>Weighted average inventory valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-lg font-semibold">
              Total inventory value:{" "}
              {money(valuation.data?.totalInventoryValuePaise)}
            </p>
            {valuation.isLoading ? (
              <p>Loading…</p>
            ) : valuation.isError ? (
              <p className="text-destructive">Unable to load valuation.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Average cost</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(valuation.data?.items || []).map((item: any) => (
                    <TableRow key={item._id}>
                      <TableCell>
                        {item.productId?.productName || "—"}
                      </TableCell>
                      <TableCell>
                        {item.warehouseId?.warehouseName || "—"}
                      </TableCell>
                      <TableCell>{item.quantityOnHand}</TableCell>
                      <TableCell>{money(item.averageCostPaise)}</TableCell>
                      <TableCell>{money(item.inventoryValuePaise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
      {section === "mappings" && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory accounting mappings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Only eligible company ledgers should be configured. Missing
              mappings block future inventory voucher posting.
            </p>
            {(mappings.data?.requiredFields || []).map((field: string) => (
              <div key={field}>
                <Label>{field}</Label>
                <Input
                  placeholder="Ledger account ID"
                  value={
                    mappingForm[field] ||
                    mappings.data?.mapping?.[field]?._id ||
                    ""
                  }
                  onChange={(e) =>
                    setMappingForm({
                      ...mappingForm,
                      [field]: e.target.value || null,
                    })
                  }
                />
              </div>
            ))}
            <Button
              onClick={() => saveMappings.mutate()}
              disabled={saveMappings.isPending}
            >
              Save mappings
            </Button>
          </CardContent>
        </Card>
      )}
      {["receipts", "issues", "adjustments", "opening"].includes(section) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{title[section]} operation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Warehouse</Label>
                <Select
                  value={operationWarehouse}
                  onChange={setOperationWarehouse}
                >
                  <option value="">Select warehouse</option>
                  {(warehouses.data || []).map((w: any) => (
                    <option key={w._id} value={w._id}>
                      {w.warehouseName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Product</Label>
                <Select value={operationProduct} onChange={setOperationProduct}>
                  <option value="">Select product</option>
                  {(products.data?.products || products.data || []).map(
                    (p: any) => (
                      <option key={p._id} value={p._id}>
                        {p.productName || p.name || p.productId}
                      </option>
                    ),
                  )}
                </Select>
              </div>
              {section === "receipts" && (
                <div>
                  <Label>Purchase bill</Label>
                  <Select value={operationSource} onChange={setOperationSource}>
                    <option value="">Select bill</option>
                    {(bills.data || [])
                      .filter((b: any) =>
                        ["approved", "posted"].includes(b.status),
                      )
                      .map((b: any) => (
                        <option key={b._id} value={b._id}>
                          {b.internalBillNumber}
                        </option>
                      ))}
                  </Select>
                </div>
              )}
              {section === "issues" && (
                <div>
                  <Label>Approved invoice</Label>
                  <Select value={operationSource} onChange={setOperationSource}>
                    <option value="">Select invoice</option>
                    {(invoices.data?.invoices || invoices.data || [])
                      .filter((i: any) => i.status === "approved")
                      .map((i: any) => (
                        <option key={i._id} value={i._id}>
                          {i.invoiceNumber}
                        </option>
                      ))}
                  </Select>
                </div>
              )}
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0.0001"
                  value={operationQuantity}
                  onChange={(e) => setOperationQuantity(e.target.value)}
                />
              </div>
              <div>
                <Label>Unit cost ₹</Label>
                <Input
                  type="number"
                  min="0"
                  value={operationCost}
                  onChange={(e) => setOperationCost(e.target.value)}
                />
              </div>
              {section === "adjustments" && (
                <div>
                  <Label>Reason (include increase/decrease)</Label>
                  <Input
                    value={operationReason}
                    onChange={(e) => setOperationReason(e.target.value)}
                  />
                </div>
              )}
              <div className="flex items-end">
                <Button
                  disabled={
                    !operationWarehouse ||
                    !operationProduct ||
                    !operationQuantity ||
                    (section !== "opening" && !operationSource) ||
                    createOperation.isPending
                  }
                  onClick={() => createOperation.mutate()}
                >
                  Save Draft
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Operation workflow</CardTitle>
            </CardHeader>
            <CardContent>
              {operations.isLoading ? (
                <p>Loading…</p>
              ) : operations.isError ? (
                <p className="text-destructive">Unable to load operations.</p>
              ) : !operations.data?.length ? (
                <p className="text-muted-foreground">No operations found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.data.map((item: any) => (
                      <TableRow key={item._id}>
                        <TableCell>{item.operationType}</TableCell>
                        <TableCell>
                          <Badge>{item.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {item.sourceReference || item.sourceId}
                        </TableCell>
                        <TableCell className="flex gap-2">
                          {item.status === "draft" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                operationAction(item._id, "submitted")
                              }
                            >
                              Submit
                            </Button>
                          )}
                          {item.status === "submitted" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                operationAction(item._id, "approved")
                              }
                            >
                              Approve
                            </Button>
                          )}
                          {item.status === "approved" && (
                            <Button
                              size="sm"
                              onClick={() => operationAction(item._id, "post")}
                            >
                              Post
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {section === "reconciliation" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Inventory vs General Ledger</CardTitle>
            </CardHeader>
            <CardContent>
              {reconciliation.isLoading ? (
                <p>Loading…</p>
              ) : reconciliation.isError ? (
                <p className="text-destructive">
                  Unable to load reconciliation.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Warehouse value</p>
                    <p className="text-lg font-semibold">
                      {money(reconciliation.data?.stockValuePaise)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Movement value</p>
                    <p className="text-lg font-semibold">
                      {money(reconciliation.data?.movementValuePaise)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Inventory ledger</p>
                    <p className="text-lg font-semibold">
                      {money(reconciliation.data?.inventoryLedgerBalancePaise)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge
                      variant={
                        reconciliation.data?.requiresManualReview
                          ? "destructive"
                          : "default"
                      }
                    >
                      {reconciliation.data?.requiresManualReview
                        ? "Manual review required"
                        : "Matched"}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Inventory operations</CardTitle>
            </CardHeader>
            <CardContent>
              {operations.isLoading ? (
                <p>Loading…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(operations.data || []).map((item: any) => (
                      <TableRow key={item._id}>
                        <TableCell>{item.operationType}</TableCell>
                        <TableCell>
                          <Badge>{item.status}</Badge>
                        </TableCell>
                        <TableCell>{item.voucherId || "—"}</TableCell>
                        <TableCell>{item.sourceId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
