import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  PeriodFilter,
  periodToQuery,
  type PeriodValue,
} from "@/components/PeriodFilter";
import {
  EmptyState,
  PageHeader,
  StatTile,
  TableSkeleton,
} from "@/components/PageShell";
import { ClipboardList, Plus, Search, Trash2, X } from "lucide-react";

// Requirement 3: Phase I - Customer Inquiry.

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  quoted:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  converted:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  closed: "bg-muted text-muted-foreground",
};

const shortDate = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

interface ItemRow {
  productId?: string;
  name: string;
  quantity: string;
  expectedPrice: string;
  notes: string;
}

const blankItem: ItemRow = {
  productId: "",
  name: "",
  quantity: "1",
  expectedPrice: "",
  notes: "",
};

export default function Inquiries() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<PeriodValue>({ period: "month" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [form, setForm] = useState({
    customerId: "",
    vehicleId: "",
    customerName: "",
    customerMobile: "",
    vehicleNumber: "",
    vehicleBrand: "",
    vehicleModel: "",
    notes: "",
    labourCharge: "",
    reminderDays: "7",
    inquiryDate: new Date().toISOString().slice(0, 10),
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
    queryKey: ["/api/inquiries", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/inquiries?${queryString}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load inquiries");
      return res.json();
    },
  });

  const { data: customerData } = useQuery<any>({
    queryKey: ["/api/dashboard/customer-search", "inquiry", customerSearch],
    enabled: dialogOpen,
    queryFn: async () => {
      const params = new URLSearchParams({ period: "year", limit: "25" });
      if (customerSearch.trim()) params.set("search", customerSearch.trim());
      const res = await fetch(`/api/dashboard/customer-search?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load customers");
      return res.json();
    },
  });

  const { data: productOptions = [] } = useQuery<any[]>({
    queryKey: ["/api/inquiries/product-options"],
    enabled: dialogOpen,
    queryFn: async () => {
      const res = await fetch("/api/inquiries/product-options", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  const { data: customerVehicles = [] } = useQuery<any[]>({
    queryKey: ["/api/registration/customers", form.customerId, "vehicles"],
    enabled: dialogOpen && !!form.customerId,
    queryFn: async () => {
      const res = await fetch(
        `/api/registration/customers/${form.customerId}/vehicles`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load customer vehicles");
      return res.json();
    },
  });

  const selectedVehicle = customerVehicles.find(
    (item: any) => String(item.id || item._id) === form.vehicleId,
  );
  const vehiclePartOptions = useMemo(
    () =>
      (selectedVehicle?.selectedParts || []).map((part: any) => {
        const partId = String(part.partId || part);
        const product = productOptions.find(
          (option: any) =>
            String(option._id) === partId ||
            String(option._id) === `catalog-${partId}` ||
            `product-${String(option._id)}` === partId,
        );
        return {
          partId,
          productId: product?._id ? String(product._id) : `catalog-${partId}`,
          name: product?.productName || partId,
          brand: product?.brand || selectedVehicle?.vehicleBrand || "",
          model: product?.model || selectedVehicle?.vehicleModel || "",
          category: product?.category || "Vehicle part",
          stockQty: Number(product?.stockQty || 0),
          price: product?.sellingPrice,
          defaultQuantity: Number(part.quantity || 1),
        };
      }),
    [selectedVehicle, productOptions],
  );

  const availableInquiryParts = useMemo(() => {
    const savedKeys = new Set(
      vehiclePartOptions.flatMap((part: any) => [
        part.partId,
        part.productId,
        part.name,
      ]),
    );
    const catalogueParts = productOptions
      .map((product: any) => ({
        partId: String(product._id),
        productId: String(product._id),
        name: product.productName,
        brand: product.brand,
        model: product.model,
        category: product.category || "Vehicle part",
        stockQty: Number(product.stockQty || 0),
        price: product.sellingPrice,
        defaultQuantity: 1,
      }))
      .filter(
        (part: any) =>
          !savedKeys.has(part.productId) && !savedKeys.has(part.name),
      );

    return [...vehiclePartOptions, ...catalogueParts];
  }, [vehiclePartOptions, productOptions]);

  const addVehiclePartToInquiry = (part: any) => {
    const existingIndex = items.findIndex(
      (item) =>
        (part.productId && item.productId === part.productId) ||
        item.name === part.name,
    );
    if (existingIndex >= 0) {
      const next = [...items];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: String((Number(next[existingIndex].quantity) || 1) + 1),
      };
      setItems(next);
      return;
    }

    const next = items.length === 1 && !items[0].name.trim() ? [] : [...items];
    setItems([
      ...next,
      {
        productId: part.productId,
        name: part.name,
        quantity: String(part.defaultQuantity || 1),
        expectedPrice: part.price !== undefined ? String(part.price) : "",
        notes: "",
      },
    ]);
  };

  const resetForm = () => {
    setForm({
      customerId: "",
      customerName: "",
      customerMobile: "",
      vehicleNumber: "",
      vehicleId: "",
      vehicleBrand: "",
      vehicleModel: "",
      notes: "",
      reminderDays: "7",
      labourCharge: "",
      inquiryDate: new Date().toISOString().slice(0, 10),
    });
    setItems([{ ...blankItem }]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const cleanItems = items
        .filter((i) => i.name.trim())
        .map((i) => ({
          productId:
            i.productId && !i.productId.startsWith("catalog-")
              ? i.productId
              : undefined,
          name: i.name.trim(),
          quantity: Number(i.quantity) || 1,
          expectedPrice: Number(i.expectedPrice) || 0,
          notes: i.notes || undefined,
        }));

      if (!cleanItems.length) throw new Error("Add at least one inquiry item");
      if (!form.customerId && !form.customerName.trim())
        throw new Error("Select or name a customer");

      const res = await apiRequest("POST", "/api/inquiries", {
        ...form,
        customerId: form.customerId || undefined,
        customerName: form.customerName || "Walk-in",
        reminderDays: Number(form.reminderDays),
        labourCharge: Number(form.labourCharge) || 0,
        items: cleanItems,
      });
      return res.json();
    },
    onSuccess: (inquiry: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: "Inquiry recorded",
        description: `${inquiry.inquiryNumber} created`,
      });
    },
    onError: (error: any) =>
      toast({
        title: "Error",
        description: error.message || "Failed to record inquiry",
        variant: "destructive",
      }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/inquiries/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      toast({ title: "Updated", description: "Inquiry status changed" });
    },
    onError: (error: any) =>
      toast({
        title: "Error",
        description: error.message || "Failed to update",
        variant: "destructive",
      }),
  });

  const rows = data?.items || [];
  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="Customer Inquiries"
        description="What customers asked about, who handled it, and what came of it."
        actions={
          <Button
            onClick={() => setDialogOpen(true)}
            data-testid="button-new-inquiry"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Inquiry
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { key: "open", tone: "accent" as const },
          { key: "quoted", tone: "neutral" as const },
          { key: "converted", tone: "positive" as const },
          { key: "lost", tone: "danger" as const },
          { key: "closed", tone: "neutral" as const },
        ].map((s) => (
          <StatTile
            key={s.key}
            label={s.key}
            value={summary[s.key] || 0}
            tone={s.tone}
            testId={`text-count-${s.key}`}
            onClick={() =>
              setStatusFilter(statusFilter === s.key ? "all" : s.key)
            }
            className={
              statusFilter === s.key
                ? "border-primary/50 ring-1 ring-primary/20"
                : undefined
            }
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
                <SelectTrigger data-testid="select-inquiry-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {["open", "quoted", "converted", "lost", "closed"].map(
                    (s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[240px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Customer, vehicle, item, salesman..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-inquiries"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No inquiries found"
              description="Nothing matches this period and filter. Record an inquiry to start tracking what customers ask for."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" /> New Inquiry
                </Button>
              }
            />
          ) : (
            <div className="table-scroll rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inquiry #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Items inquired</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Salesman</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((inq: any) => (
                    <TableRow
                      key={inq._id}
                      data-testid={`row-inquiry-${inq._id}`}
                    >
                      <TableCell className="font-mono text-xs">
                        {inq.inquiryNumber}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{inq.customerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {inq.customerMobile}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {inq.vehicleNumber || "-"}
                        {inq.vehicleBrand && (
                          <div className="text-xs text-muted-foreground">
                            {inq.vehicleBrand} {inq.vehicleModel}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(inq.items || []).map((i: any, idx: number) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs"
                            >
                              {i.name}
                              {i.quantity > 1 ? ` ×${i.quantity}` : ""}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {shortDate(inq.inquiryDate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {inq.salesmanName || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={STATUS_STYLES[inq.status]}
                          variant="secondary"
                        >
                          {inq.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!["converted"].includes(inq.status) && (
                          <Select
                            onValueChange={(status) =>
                              statusMutation.mutate({ id: inq._id, status })
                            }
                          >
                            <SelectTrigger
                              className="w-[120px] h-8"
                              data-testid={`select-inq-status-${inq._id}`}
                            >
                              <SelectValue placeholder="Change" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="quoted">Quoted</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl dialog-scroll">
          <DialogHeader>
            <DialogTitle>Record Customer Inquiry</DialogTitle>
            <DialogDescription>
              Capture what the customer asked about so it can be followed up and
              searched later.
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
                data-testid="input-inq-customer-search"
              />
              <Select
                value={form.customerId}
                onValueChange={(customerId) => {
                  const c = (customerData?.items || []).find(
                    (x: any) => x._id === customerId,
                  );
                  setForm({
                    ...form,
                    customerId,
                    vehicleId: "",
                    customerName: c?.fullName || form.customerName,
                    customerMobile: c?.mobileNumber || form.customerMobile,
                  });
                }}
              >
                <SelectTrigger data-testid="select-inq-customer">
                  <SelectValue placeholder="Select a registered customer, or leave blank for a walk-in" />
                </SelectTrigger>
                <SelectContent>
                  {(customerData?.items || []).map((c: any) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.fullName} — {c.mobileNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Customer vehicle</Label>
              <Select
                value={form.vehicleId}
                onValueChange={(vehicleId) => {
                  const vehicle = customerVehicles.find(
                    (item: any) => String(item.id || item._id) === vehicleId,
                  );
                  setForm({
                    ...form,
                    vehicleId,
                    vehicleNumber:
                      vehicle?.vehicleNumber || vehicle?.vehicleId || "",
                    vehicleBrand: vehicle?.vehicleBrand || "",
                    vehicleModel:
                      vehicle?.vehicleModel || vehicle?.customModel || "",
                  });
                  setItems([{ ...blankItem }]);
                }}
                disabled={!form.customerId || customerVehicles.length === 0}
              >
                <SelectTrigger data-testid="select-inq-vehicle">
                  <SelectValue
                    placeholder={
                      form.customerId
                        ? "Select the customer's vehicle"
                        : "Select a registered customer first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {customerVehicles.map((vehicle: any) => (
                    <SelectItem
                      key={vehicle.id || vehicle._id}
                      value={String(vehicle.id || vehicle._id)}
                    >
                      {vehicle.vehicleNumber || vehicle.vehicleId} •{" "}
                      {vehicle.vehicleBrand}{" "}
                      {vehicle.vehicleModel || vehicle.customModel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.vehicleId && items.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Select Add on a saved part to include it in this inquiry.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Customer name *</Label>
                <Input
                  value={form.customerName}
                  onChange={(e) =>
                    setForm({ ...form, customerName: e.target.value })
                  }
                  data-testid="input-inq-customer-name"
                />
              </div>
              <div>
                <Label>Mobile</Label>
                <Input
                  value={form.customerMobile}
                  onChange={(e) =>
                    setForm({ ...form, customerMobile: e.target.value })
                  }
                  data-testid="input-inq-mobile"
                />
              </div>
              <div>
                <Label>Vehicle number</Label>
                <Input
                  value={form.vehicleNumber}
                  onChange={(e) =>
                    setForm({ ...form, vehicleNumber: e.target.value })
                  }
                  data-testid="input-inq-vehicle"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Brand</Label>
                  <Input
                    value={form.vehicleBrand}
                    onChange={(e) =>
                      setForm({ ...form, vehicleBrand: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input
                    value={form.vehicleModel}
                    onChange={(e) =>
                      setForm({ ...form, vehicleModel: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Inquiry date</Label>
                <Input
                  type="date"
                  value={form.inquiryDate}
                  onChange={(e) =>
                    setForm({ ...form, inquiryDate: e.target.value })
                  }
                  data-testid="input-inq-date"
                />
              </div>
              <div>
                <Label>Follow-up reminder (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.reminderDays}
                  onChange={(e) =>
                    setForm({ ...form, reminderDays: e.target.value })
                  }
                  data-testid="input-inq-reminder"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items inquired about *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setItems([...items, { ...blankItem }])}
                  data-testid="button-add-inq-item"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add item
                </Button>
              </div>
              <div className="grid grid-cols-12 gap-2 px-3 mb-1 text-xs font-medium text-muted-foreground">
                <span className="col-span-5">Item</span>
                <span className="col-span-2">Qty</span>
                <span className="col-span-4">Rate</span>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-md border p-3 space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <Select
                        value={item.productId || "custom"}
                        onValueChange={(productId) => {
                          const next = [...items];
                          if (productId === "custom") {
                            next[idx] = {
                              ...next[idx],
                              productId: "",
                              name: "",
                              expectedPrice: "",
                            };
                          } else {
                            const product = availableInquiryParts.find(
                              (p: any) => String(p.productId) === productId,
                            );
                            next[idx] = {
                              ...next[idx],
                              productId,
                              name: product?.name || "",
                              expectedPrice:
                                product?.price !== undefined
                                  ? String(product.price)
                                  : next[idx].expectedPrice,
                            };
                          }
                          setItems(next);
                        }}
                      >
                        <SelectTrigger
                          className="col-span-5"
                          data-testid={`select-inq-item-${idx}`}
                        >
                          <SelectValue placeholder="Select product or custom item" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom item</SelectItem>
                          {availableInquiryParts.map((product: any) => (
                            <SelectItem
                              key={product.partId}
                              value={String(product.productId)}
                            >
                              {product.name}
                              {product.brand || product.model
                                ? ` • ${[product.brand, product.model].filter(Boolean).join(" ")}`
                                : ""}
                              {product.price !== undefined
                                ? ` — ₹${Number(product.price).toLocaleString("en-IN")}`
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="col-span-2"
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = {
                            ...next[idx],
                            quantity: e.target.value,
                          };
                          setItems(next);
                        }}
                      />
                      <Input
                        className="col-span-3"
                        type="number"
                        min="0"
                        placeholder="Rate"
                        value={item.expectedPrice}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = {
                            ...next[idx],
                            expectedPrice: e.target.value,
                          };
                          setItems(next);
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="col-span-1"
                        disabled={items.length === 1}
                        onClick={() =>
                          setItems(items.filter((_, i) => i !== idx))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {!item.productId && (
                      <Input
                        placeholder="Custom item name"
                        value={item.name}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setItems(next);
                        }}
                        data-testid={`input-inq-item-${idx}`}
                      />
                    )}
                    {item.productId &&
                      (() => {
                        const product = availableInquiryParts.find(
                          (p: any) => String(p.productId) === item.productId,
                        );
                        if (!product) return null;
                        const lineTotal =
                          (Number(item.expectedPrice) || 0) *
                          (Number(item.quantity) || 1);
                        return (
                          <div className="text-xs text-muted-foreground">
                            {product.category} • {product.brand || "Catalog"}{" "}
                            {product.model || ""} • Stock:{" "}
                            {Number(product.stockQty || 0)}
                            {product.price !== undefined &&
                              ` • Unit price: ₹${Number(product.price).toLocaleString("en-IN")}`}
                            {` • Line total: ₹${lineTotal.toLocaleString("en-IN")}`}
                          </div>
                        );
                      })()}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <Label>Custom Labour Charge</Label>
              <Input
                className="mt-2"
                type="number"
                min="0"
                placeholder="Enter labour charge"
                value={form.labourCharge}
                onChange={(e) =>
                  setForm({ ...form, labourCharge: e.target.value })
                }
                data-testid="input-inq-labour-charge"
              />
              <div className="mt-2 text-sm text-muted-foreground">
                Items total: ₹
                {items
                  .reduce(
                    (sum, item) =>
                      sum +
                      (Number(item.expectedPrice) || 0) *
                        (Number(item.quantity) || 1),
                    0,
                  )
                  .toLocaleString("en-IN")}
                {` • Labour: ₹${(Number(form.labourCharge) || 0).toLocaleString("en-IN")}`}
                {` • Estimated total: ₹${(items.reduce((sum, item) => sum + (Number(item.expectedPrice) || 0) * (Number(item.quantity) || 1), 0) + (Number(form.labourCharge) || 0)).toLocaleString("en-IN")}`}
              </div>
            </div>

            <div>
              <Label>Notes / status</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Anything relevant to the follow-up"
                data-testid="input-inq-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              data-testid="button-save-inquiry"
            >
              {createMutation.isPending ? "Saving..." : "Save Inquiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
