import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowDownCircle, ArrowUpCircle, Package, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TxType = "IN" | "OUT" | "RETURN" | "ADJUSTMENT";

export default function Inventory() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("brand-asc");
  const [category, setCategory] = useState("all");
  const [openTxDialog, setOpenTxDialog] = useState(false);
  const [openReturnDialog, setOpenReturnDialog] = useState(false);
  const [txToDelete, setTxToDelete] = useState<any>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const [txForm, setTxForm] = useState({
    productId: "",
    type: "IN" as TxType,
    quantity: "",
    reason: "",
    batchNumber: "",
    unitCost: "",
    warehouseLocation: "",
    notes: "",
  });

  const [returnForm, setReturnForm] = useState({
    productId: "",
    quantity: "",
    reason: "",
    condition: "defective",
    restockable: true,
    refundAmount: "",
    notes: "",
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<any[]>({
    queryKey: ["/api/inventory-transactions"],
  });
  const { data: products = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: lowStockProducts = [] } = useQuery<any[]>({ queryKey: ["/api/products/low-stock"] });
  const { data: returns = [] } = useQuery<any[]>({ queryKey: ["/api/product-returns"] });

  const createTx = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/inventory-transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/low-stock"] });
      setOpenTxDialog(false);
      setTxForm({
        productId: "",
        type: "IN",
        quantity: "",
        reason: "",
        batchNumber: "",
        unitCost: "",
        warehouseLocation: "",
        notes: "",
      });
      toast({ title: "Success", description: "Transaction created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create transaction", variant: "destructive" });
    },
  });

  const deleteTx = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/inventory-transactions/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/low-stock"] });
      setOpenDeleteDialog(false);
      setTxToDelete(null);
      toast({ title: "Success", description: "Transaction deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete transaction", variant: "destructive" });
    },
  });

  const createReturn = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/product-returns", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-returns"] });
      setOpenReturnDialog(false);
      setReturnForm({
        productId: "",
        quantity: "",
        reason: "",
        condition: "defective",
        restockable: true,
        refundAmount: "",
        notes: "",
      });
      toast({ title: "Success", description: "Return created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create return", variant: "destructive" });
    },
  });

  const processReturn = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/product-returns/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Success", description: "Return updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update return", variant: "destructive" });
    },
  });

  const safeN = (v: unknown, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const date = (v: any) => {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "-" : format(d, "MMM dd, yyyy");
  };

  const categories = useMemo(
    () => Array.from(new Set(products.map((p: any) => p.category).filter(Boolean))).sort(),
    [products],
  );

  const visibleProducts = useMemo(() => {
    const list = category === "all" ? products : products.filter((p: any) => p.category === category);
    const q = searchTerm.toLowerCase();
    const filtered = list.filter((p: any) => {
      const name = String(p.productName || p.name || p.model || "").toLowerCase();
      const brand = String(p.brand || "").toLowerCase();
      const reason = String(p.reason || "").toLowerCase();
      return name.includes(q) || brand.includes(q) || reason.includes(q);
    });
    const s = [...filtered];
    s.sort((a: any, b: any) => {
      if (sortBy === "brand-asc") return String(a.brand || "").localeCompare(String(b.brand || ""));
      if (sortBy === "brand-desc") return String(b.brand || "").localeCompare(String(a.brand || ""));
      if (sortBy === "stock-high") return safeN(b.stockQty) - safeN(a.stockQty);
      if (sortBy === "stock-low") return safeN(a.stockQty) - safeN(b.stockQty);
      if (sortBy === "price-high") return safeN(b.sellingPrice) - safeN(a.sellingPrice);
      if (sortBy === "price-low") return safeN(a.sellingPrice) - safeN(b.sellingPrice);
      return String(a.category || "").localeCompare(String(b.category || ""));
    });
    return s;
  }, [products, category, searchTerm, sortBy]);

  const visibleTransactions = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return transactions.filter((tx: any) => {
      const name = String(tx.productId?.productName || tx.productId?.name || tx.productId?.model || "").toLowerCase();
      const brand = String(tx.productId?.brand || "").toLowerCase();
      const reason = String(tx.reason || "").toLowerCase();
      const cat = String(tx.productId?.category || "");
      const matchCategory = category === "all" || cat === category;
      return matchCategory && (name.includes(q) || brand.includes(q) || reason.includes(q));
    });
  }, [transactions, searchTerm, category]);

  const txBadge = (type: TxType) => {
    if (type === "IN") return <Badge variant="outline" className="text-green-600"><ArrowUpCircle className="h-3 w-3 mr-1" />IN</Badge>;
    if (type === "OUT") return <Badge variant="outline" className="text-red-600"><ArrowDownCircle className="h-3 w-3 mr-1" />OUT</Badge>;
    if (type === "RETURN") return <Badge variant="outline" className="text-blue-600"><Undo2 className="h-3 w-3 mr-1" />RETURN</Badge>;
    return <Badge variant="outline" className="text-orange-600"><Package className="h-3 w-3 mr-1" />ADJUST</Badge>;
  };

  if (transactionsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Track stock movements, returns and stock health</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={openTxDialog} onOpenChange={setOpenTxDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-transaction"><Plus className="h-4 w-4 mr-2" />New Transaction</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Inventory Transaction</DialogTitle>
                <DialogDescription>Record stock movement</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const quantity = parseInt(txForm.quantity, 10);
                  const unitCost = parseFloat(txForm.unitCost);
                  if (!txForm.productId || !txForm.reason || !Number.isFinite(quantity) || quantity <= 0) {
                    toast({ title: "Validation Error", description: "Product, reason and valid quantity are required", variant: "destructive" });
                    return;
                  }
                  const payload: any = {
                    productId: txForm.productId,
                    type: txForm.type,
                    quantity,
                    reason: txForm.reason,
                  };
                  if (txForm.batchNumber) payload.batchNumber = txForm.batchNumber;
                  if (txForm.warehouseLocation) payload.warehouseLocation = txForm.warehouseLocation;
                  if (txForm.notes) payload.notes = txForm.notes;
                  if (Number.isFinite(unitCost)) payload.unitCost = unitCost;
                  createTx.mutate(payload);
                }}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product *</Label>
                    <Select value={txForm.productId} onValueChange={(v) => setTxForm((p) => ({ ...p, productId: v }))}>
                      <SelectTrigger data-testid="select-product"><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.productName || p.name || p.model || "Unknown"} - {p.brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select value={txForm.type} onValueChange={(v: TxType) => setTxForm((p) => ({ ...p, type: v }))}>
                      <SelectTrigger data-testid="select-tx-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN">Stock In</SelectItem>
                        <SelectItem value="OUT">Stock Out</SelectItem>
                        <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                        <SelectItem value="RETURN">Return</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity *</Label>
                    <Input type="number" value={txForm.quantity} onChange={(e) => setTxForm((p) => ({ ...p, quantity: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Cost</Label>
                    <Input type="number" step="0.01" value={txForm.unitCost} onChange={(e) => setTxForm((p) => ({ ...p, unitCost: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Textarea value={txForm.reason} onChange={(e) => setTxForm((p) => ({ ...p, reason: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Batch Number</Label>
                    <Input value={txForm.batchNumber} onChange={(e) => setTxForm((p) => ({ ...p, batchNumber: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Warehouse Location</Label>
                    <Input value={txForm.warehouseLocation} onChange={(e) => setTxForm((p) => ({ ...p, warehouseLocation: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={txForm.notes} onChange={(e) => setTxForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpenTxDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createTx.isPending}>{createTx.isPending ? "Creating..." : "Create"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={openReturnDialog} onOpenChange={setOpenReturnDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-new-return"><Undo2 className="h-4 w-4 mr-2" />Product Return</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Product Return</DialogTitle>
                <DialogDescription>Record a customer return</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const quantity = parseInt(returnForm.quantity, 10);
                  const refundAmount = parseFloat(returnForm.refundAmount);
                  if (!returnForm.productId || !returnForm.reason || !Number.isFinite(quantity) || quantity <= 0) {
                    toast({ title: "Validation Error", description: "Product, reason and valid quantity are required", variant: "destructive" });
                    return;
                  }
                  const payload: any = {
                    productId: returnForm.productId,
                    quantity,
                    reason: returnForm.reason,
                    condition: returnForm.condition,
                    restockable: returnForm.restockable,
                  };
                  if (Number.isFinite(refundAmount)) payload.refundAmount = refundAmount;
                  if (returnForm.notes) payload.notes = returnForm.notes;
                  createReturn.mutate(payload);
                }}
              >
                <div className="space-y-2">
                  <Label>Product *</Label>
                  <Select value={returnForm.productId} onValueChange={(v) => setReturnForm((p) => ({ ...p, productId: v }))}>
                    <SelectTrigger data-testid="select-return-product"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.productName || p.name || p.model || "Unknown"} - {p.brand}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity *</Label>
                    <Input type="number" value={returnForm.quantity} onChange={(e) => setReturnForm((p) => ({ ...p, quantity: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Condition *</Label>
                    <Select value={returnForm.condition} onValueChange={(v) => setReturnForm((p) => ({ ...p, condition: v }))}>
                      <SelectTrigger data-testid="select-return-condition"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="defective">Defective</SelectItem>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="wrong_item">Wrong Item</SelectItem>
                        <SelectItem value="not_as_described">Not as Described</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason *</Label>
                  <Textarea value={returnForm.reason} onChange={(e) => setReturnForm((p) => ({ ...p, reason: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Refund Amount</Label>
                    <Input type="number" step="0.01" value={returnForm.refundAmount} onChange={(e) => setReturnForm((p) => ({ ...p, refundAmount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Restockable</Label>
                    <Select
                      value={returnForm.restockable ? "true" : "false"}
                      onValueChange={(v) => setReturnForm((p) => ({ ...p, restockable: v === "true" }))}
                    >
                      <SelectTrigger data-testid="select-restockable"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={returnForm.notes} onChange={(e) => setReturnForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpenReturnDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createReturn.isPending}>{createReturn.isPending ? "Creating..." : "Create"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] items-end">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product, brand or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-inventory-search"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[220px]" data-testid="select-sort-inventory"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="brand-asc">Brand (A-Z)</SelectItem>
            <SelectItem value="brand-desc">Brand (Z-A)</SelectItem>
            <SelectItem value="stock-high">Stock (High-Low)</SelectItem>
            <SelectItem value="stock-low">Stock (Low-High)</SelectItem>
            <SelectItem value="price-high">Price (High-Low)</SelectItem>
            <SelectItem value="price-low">Price (Low-High)</SelectItem>
            <SelectItem value="category-asc">Category (A-Z)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]" data-testid="select-category-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="products">Products Catalog</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="low-stock">Low Stock {lowStockProducts.length > 0 && <Badge className="ml-2" variant="destructive">{lowStockProducts.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="returns">Product Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Product Catalog ({visibleProducts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {visibleProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-10">No products found</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleProducts.map((p: any) => {
                    const stock = safeN(p.stockQty);
                    const min = safeN(p.minStockLevel);
                    return (
                      <Card key={p._id} className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base line-clamp-2">{p.productName || p.name || p.model || "Unknown"}</CardTitle>
                          <p className="text-sm text-muted-foreground">{p.brand}</p>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{p.category || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Stock</span><span className={stock <= min ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>{stock}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span>₹{safeN(p.sellingPrice).toLocaleString("en-IN")}</span></div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <DataTable
            data={visibleTransactions}
            columns={[
              { header: "Product", accessor: (r) => r.productId?.productName || r.productId?.name || r.productId?.model || "N/A" },
              { header: "Type", accessor: (r) => txBadge(r.type) },
              { header: "Quantity", accessor: (r) => r.previousStock !== undefined && r.newStock !== undefined ? `${r.previousStock} → ${r.newStock}` : r.quantity },
              { header: "Reason", accessor: "reason" },
              { header: "Date", accessor: (r) => date(r.createdAt || r.date) },
              {
                header: "Action",
                accessor: (r) => (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTxToDelete(r);
                      setOpenDeleteDialog(true);
                    }}
                    data-testid={`button-delete-transaction-${r._id}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                ),
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="low-stock">
          {lowStockProducts.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">All products are adequately stocked</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {lowStockProducts.map((p: any) => (
                <Card key={p._id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{p.productName || p.name || p.model || "Unknown"}</CardTitle>
                    <p className="text-sm text-muted-foreground">{p.brand}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between"><span className="text-muted-foreground">Current</span><Badge variant="destructive">{safeN(p.stockQty)}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Min</span><span>{safeN(p.minStockLevel)}</span></div>
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => {
                        setTxForm((prev) => ({ ...prev, productId: p._id, type: "IN" }));
                        setOpenTxDialog(true);
                      }}
                      data-testid={`button-restock-${p._id}`}
                    >
                      Restock Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="returns">
          <DataTable
            data={returns}
            columns={[
              { header: "Product", accessor: (r) => r.productId?.productName || r.productId?.name || r.productId?.model || "N/A" },
              { header: "Qty", accessor: "quantity" },
              { header: "Condition", accessor: (r) => <Badge variant="outline">{r.condition}</Badge> },
              { header: "Reason", accessor: "reason" },
              { header: "Status", accessor: (r) => <Badge variant={r.status === "rejected" ? "destructive" : r.status === "pending" ? "secondary" : "outline"}>{String(r.status || "").toUpperCase()}</Badge> },
              { header: "Date", accessor: (r) => date(r.returnDate) },
              {
                header: "Actions",
                accessor: (r) => r.status === "pending" ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => processReturn.mutate({ id: r._id, data: { status: "processed", restockable: r.restockable } })}
                      data-testid={`button-process-${r._id}`}
                    >
                      Process
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => processReturn.mutate({ id: r._id, data: { status: "rejected" } })}
                      data-testid={`button-reject-${r._id}`}
                    >
                      Reject
                    </Button>
                  </div>
                ) : "-",
              },
            ]}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => {
                if (txToDelete?._id) deleteTx.mutate(txToDelete._id);
              }}
              data-testid="button-confirm-delete-transaction"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
