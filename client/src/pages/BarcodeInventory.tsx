import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Boxes, History, Loader2, Package, PackageX, Plus, Printer, ScanBarcode, Search, Trash2 } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { KPICard } from "@/components/KPICard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { printLabels } from "@/lib/barcodeLabel";

type StockType = "IN" | "OUT";
type CartLine = { product: any; quantity: string; override: boolean };

const n = (v: unknown) => Number(v) || 0;
const isLow = (p: any) => n(p.stockQty) <= n(p.minStockLevel);

// Shared by the summary cards and the parts list, so a card's count always matches the list it opens.
const stockFilters: Record<string, (p: any) => boolean> = {
  all: () => true,
  in: (p) => n(p.stockQty) > 0,
  low: (p) => n(p.stockQty) > 0 && isLow(p),
  out: (p) => n(p.stockQty) <= 0,
};

// A USB scanner types wherever the cursor is, so closing a dialog must hand focus back to the visible scanner box.
const returnFocusToScanner = (event: Event) => {
  const scanner = ["IN", "OUT"].map((type) => document.getElementById(`scanner-${type}`)).find((el) => el?.offsetParent);
  if (scanner) {
    event.preventDefault();
    scanner.focus();
  }
};

function refreshStockQueries() {
  queryClient.invalidateQueries({ queryKey: ["/api/products"] });
  queryClient.invalidateQueries({ queryKey: ["/api/products/low-stock"] });
  queryClient.invalidateQueries({ queryKey: ["/api/inventory-transactions"] });
  queryClient.invalidateQueries({ queryKey: ["/api/barcode-inventory/movements"] });
}

function StockBadge({ product }: { product: any }) {
  const stock = n(product.stockQty);
  if (stock <= 0) return <Badge variant="destructive">{stock} · Out</Badge>;
  if (isLow(product)) return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">{stock} · Low</Badge>;
  return <Badge variant="secondary">{stock}</Badge>;
}

