import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PeriodFilter, periodToQuery, type PeriodValue } from "@/components/PeriodFilter";
import { useAuth } from "@/lib/auth";
import { ArrowRightLeft, FileText, Plus, Search, Send, X } from "lucide-react";
import { EmptyState, PageHeader, StatTile, TableSkeleton } from "@/components/PageShell";

// Requirement 7: Customer Quotation.
// Nothing here touches sales, stock or accounting until Convert is used.

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  converted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  expired: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
};

const money = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

interface ItemRow {
  productId: string;
  name: string;
  quantity: string;
  rate: string;
  discountPercent: string;
  taxPercent: string;
}

const blankItem: ItemRow = { productId: "", name: "", quantity: "1", rate: "", discountPercent: "0", taxPercent: "18" };

export default function Quotations() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canConvert = user?.permissions?.quotations?.includes("convert");

  const [period, setPeriod] = useState<PeriodValue>({ period: "month" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [convertTarget, setConvertTarget] = useState<any>(null);
  const [priceConflict, setPriceConflict] = useState<any>(null);

  const [form, setForm] = useState({
    customerId: "",
    customerName: "",
    customerMobile: "",
    vehicleNumber: "",
    vehicleBrand: "",
    vehicleModel: "",
    quotationDate: new Date().toISOString().slice(0, 10),
    validUntil: "",
    expectedVisitDate: "",
    reminderDays: "7",
    notes: "",
    terms: "",
  });
  const [items, setItems] = useState<ItemRow[]>([{ ...blankItem }]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams(periodToQuery(period));
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("limit", "100");
    return params.toString();
  }, [period, search, statusFilter]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/quotations", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/quotations?${queryString}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load quotations");
      return res.json();
    },
  });

  const { data: customerData } = useQuery<any>({
    queryKey: ["/api/dashboard/customer-search", "quote", customerSearch],
    enabled: dialogOpen,
    queryFn: async () => {
      const params = new URLSearchParams({ period: "year", limit: "25" });
      if (customerSearch.trim()) params.set("search", customerSearch.trim());
      const res = await fetch(`/api/dashboard/customer-search?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load customers");
      return res.json();
    },
  });

  const { data: productData } = useQuery<any>({
    queryKey: ["/api/products", "quotation-picker"],
    enabled: dialogOpen,
    queryFn: async () => {
      const res = await fetch("/api/products?limit=200", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  const products = Array.isArray(productData) ? productData : productData?.items || [];

  // Mirrors the server calculation so the preview matches what will be stored.
  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, tax = 0;
    for (const i of items) {
      const qty = Number(i.quantity) || 0;
      const rate = Number(i.rate) || 0;
      const gross = qty * rate;
      const d = (gross * (Number(i.discountPercent) || 0)) / 100;
      const t = ((gross - d) * (Number(i.taxPercent) || 0)) / 100;
      subtotal += gross; discount += d; tax += t;
    }
    return { subtotal, discount, tax, grand: subtotal - discount + tax };
  }, [items]);

  const resetForm = () => {
    setForm({
      customerId: "", customerName: "", customerMobile: "", vehicleNumber: "",
      vehicleBrand: "", vehicleModel: "", quotationDate: new Date().toISOString().slice(0, 10),
      validUntil: "", expectedVisitDate: "", reminderDays: "7", notes: "", terms: "",
    });
    setItems([{ ...blankItem }]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const clean = items
        .filter((i) => i.name.trim())
        .map((i) => ({
          productId: i.productId || undefined,
          name: i.name.trim(),
          quantity: Number(i.quantity) || 1,
          rate: Number(i.rate) || 0,
          discountPercent: Number(i.discountPercent) || 0,
          taxPercent: Number(i.taxPercent) || 0,
        }));

      if (!clean.length) throw new Error("Add at least one item");
      if (!form.customerMobile.trim()) throw new Error("Customer mobile number is required");

      const res = await apiRequest("POST", "/api/quotations", {
        ...form,
        customerId: form.customerId || undefined,
        validUntil: form.validUntil || undefined,
        expectedVisitDate: form.expectedVisitDate || undefined,
        reminderDays: Number(form.reminderDays),
        items: clean,
      });
      return res.json();
    },
    onSuccess: (q: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Quotation created", description: `${q.quotationNumber} — ${money(q.grandTotal)}` });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to create quotation", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/quotations/${id}/send`, {});
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({
        title: "Quotation shared",
        description: result?.whatsappUpdate?.sent
          ? "Sent to the customer on WhatsApp."
          : "Marked as sent. WhatsApp message was not delivered (no approved template configured).",
      });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to send", variant: "destructive" }),
  });

  // Conversion is the only action with financial effect, so it confirms first
  // and surfaces any price drift before committing.
  const convertMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const res = await fetch(`/api/quotations/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "PRICE_CHANGED") {
          setPriceConflict({ id, changes: json.priceChanges });
          throw new Error("PRICE_CHANGED");
        }
        throw new Error(json.error || "Failed to convert");
      }
      return json;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setConvertTarget(null);
      setPriceConflict(null);
      toast({
        title: "Converted to invoice",
        description: `${result.invoice.invoiceNumber} created and sent for approval. Stock has been adjusted.`,
      });
    },
    onError: (error: any) => {
      if (error.message === "PRICE_CHANGED") {
        setConvertTarget(null);
        return;
      }
      toast({ title: "Error", description: error.message || "Failed to convert", variant: "destructive" });
    },
  });

  const rows = data?.items || [];
  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Customer Quotations"
        description="Estimates for customers. A quotation affects no sales, stock or accounting until it is converted."
        actions={
          <Button onClick={() => setDialogOpen(true)} data-testid="button-new-quotation">
            <Plus className="h-4 w-4 mr-2" />
            New Quotation
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          { key: "draft", tone: "neutral" as const },
          { key: "sent", tone: "accent" as const },
          { key: "accepted", tone: "positive" as const },
          { key: "converted", tone: "positive" as const },
        ]).map((s) => (
          <StatTile
            key={s.key}
            label={s.key}
            value={summary[s.key]?.count || 0}
            sub={money(summary[s.key]?.value || 0)}
            tone={s.tone}
            testId={`text-quote-${s.key}`}
            onClick={() => setStatusFilter(statusFilter === s.key ? "all" : s.key)}
            className={statusFilter === s.key ? "border-primary/50 ring-1 ring-primary/20" : undefined}
          />
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <PeriodFilter value={period} onChange={setPeriod} />
            <div className="min-w-[150px]">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-quote-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {Object.keys(STATUS_STYLES).map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[240px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Quotation, customer, vehicle, item..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-quotations"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No quotations in this period"
              description="Raise a quotation to give a customer an estimate. Nothing is billed until you convert it."
              action={
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> New Quotation
                </Button>
              }
            />
          ) : (
            <div className="table-scroll rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Expected visit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((q: any) => (
                    <TableRow key={q._id} data-testid={`row-quotation-${q._id}`}>
                      <TableCell className="font-mono text-xs">{q.quotationNumber}</TableCell>
                      <TableCell>
                        <div className="font-medium">{q.customerName}</div>
                        <div className="text-xs text-muted-foreground">{q.customerMobile}</div>
                      </TableCell>
                      <TableCell className="text-sm">{q.vehicleNumber || "-"}</TableCell>
                      <TableCell className="text-sm">{q.items?.length || 0}</TableCell>
                      <TableCell className="text-right font-semibold">{money(q.grandTotal)}</TableCell>
                      <TableCell className="text-sm">{shortDate(q.quotationDate)}</TableCell>
                      <TableCell className="text-sm">{shortDate(q.expectedVisitDate)}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[q.status]} variant="secondary">{q.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!["converted", "expired", "rejected"].includes(q.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => sendMutation.mutate(q._id)}
                              disabled={sendMutation.isPending}
                              data-testid={`button-send-quote-${q._id}`}
                            >
                              <Send className="h-3.5 w-3.5 mr-1" /> Send
                            </Button>
                          )}
                          {canConvert && !["converted", "expired", "rejected"].includes(q.status) && (
                            <Button
                              size="sm"
                              onClick={() => setConvertTarget(q)}
                              data-testid={`button-convert-quote-${q._id}`}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Convert
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create quotation */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl dialog-scroll">
          <DialogHeader>
            <DialogTitle>New Quotation</DialogTitle>
            <DialogDescription>
              Estimate for a customer. Saving this does not create an invoice, move stock or count as a sale.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Registered customer (optional)</Label>
              <Input
                placeholder="Search by name or mobile..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="mb-2"
              />
              <Select
                value={form.customerId}
                onValueChange={(customerId) => {
                  const c = (customerData?.items || []).find((x: any) => x._id === customerId);
                  setForm({
                    ...form,
                    customerId,
                    customerName: c?.fullName || form.customerName,
                    customerMobile: c?.mobileNumber || form.customerMobile,
                  });
                }}
              >
                <SelectTrigger data-testid="select-quote-customer">
                  <SelectValue placeholder="Select a customer (required to convert later)" />
                </SelectTrigger>
                <SelectContent>
                  {(customerData?.items || []).map((c: any) => (
                    <SelectItem key={c._id} value={c._id}>{c.fullName} — {c.mobileNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.customerId && (
                <p className="text-xs text-amber-600 mt-1">
                  A quotation can be raised for a walk-in, but the customer must be registered before it can be converted.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Customer name *</Label>
                <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} data-testid="input-quote-name" />
              </div>
              <div>
                <Label>Mobile number *</Label>
                <Input value={form.customerMobile} onChange={(e) => setForm({ ...form, customerMobile: e.target.value })} data-testid="input-quote-mobile" />
              </div>
              <div>
                <Label>Vehicle number</Label>
                <Input value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} data-testid="input-quote-vehicle" />
              </div>
              <div>
                <Label>Car brand</Label>
                <Input value={form.vehicleBrand} onChange={(e) => setForm({ ...form, vehicleBrand: e.target.value })} />
              </div>
              <div>
                <Label>Car model</Label>
                <Input value={form.vehicleModel} onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })} />
              </div>
              <div>
                <Label>Quotation date</Label>
                <Input type="date" value={form.quotationDate} onChange={(e) => setForm({ ...form, quotationDate: e.target.value })} />
              </div>
              <div>
                <Label>Valid until</Label>
                <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
              </div>
              <div>
                <Label>Expected visit date</Label>
                <Input
                  type="date"
                  value={form.expectedVisitDate}
                  onChange={(e) => setForm({ ...form, expectedVisitDate: e.target.value })}
                  data-testid="input-quote-visit"
                />
                <p className="text-xs text-muted-foreground mt-1">A reminder is raised on this date.</p>
              </div>
              <div>
                <Label>Fallback reminder (days)</Label>
                <Input type="number" min="0" value={form.reminderDays} onChange={(e) => setForm({ ...form, reminderDays: e.target.value })} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items *</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setItems([...items, { ...blankItem }])} data-testid="button-add-quote-item">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add item
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
                    <div className="col-span-4">
                      <Label className="text-xs">Item</Label>
                      <Select
                        value={item.productId}
                        onValueChange={(productId) => {
                          const p = products.find((x: any) => (x._id || x.id) === productId);
                          const next = [...items];
                          next[idx] = {
                            ...next[idx],
                            productId,
                            name: p?.productName || p?.name || next[idx].name,
                            rate: String(p?.sellingPrice ?? p?.price ?? next[idx].rate),
                          };
                          setItems(next);
                        }}
                      >
                        <SelectTrigger data-testid={`select-quote-product-${idx}`}>
                          <SelectValue placeholder="Pick from catalogue" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p: any) => (
                            <SelectItem key={p._id || p.id} value={p._id || p.id}>
                              {p.productName || p.name} — ₹{p.sellingPrice ?? p.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="mt-1"
                        placeholder="or type a custom item / service"
                        value={item.name}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setItems(next);
                        }}
                        data-testid={`input-quote-item-${idx}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number" min="1" value={item.quantity}
                        onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], quantity: e.target.value }; setItems(n); }}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Rate</Label>
                      <Input
                        type="number" min="0" value={item.rate}
                        onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], rate: e.target.value }; setItems(n); }}
                        data-testid={`input-quote-rate-${idx}`}
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs">Disc %</Label>
                      <Input
                        type="number" min="0" max="100" value={item.discountPercent}
                        onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], discountPercent: e.target.value }; setItems(n); }}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Tax %</Label>
                      <Input
                        type="number" min="0" value={item.taxPercent}
                        onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], taxPercent: e.target.value }; setItems(n); }}
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button" size="icon" variant="ghost"
                        disabled={items.length === 1}
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums text-emerald-600 dark:text-emerald-400">- {money(totals.discount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">+ {money(totals.tax)}</span></div>
              <div className="flex items-baseline justify-between border-t border-border pt-2.5 mt-2.5">
                <span className="font-medium">Grand total</span>
                <span className="text-lg font-semibold tabular-nums tracking-tight" data-testid="text-quote-total">{money(totals.grand)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Final figures are recalculated on the server when saved.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Terms</Label>
                <Textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={2} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-save-quotation">
              {createMutation.isPending ? "Saving..." : "Create Quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert confirmation */}
      <AlertDialog open={!!convertTarget} onOpenChange={(open) => !open && setConvertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to an invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              {convertTarget?.quotationNumber} for {convertTarget?.customerName} — {money(convertTarget?.grandTotal || 0)}.
              <br /><br />
              This is the point where the quotation becomes a real transaction: an invoice is raised for approval
              and stock is deducted. This cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => convertMutation.mutate({ id: convertTarget._id, body: {} })}
              data-testid="button-confirm-convert"
            >
              Convert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Price drift */}
      <AlertDialog open={!!priceConflict} onOpenChange={(open) => !open && setPriceConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prices have changed since this quote</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">Choose which price to bill at:</p>
                <div className="space-y-1 text-sm">
                  {(priceConflict?.changes || []).map((c: any, i: number) => (
                    <div key={i} className="flex justify-between border-b py-1">
                      <span>{c.name}</span>
                      <span>
                        quoted {money(c.quotedRate)} → now {money(c.currentRate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => convertMutation.mutate({ id: priceConflict.id, body: { keepQuotedPrices: true } })}
              data-testid="button-keep-quoted"
            >
              Honour quoted prices
            </Button>
            <AlertDialogAction
              onClick={() => convertMutation.mutate({ id: priceConflict.id, body: { useCurrentPrices: true } })}
              data-testid="button-use-current"
            >
              Use current prices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
