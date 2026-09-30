import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PeriodFilter, periodToQuery, type PeriodValue } from "@/components/PeriodFilter";
import { EmptyState, PageHeader, StatTile, TableSkeleton } from "@/components/PageShell";
import { BellRing, IndianRupee, Plus, Search, Wallet } from "lucide-react";

// Requirement 2: Advance Payment Received.

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  adjusted: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  refunded: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  cancelled: "bg-muted text-muted-foreground",
};

const money = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const emptyForm = {
  customerId: "",
  itemOrService: "",
  relatedWork: "",
  amount: "",
  paymentMode: "Cash",
  transactionId: "",
  receivedDate: new Date().toISOString().slice(0, 10),
  reminderDays: "15",
  reminderEnabled: true,
  notes: "",
};

export default function AdvancePayments() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<PeriodValue>({ period: "month" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [customerSearch, setCustomerSearch] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams(periodToQuery(period));
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("limit", "100");
    return params.toString();
  }, [period, search, statusFilter]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/advance-payments", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/advance-payments?${queryString}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load advance payments");
      return res.json();
    },
  });

  const { data: customerData } = useQuery<any>({
    queryKey: ["/api/dashboard/customer-search", customerSearch],
    enabled: dialogOpen,
    queryFn: async () => {
      const params = new URLSearchParams({ period: "year", limit: "25" });
      if (customerSearch.trim()) params.set("search", customerSearch.trim());
      const res = await fetch(`/api/dashboard/customer-search?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load customers");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.customerId) throw new Error("Select a customer");
      if (!form.itemOrService.trim()) throw new Error("Item or service is required");
      if (!Number(form.amount)) throw new Error("Enter an advance amount");

      const res = await apiRequest("POST", "/api/advance-payments", {
        ...form,
        amount: Number(form.amount),
        reminderDays: Number(form.reminderDays),
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/advance-payments"] });
      setDialogOpen(false);
      setForm(emptyForm);
      const wa = result?.whatsappUpdate;
      toast({
        title: "Advance recorded",
        description: wa?.sent
          ? "Customer has been notified on WhatsApp."
          : "Saved. WhatsApp confirmation was not sent (no approved template configured).",
      });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to record advance", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/advance-payments/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advance-payments"] });
      toast({ title: "Updated", description: "Advance payment updated" });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" }),
  });

  const items = data?.items || [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Advance Payment Received"
        description="Advances taken against pending work, with follow-up reminders."
        actions={
          <Button onClick={() => setDialogOpen(true)} data-testid="button-new-advance">
            <Plus className="h-4 w-4 mr-2" />
            Record Advance
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Total in period"
          value={money(summary?.totalAmount || 0)}
          icon={IndianRupee}
          tone="accent"
          testId="text-total-advances"
        />
        <StatTile
          label="Pending adjustment"
          value={money(summary?.pendingAmount || 0)}
          sub="not yet applied to a bill"
          icon={BellRing}
          tone="warning"
          testId="text-pending-advances"
        />
        <StatTile label="Entries" value={summary?.totalCount || 0} icon={Wallet} />
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <PeriodFilter value={period} onChange={setPeriod} />
            <div className="min-w-[150px]">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-advance-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="adjusted">Adjusted</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Customer, vehicle, work..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-advances"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No advance payments in this period"
              description="Advances you record against pending work will appear here."
              action={
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Record Advance
                </Button>
              }
            />
          ) : (
            <div className="table-scroll rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Item / Service</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Reminder</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a: any) => {
                    const overdue = a.status === "pending" && a.reminderDate && new Date(a.reminderDate) <= new Date();
                    return (
                      <TableRow key={a._id} data-testid={`row-advance-${a._id}`}>
                        <TableCell>
                          <div className="font-medium">{a.customerName}</div>
                          <div className="text-xs text-muted-foreground">{a.customerMobile}</div>
                        </TableCell>
                        <TableCell>
                          <div>{a.itemOrService}</div>
                          {a.relatedWork && <div className="text-xs text-muted-foreground">{a.relatedWork}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{a.vehicleNumber || "-"}</TableCell>
                        <TableCell className="text-right font-semibold">{money(a.amount)}</TableCell>
                        <TableCell className="text-sm">{a.paymentMode}</TableCell>
                        <TableCell className="text-sm">{shortDate(a.receivedDate)}</TableCell>
                        <TableCell className="text-sm">
                          <span className={overdue ? "text-red-600 font-medium inline-flex items-center gap-1" : ""}>
                            {overdue && <BellRing className="h-3.5 w-3.5" />}
                            {shortDate(a.reminderDate)}
                          </span>
                          <div className="text-xs text-muted-foreground">{a.reminderDays} days</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_STYLES[a.status]} variant="secondary">{a.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {a.status === "pending" && (
                            <Select onValueChange={(status) => statusMutation.mutate({ id: a._id, status })}>
                              <SelectTrigger className="w-[130px] h-8" data-testid={`select-status-${a._id}`}>
                                <SelectValue placeholder="Change" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="adjusted">Mark adjusted</SelectItem>
                                <SelectItem value="refunded">Mark refunded</SelectItem>
                                <SelectItem value="cancelled">Cancel</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl dialog-scroll">
          <DialogHeader>
            <DialogTitle>Record Advance Payment</DialogTitle>
            <DialogDescription>
              Link the advance to a customer and the work it is against. The reminder defaults to 15 days and can be changed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Customer *</Label>
              <Input
                placeholder="Search customer by name or mobile..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="mb-2"
                data-testid="input-customer-search"
              />
              <Select value={form.customerId} onValueChange={(customerId) => setForm({ ...form, customerId })}>
                <SelectTrigger data-testid="select-advance-customer">
                  <SelectValue placeholder="Select customer" />
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Item / Service *</Label>
                <Input
                  value={form.itemOrService}
                  onChange={(e) => setForm({ ...form, itemOrService: e.target.value })}
                  placeholder="e.g. Ceramic coating"
                  data-testid="input-item-service"
                />
              </div>
              <div>
                <Label>Related work / order</Label>
                <Input
                  value={form.relatedWork}
                  onChange={(e) => setForm({ ...form, relatedWork: e.target.value })}
                  placeholder="e.g. Job for MH12AB1234"
                  data-testid="input-related-work"
                />
              </div>
              <div>
                <Label>Advance amount *</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    type="number"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    data-testid="input-advance-amount"
                  />
                </div>
              </div>
              <div>
                <Label>Payment mode</Label>
                <Select value={form.paymentMode} onValueChange={(paymentMode) => setForm({ ...form, paymentMode })}>
                  <SelectTrigger data-testid="select-payment-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Cash", "UPI", "Card", "Net Banking", "Cheque"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date received</Label>
                <Input
                  type="date"
                  value={form.receivedDate}
                  onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
                  data-testid="input-received-date"
                />
              </div>
              <div>
                <Label>Reminder after (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.reminderDays}
                  onChange={(e) => setForm({ ...form, reminderDays: e.target.value })}
                  data-testid="input-reminder-days"
                />
                <p className="text-xs text-muted-foreground mt-1">Default 15 days. Editable per advance.</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Reminder enabled</Label>
                <p className="text-xs text-muted-foreground">Raise a follow-up if the work is still pending.</p>
              </div>
              <Switch
                checked={form.reminderEnabled}
                onCheckedChange={(reminderEnabled) => setForm({ ...form, reminderEnabled })}
                data-testid="switch-reminder-enabled"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                data-testid="input-advance-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              data-testid="button-save-advance"
            >
              {createMutation.isPending ? "Saving..." : "Record Advance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