export default function BarcodeInventory() {
  const { data: products = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const [newPartOpen, setNewPartOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState("");
  const [historyProduct, setHistoryProduct] = useState<any>(null);
  // Set by the Stock IN desk so a freshly created part lands in its cart.
  const [createdPart, setCreatedPart] = useState<any>(null);
  const [tab, setTab] = useState("in");
  const [partsView, setPartsView] = useState({ stock: "all", key: 0 });

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort() as string[], [products]);
  const stats = useMemo(() => ({
    parts: products.length,
    units: products.reduce((sum, p) => sum + Math.max(0, n(p.stockQty)), 0),
    low: products.filter(stockFilters.low).length,
    out: products.filter(stockFilters.out).length,
  }), [products]);

  // A new key remounts the list, clearing search and category so it shows exactly what the card counted.
  const openPartsList = (stock: string) => {
    setPartsView((view) => ({ stock, key: view.key + 1 }));
    setTab("parts");
  };

  if (isLoading) {
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
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Barcode Inventory</h1>
          <p className="text-muted-foreground mt-1">Scan parts in and out, print labels, track every movement</p>
        </div>
        <Button onClick={() => { setScannedCode(""); setNewPartOpen(true); }} data-testid="button-add-part"><Plus className="h-4 w-4 mr-2" />Add New Part</Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {([
          { stock: "all", title: "Parts", value: stats.parts, icon: Package, color: "blue" },
          { stock: "in", title: "Units in stock", value: stats.units.toLocaleString("en-IN"), icon: Boxes, color: "green" },
          { stock: "low", title: "Low stock", value: stats.low, icon: AlertTriangle, color: "yellow" },
          { stock: "out", title: "Out of stock", value: stats.out, icon: PackageX, color: "pink" },
        ] as const).map(({ stock, ...card }) => (
          <button
            key={stock}
            type="button"
            className="h-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => openPartsList(stock)}
          >
            <KPICard {...card} className="h-full" />
          </button>
        ))}
      </div>

      {/* Put the cursor in the scanner box so the next scan is not lost after switching tabs */}
      <Tabs
        value={tab}
        className="space-y-4"
        onValueChange={(next) => {
          setTab(next);
          setTimeout(() => document.getElementById(`scanner-${next.toUpperCase()}`)?.focus(), 0);
        }}
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="in">Stock IN</TabsTrigger>
          <TabsTrigger value="out">Stock OUT</TabsTrigger>
          <TabsTrigger value="parts">Parts &amp; Labels</TabsTrigger>
        </TabsList>
        {/* forceMount keeps each cart alive while switching tabs */}
        <TabsContent value="in" forceMount className="data-[state=inactive]:hidden">
          <StockDesk type="IN" onUnknown={(code) => { setScannedCode(code); setNewPartOpen(true); }} createdPart={createdPart} onHistory={setHistoryProduct} />
        </TabsContent>
        <TabsContent value="out" forceMount className="data-[state=inactive]:hidden">
          <StockDesk type="OUT" onHistory={setHistoryProduct} />
        </TabsContent>
        <TabsContent value="parts">
          <PartsList key={partsView.key} initialStock={partsView.stock} products={products} categories={categories} onHistory={setHistoryProduct} />
        </TabsContent>
      </Tabs>

      <NewPartDialog open={newPartOpen} onOpenChange={setNewPartOpen} onCreated={setCreatedPart} categories={categories} barcode={scannedCode} />
      <MovementHistoryDialog product={historyProduct} onClose={() => setHistoryProduct(null)} />
    </div>
  );
}

function StockDesk({ type, onUnknown, createdPart, onHistory }: {
  type: StockType;
  onUnknown?: (code: string) => void;
  createdPart?: any;
  onHistory: (product: any) => void;
}) {
  const { toast } = useToast();
  const scannerRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [unknownCode, setUnknownCode] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [reference, setReference] = useState("");
  const [lowStockAlert, setLowStockAlert] = useState<any[]>([]);

  const focusScanner = () => setTimeout(() => scannerRef.current?.focus(), 0);

  const addToCart = (product: any) => {
    setCart((lines) => {
      const existing = lines.find((l) => l.product._id === product._id);
      if (existing) {
        return lines.map((l) => (l === existing ? { ...l, quantity: String(n(l.quantity) + 1) } : l));
      }
      return [{ product, quantity: "1", override: false }, ...lines];
    });
  };

  // A part created from the "Add New Part" dialog goes straight into the IN cart.
  useEffect(() => {
    if (type !== "IN" || !createdPart) return;
    addToCart(createdPart);
    setUnknownCode("");
  }, [createdPart]);

  const lookup = async (raw: string) => {
    // Shop barcodes are upper case; this also covers a scanner left on caps lock.
    const barcode = raw.trim().toUpperCase();
    setCode("");
    if (!barcode) return;
    setLooking(true);
    try {
      const res = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`, { credentials: "include" });
      if (res.status === 404) {
        setUnknownCode(barcode);
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      setUnknownCode("");
      addToCart(await res.json());
    } catch (error: any) {
      toast({ title: "Scan failed", description: error.message, variant: "destructive" });
    } finally {
      setLooking(false);
      focusScanner();
    }
  };

  const updateLine = (id: string, patch: Partial<CartLine>) =>
    setCart((lines) => lines.map((l) => (l.product._id === id ? { ...l, ...patch } : l)));

  const shortOf = (line: CartLine) => type === "OUT" && n(line.quantity) > n(line.product.stockQty);
  const invalidQty = cart.some((l) => !Number.isInteger(Number(l.quantity)) || n(l.quantity) <= 0);
  const blockedByStock = cart.some((l) => shortOf(l) && !l.override);

  const confirm = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/barcode-inventory/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type,
          reference: reference.trim() || undefined,
          items: cart.map((l) => ({ productId: l.product._id, quantity: n(l.quantity), override: l.override })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.error || res.statusText), body);
      return body;
    },
    onSuccess: (data) => {
      toast({ title: `Stock ${type} saved`, description: `${cart.length} part(s) updated` });
      setCart([]);
      setReference("");
      setLowStockAlert(type === "OUT" ? data.lowStock : []);
      refreshStockQueries();
      focusScanner();
    },
    onError: (error: any) => {
      // Stock moved since the scan: show the real count so the override option appears.
      if (error.shortages) {
        setCart((lines) => lines.map((l) => {
          const s = error.shortages.find((x: any) => x.productId === l.product._id);
          return s ? { ...l, product: { ...l.product, stockQty: s.stockQty } } : l;
        }));
      }
      if (error.appliedProductIds?.length) {
        setCart((lines) => lines.filter((l) => !error.appliedProductIds.includes(l.product._id)));
      }
      toast({ title: "Stock not saved", description: error.message, variant: "destructive" });
      refreshStockQueries();
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Label htmlFor={`scanner-${type}`}>Scan barcode {type === "IN" ? "to receive" : "to issue"}</Label>
          <div className="relative">
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id={`scanner-${type}`}
              ref={scannerRef}
              autoFocus={type === "IN"}
              autoComplete="off"
              value={code}
              placeholder="Scan or type MAW-001000 and press Enter"
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  lookup(code);
                }
              }}
              className="pl-11 h-12 text-lg font-mono"
              data-testid={`input-scanner-${type.toLowerCase()}`}
            />
            {looking && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
          {unknownCode && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unknown barcode {unknownCode}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                No part has this barcode.
                {onUnknown && <Button size="sm" variant="outline" onClick={() => onUnknown(unknownCode)}>Add as new part</Button>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {lowStockAlert.length > 0 && (
        <Alert className="border-amber-500/50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Low stock after this issue</AlertTitle>
          <AlertDescription>
            {lowStockAlert.map((p) => `${p.productName} (${n(p.stockQty)} left)`).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cart ({cart.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cart.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Scan a part to start. Scanning the same part again adds 1 more.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead className="text-right">In stock</TableHead>
                    <TableHead className="w-28">Qty</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((line) => (
                    <TableRow key={line.product._id}>
                      <TableCell>
                        <div className="font-medium">{line.product.productName}</div>
                        <div className="text-xs text-muted-foreground">{line.product.brand} · {line.product.category}</div>
                        {shortOf(line) && (
                          <label className="mt-2 flex items-center gap-2 text-xs text-destructive">
                            <Checkbox checked={line.override} onCheckedChange={(v) => updateLine(line.product._id, { override: v === true })} />
                            Only {n(line.product.stockQty)} in stock. Issue anyway (logged as override)
                          </label>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{line.product.barcode}</TableCell>
                      <TableCell className="text-right"><StockBadge product={line.product} /></TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={line.quantity}
                          aria-label={`Quantity for ${line.product.productName}`}
                          onChange={(e) => updateLine(line.product._id, { quantity: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && focusScanner()}
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" aria-label="Movement history" onClick={() => onHistory(line.product)}><History className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Remove from cart" onClick={() => { setCart((lines) => lines.filter((l) => l !== line)); focusScanner(); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor={`reference-${type}`}>{type === "IN" ? "Supplier / bill no. (optional)" : "Job card / customer (optional)"}</Label>
              <Input id={`reference-${type}`} value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <Button
              size="lg"
              disabled={!cart.length || invalidQty || blockedByStock || confirm.isPending}
              onClick={() => confirm.mutate()}
              data-testid={`button-confirm-${type.toLowerCase()}`}
            >
              {confirm.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Stock {type}
            </Button>
          </div>
          {invalidQty && <p className="text-sm text-destructive">Every quantity must be a whole number above 0.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function PartsList({ products, categories, onHistory, initialStock }: { products: any[]; categories: string[]; onHistory: (product: any) => void; initialStock: string }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState(initialStock);
  const [sort, setSort] = useState("name");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => category === "all" || p.category === category)
      .filter(stockFilters[stockFilter])
      .filter((p) => !term || [p.productName, p.brand, p.barcode, p.category, ...(p.modelCompatibility || [])]
        .some((v) => String(v || "").toLowerCase().includes(term)))
      .sort((a, b) => sort === "name"
        ? String(a.productName).localeCompare(String(b.productName))
        : sort === "stock-low" ? n(a.stockQty) - n(b.stockQty) : n(b.stockQty) - n(a.stockQty));
  }, [products, search, category, stockFilter, sort]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] items-end">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, brand, barcode, car model..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full md:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-full md:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="in">In stock</SelectItem>
              <SelectItem value="low">Low stock</SelectItem>
              <SelectItem value="out">Out of stock</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full md:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="stock-low">Stock (low first)</SelectItem>
              <SelectItem value="stock-high">Stock (high first)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={!visible.length} onClick={() => printLabels(visible)}>
            <Printer className="h-4 w-4 mr-2" />Print {visible.length} labels
          </Button>
        </div>

        <DataTable
          data={visible}
          itemsPerPage={25}
          columns={[
            { header: "Barcode", accessor: (p: any) => <span className="font-mono text-xs">{p.barcode || "-"}</span> },
            { header: "Part", accessor: (p: any) => <div><div className="font-medium">{p.productName}</div><div className="text-xs text-muted-foreground">{p.brand}</div></div> },
            { header: "Category", accessor: "category" },
            { header: "Fits", accessor: (p: any) => <span className="text-xs">{(p.modelCompatibility || []).join(", ") || "-"}</span> },
            { header: "Stock", accessor: (p: any) => <StockBadge product={p} /> },
            {
              header: "",
              accessor: (p: any) => (
                <div className="flex justify-end">
                  <Button variant="ghost" size="icon" aria-label="Print label" onClick={() => printLabels([p])}><Printer className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label="Movement history" onClick={() => onHistory(p)}><History className="h-4 w-4" /></Button>
                </div>
              ),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

const emptyPart = { productName: "", brand: "", category: "", modelCompatibility: "", sellingPrice: "", mrp: "", minStockLevel: "" };

function NewPartDialog({ open, onOpenChange, onCreated, categories, barcode }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (product: any) => void;
  categories: string[];
  barcode: string;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyPart);
  const set = (key: keyof typeof emptyPart) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/products", {
        // A label scanned at the desk stays on the part; otherwise the server assigns a MAW code.
        barcode: barcode || undefined,
        // Existing inventory is all upper case; keep new parts consistent.
        productName: form.productName.trim().toUpperCase(),
        brand: form.brand.trim().toUpperCase(),
        category: form.category.trim().toUpperCase(),
        modelCompatibility: form.modelCompatibility.split(",").map((s) => s.trim()).filter(Boolean),
        sellingPrice: n(form.sellingPrice),
        mrp: n(form.mrp) || n(form.sellingPrice),
        minStockLevel: n(form.minStockLevel),
        stockQty: 0,
      });
      return res.json();
    },
    onSuccess: (product) => {
      toast({ title: "Part created", description: `Barcode ${product.barcode}. Printing label…` });
      refreshStockQueries();
      onCreated(product);
      onOpenChange(false);
      setForm(emptyPart);
      printLabels([product]);
    },
    onError: (error: any) => toast({ title: "Could not create part", description: error.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" onCloseAutoFocus={returnFocusToScanner}>
        <DialogHeader>
          <DialogTitle>Add New Part</DialogTitle>
          <DialogDescription>
            {barcode ? `Barcode ${barcode} is saved on this part` : "A MAW barcode is assigned on save"} and the label opens for printing. Stock starts at 0. Receive it through Stock IN.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="part-name">Part name *</Label>
            <Input id="part-name" required value={form.productName} onChange={set("productName")} placeholder="e.g. HEADLIGHT LEFT CRETA-24" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="part-brand">Brand *</Label>
              <Input id="part-brand" required value={form.brand} onChange={set("brand")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="part-category">Category *</Label>
              <Input id="part-category" required value={form.category} onChange={set("category")} list="part-categories" />
              <datalist id="part-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="part-fits">Compatible models (comma separated)</Label>
            <Input id="part-fits" value={form.modelCompatibility} onChange={set("modelCompatibility")} placeholder="HYUNDAI - CRETA, KIA - SELTOS" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="part-price">Selling price</Label>
              <Input id="part-price" type="number" min={0} value={form.sellingPrice} onChange={set("sellingPrice")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="part-mrp">MRP</Label>
              <Input id="part-mrp" type="number" min={0} value={form.mrp} onChange={set("mrp")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="part-min">Min stock</Label>
              <Input id="part-min" type="number" min={0} value={form.minStockLevel} onChange={set("minStockLevel")} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving..." : "Save & print label"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MovementHistoryDialog({ product, onClose }: { product: any; onClose: () => void }) {
  const { data: movements = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/barcode-inventory/movements", product?._id],
    enabled: !!product,
    staleTime: 0,
  });

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onCloseAutoFocus={returnFocusToScanner}>
        <DialogHeader>
          <DialogTitle>{product?.productName}</DialogTitle>
          <DialogDescription>{product?.barcode} · every stock change, newest first</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : movements.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No movements yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m._id}>
                    <TableCell className="whitespace-nowrap text-xs">{format(new Date(m.createdAt || m.date), "dd MMM yyyy, HH:mm")}</TableCell>
                    <TableCell><Badge variant={m.type === "OUT" ? "destructive" : "secondary"}>{m.type}</Badge></TableCell>
                    <TableCell className="text-right">{m.quantity}</TableCell>
                    <TableCell className="whitespace-nowrap">{m.previousStock ?? "?"} → {m.newStock ?? "?"}</TableCell>
                    <TableCell>{m.userId?.name || "-"}</TableCell>
                    <TableCell className="text-xs">
                      {m.reason}
                      {m.notes && <div className="text-destructive">{m.notes}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
