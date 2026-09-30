import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BellRing, PackageCheck, Plus, Search, Send, ShieldCheck } from "lucide-react";
import { EmptyState, PageHeader, StatTile, TableSkeleton } from "@/components/PageShell";

// Requirement 5: Warranty Management.
// Two tabs over one record: what we hold for the customer, and what is out
// with a vendor. A claim is followed from intake to return.

const STATUS_STYLES: Record<string, string> = {
  received: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  with_vendor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  returned_from_vendor: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  delivered_to_customer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  cancelled: "bg-muted text-muted-foreground",
};

const NEXT_STATUS: Record<string, string[]> = {
  received: ["resolved", "cancelled"],
  with_vendor: ["returned_from_vendor", "resolved", "cancelled"],
  returned_from_vendor: ["resolved", "cancelled"],
  resolved: ["delivered_to_customer", "cancelled"],
  delivered_to_customer: [],
  cancelled: [],
};

const label = (s: string) => s.replace(/_/g, " ");
const shortDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const emptyIntake = {
  customerId: "",
  customerName: "",
  customerMobile: "",
  vehicleNumber: "",
  itemName: "",
  quantity: "1",
  problem: "",
  receivedDate: new Date().toISOString().slice(0, 10),
  reminderDays: "15",
  notes: "",
};

const emptyDispatch = {
  vendorName: "",
  vendorContact: "",
  itemName: "",
  quantity: "1",
  problem: "",
  narration: "",
  givenDate: new Date().toISOString().slice(0, 10),
  expectedReturnDate: "",
  reminderDays: "15",
};

export default function WarrantyClaims() {
  const { toast } = useToast();
  const [tab, setTab] = useState("customer");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [dispatchFor, setDispatchFor] = useState<any>(null);
  const [intake, setIntake] = useState(emptyIntake);
  const [dispatch, setDispatch] = useState(emptyDispatch);
  const [customerSearch, setCustomerSearch] = useState("");

  const claimsQuery = useMemo(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    return params.toString();
  }, [search, statusFilter]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/warranty-claims", claimsQuery],
    queryFn: async () => {
      const res = await fetch(`/api/warranty-claims?${claimsQuery}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load warranty claims");
      return res.json();
    },
  });

  const { data: vendorData, isLoading: vendorLoading } = useQuery<any>({
    queryKey: ["/api/warranty-claims/vendor-items", tab],
    enabled: tab === "vendor",
    queryFn: async () => {
      const res = await fetch("/api/warranty-claims/vendor-items", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load vendor items");
      return res.json();
    },
  });

  const { data: customerData } = useQuery<any>({
    queryKey: ["/api/dashboard/customer-search", "warranty", customerSearch],
    enabled: intakeOpen,
    queryFn: async () => {
      const params = new URLSearchParams({ period: "year", limit: "25" });
      if (customerSearch.trim()) params.set("search", customerSearch.trim());
      const res = await fetch(`/api/dashboard/customer-search?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load customers");
      return res.json();
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/warranty-claims"] });
    queryClient.invalidateQueries({ queryKey: ["/api/warranty-claims/vendor-items"] });
  };

  const intakeMutation = useMutation({
    mutationFn: async () => {
      if (!intake.customerId && !intake.customerName.trim()) throw new Error("Select or name a customer");
      if (!intake.itemName.trim()) throw new Error("Item name is required");
      if (!intake.problem.trim()) throw new Error("Describe the problem");

      const res = await apiRequest("POST", "/api/warranty-claims", {
        ...intake,
        customerId: intake.customerId || undefined,
        customerName: intake.customerName || "Walk-in",
        quantity: Number(intake.quantity),
        reminderDays: Number(intake.reminderDays),
      });
      return res.json();
    },
    onSuccess: (claim: any) => {
      refresh();
      setIntakeOpen(false);
      setIntake(emptyIntake);
      toast({ title: "Item received", description: `Claim ${claim.claimNumber} created` });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to receive item", variant: "destructive" }),
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!dispatch.vendorName.trim()) throw new Error("Vendor name is required");
      if (!dispatch.itemName.trim()) throw new Error("Item name is required");

      const res = await apiRequest("POST", `/api/warranty-claims/${dispatchFor._id}/vendor-dispatch`, {
        ...dispatch,
        expectedReturnDate: dispatch.expectedReturnDate || undefined,
        quantity: Number(dispatch.quantity),
        reminderDays: Number(dispatch.reminderDays),
      });
      return res.json();
    },
    onSuccess: () => {
      refresh();
      setDispatchFor(null);
      setDispatch(emptyDispatch);
      toast({ title: "Sent to vendor", description: "The item is now tracked as with the vendor" });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to record dispatch", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/warranty-claims/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Updated", description: "Claim status changed" });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" }),
  });

  const returnMutation = useMutation({
    mutationFn: async ({ claimId, dispatchId, status, resolution }: any) => {
      const res = await apiRequest("PATCH", `/api/warranty-claims/${claimId}/vendor-dispatch/${dispatchId}`, {
        status,
        resolution,
      });
      return res.json();
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Updated", description: "Vendor item updated" });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" }),
  });

  const claims = data?.items || [];
  const summary = data?.summary || {};
  const vendorItems = vendorData?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Warranty Management"
        description="Items taken in from customers and sent out to vendors, tracked until they are returned."
        actions={
          <Button onClick={() => setIntakeOpen(true)} data-testid="button-receive-item">
            <Plus className="h-4 w-4 mr-2" />
            Receive Item
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          { key: "received", title: "With us", tone: "accent" as const, icon: PackageCheck },
          { key: "with_vendor", title: "With vendor", tone: "warning" as const, icon: Send },
          { key: "resolved", title: "Resolved", tone: "positive" as const, icon: ShieldCheck },
          { key: "delivered_to_customer", title: "Delivered", tone: "neutral" as const, icon: PackageCheck },
        ]).map((s) => (
          <StatTile
            key={s.key}
            label={s.title}
            value={summary[s.key] || 0}
            icon={s.icon}
            tone={s.tone}
            testId={`text-wc-${s.key}`}
          />
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="customer" data-testid="tab-customer-warranty">Customer Warranty</TabsTrigger>
          <TabsTrigger value="vendor" data-testid="tab-vendor-warranty">Vendor Warranty</TabsTrigger>
        </TabsList>

        <TabsContent value="customer" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px]">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid="select-wc-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {Object.keys(STATUS_STYLES).map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{label(s)}</SelectItem>
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
                      placeholder="Claim, customer, item, vendor..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      data-testid="input-search-claims"
                    />
                  </div>
                </div>
              </div>

              {isLoading ? (
                <TableSkeleton />
              ) : claims.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="No warranty items received"
                  description="Items you take in from customers will be tracked here until they go back."
                  action={
                    <Button variant="outline" size="sm" onClick={() => setIntakeOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Receive Item
                    </Button>
                  }
                />
              ) : (
                <div className="table-scroll rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Claim #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Problem</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Reminder</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {claims.map((c: any) => {
                        const overdue =
                          !["delivered_to_customer", "cancelled"].includes(c.status) &&
                          c.reminderDate && new Date(c.reminderDate) <= new Date();
                        return (
                          <TableRow key={c._id} data-testid={`row-claim-${c._id}`}>
                            <TableCell className="font-mono text-xs">{c.claimNumber}</TableCell>
                            <TableCell>
                              <div className="font-medium">{c.customerName}</div>
                              <div className="text-xs text-muted-foreground">{c.vehicleNumber || c.customerMobile}</div>
                            </TableCell>
                            <TableCell>{c.itemName}</TableCell>
                            <TableCell>{c.quantity}</TableCell>
                            <TableCell className="max-w-[220px] truncate text-sm" title={c.problem}>{c.problem}</TableCell>
                            <TableCell className="text-sm">{shortDate(c.receivedDate)}</TableCell>
                            <TableCell className="text-sm">
                              <span className={overdue ? "text-red-600 font-medium inline-flex items-center gap-1" : ""}>
                                {overdue && <BellRing className="h-3.5 w-3.5" />}
                                {shortDate(c.reminderDate)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_STYLES[c.status]} variant="secondary">{label(c.status)}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {!["delivered_to_customer", "cancelled"].includes(c.status) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setDispatchFor(c);
                                      setDispatch({ ...emptyDispatch, itemName: c.itemName, quantity: String(c.quantity), problem: c.problem });
                                    }}
                                    data-testid={`button-send-vendor-${c._id}`}
                                  >
                                    <Send className="h-3.5 w-3.5 mr-1" /> Vendor
                                  </Button>
                                )}
                                {NEXT_STATUS[c.status]?.length > 0 && (
                                  <Select onValueChange={(status) => statusMutation.mutate({ id: c._id, status })}>
                                    <SelectTrigger className="w-[120px] h-8"><SelectValue placeholder="Status" /></SelectTrigger>
                                    <SelectContent>
                                      {NEXT_STATUS[c.status].map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">{label(s)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
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
        </TabsContent>

        <TabsContent value="vendor" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {vendorLoading ? (
                <TableSkeleton />
              ) : vendorItems.length === 0 ? (
                <EmptyState
                  icon={Send}
                  title="Nothing is with a vendor"
                  description="When you send a warranty item out for repair it appears here until it comes back."
                />
              ) : (
                <div className="table-scroll rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Claim #</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Given</TableHead>
                        <TableHead>Problem / Narration</TableHead>
                        <TableHead>Returned</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendorItems.map((row: any) => (
                        <TableRow key={row.dispatch._id} data-testid={`row-vendor-${row.dispatch._id}`}>
                          <TableCell className="font-mono text-xs">{row.claimNumber}</TableCell>
                          <TableCell>
                            <div className="font-medium">{row.dispatch.vendorName}</div>
                            <div className="text-xs text-muted-foreground">{row.dispatch.vendorContact || ""}</div>
                          </TableCell>
                          <TableCell>{row.dispatch.itemName}</TableCell>
                          <TableCell>{row.dispatch.quantity}</TableCell>
                          <TableCell className="text-sm">{shortDate(row.dispatch.givenDate)}</TableCell>
                          <TableCell className="max-w-[260px] text-sm">
                            <div className="truncate" title={row.dispatch.problem}>{row.dispatch.problem}</div>
                            {row.dispatch.narration && (
                              <div className="text-xs text-muted-foreground truncate" title={row.dispatch.narration}>
                                {row.dispatch.narration}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{shortDate(row.dispatch.returnedDate)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={row.dispatch.status === "with_vendor" ? STATUS_STYLES.with_vendor : STATUS_STYLES.resolved}>
                              {label(row.dispatch.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {row.dispatch.status === "with_vendor" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  returnMutation.mutate({
                                    claimId: row.claimId,
                                    dispatchId: row.dispatch._id,
                                    status: "returned",
                                    resolution: "Received back from vendor",
                                  })
                                }
                                data-testid={`button-mark-returned-${row.dispatch._id}`}
                              >
                                <PackageCheck className="h-3.5 w-3.5 mr-1" /> Received
                              </Button>
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
        </TabsContent>
      </Tabs>

      {/* Receive from customer */}
      <Dialog open={intakeOpen} onOpenChange={setIntakeOpen}>
        <DialogContent className="max-w-2xl dialog-scroll">
          <DialogHeader>
            <DialogTitle>Receive Warranty Item from Customer</DialogTitle>
            <DialogDescription>Record the item, the problem and when to follow up.</DialogDescription>
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
                value={intake.customerId}
                onValueChange={(customerId) => {
                  const c = (customerData?.items || []).find((x: any) => x._id === customerId);
                  setIntake({
                    ...intake,
                    customerId,
                    customerName: c?.fullName || intake.customerName,
                    customerMobile: c?.mobileNumber || intake.customerMobile,
                  });
                }}
              >
                <SelectTrigger data-testid="select-wc-customer">
                  <SelectValue placeholder="Select customer, or leave blank for a walk-in" />
                </SelectTrigger>
                <SelectContent>
                  {(customerData?.items || []).map((c: any) => (
                    <SelectItem key={c._id} value={c._id}>{c.fullName} — {c.mobileNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Customer name *</Label>
                <Input value={intake.customerName} onChange={(e) => setIntake({ ...intake, customerName: e.target.value })} data-testid="input-wc-name" />
              </div>
              <div>
                <Label>Vehicle number</Label>
                <Input value={intake.vehicleNumber} onChange={(e) => setIntake({ ...intake, vehicleNumber: e.target.value })} />
              </div>
              <div>
                <Label>Problem item name *</Label>
                <Input value={intake.itemName} onChange={(e) => setIntake({ ...intake, itemName: e.target.value })} data-testid="input-wc-item" />
              </div>
              <div>
                <Label>Quantity *</Label>
                <Input type="number" min="1" value={intake.quantity} onChange={(e) => setIntake({ ...intake, quantity: e.target.value })} data-testid="input-wc-qty" />
              </div>
              <div>
                <Label>Received date *</Label>
                <Input type="date" value={intake.receivedDate} onChange={(e) => setIntake({ ...intake, receivedDate: e.target.value })} data-testid="input-wc-received" />
              </div>
              <div>
                <Label>Reminder after (days)</Label>
                <Input type="number" min="0" value={intake.reminderDays} onChange={(e) => setIntake({ ...intake, reminderDays: e.target.value })} data-testid="input-wc-reminder" />
              </div>
            </div>

            <div>
              <Label>Problem description *</Label>
              <Textarea value={intake.problem} onChange={(e) => setIntake({ ...intake, problem: e.target.value })} rows={2} data-testid="input-wc-problem" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={intake.notes} onChange={(e) => setIntake({ ...intake, notes: e.target.value })} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIntakeOpen(false)}>Cancel</Button>
            <Button onClick={() => intakeMutation.mutate()} disabled={intakeMutation.isPending} data-testid="button-save-claim">
              {intakeMutation.isPending ? "Saving..." : "Receive Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to vendor */}
      <Dialog open={!!dispatchFor} onOpenChange={(open) => !open && setDispatchFor(null)}>
        <DialogContent className="max-w-2xl dialog-scroll">
          <DialogHeader>
            <DialogTitle>Give Item to Vendor</DialogTitle>
            <DialogDescription>
              {dispatchFor?.claimNumber} — {dispatchFor?.customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Vendor name *</Label>
                <Input value={dispatch.vendorName} onChange={(e) => setDispatch({ ...dispatch, vendorName: e.target.value })} data-testid="input-vendor-name" />
              </div>
              <div>
                <Label>Vendor contact</Label>
                <Input value={dispatch.vendorContact} onChange={(e) => setDispatch({ ...dispatch, vendorContact: e.target.value })} />
              </div>
              <div>
                <Label>Item name *</Label>
                <Input value={dispatch.itemName} onChange={(e) => setDispatch({ ...dispatch, itemName: e.target.value })} data-testid="input-vendor-item" />
              </div>
              <div>
                <Label>Quantity *</Label>
                <Input type="number" min="1" value={dispatch.quantity} onChange={(e) => setDispatch({ ...dispatch, quantity: e.target.value })} />
              </div>
              <div>
                <Label>Date given *</Label>
                <Input type="date" value={dispatch.givenDate} onChange={(e) => setDispatch({ ...dispatch, givenDate: e.target.value })} data-testid="input-vendor-date" />
              </div>
              <div>
                <Label>Expected return</Label>
                <Input type="date" value={dispatch.expectedReturnDate} onChange={(e) => setDispatch({ ...dispatch, expectedReturnDate: e.target.value })} />
              </div>
              <div>
                <Label>Reminder after (days)</Label>
                <Input type="number" min="0" value={dispatch.reminderDays} onChange={(e) => setDispatch({ ...dispatch, reminderDays: e.target.value })} data-testid="input-vendor-reminder" />
              </div>
            </div>

            <div>
              <Label>Problem</Label>
              <Textarea value={dispatch.problem} onChange={(e) => setDispatch({ ...dispatch, problem: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Narration</Label>
              <Textarea
                value={dispatch.narration}
                onChange={(e) => setDispatch({ ...dispatch, narration: e.target.value })}
                rows={2}
                placeholder="Warranty terms, what was agreed with the vendor..."
                data-testid="input-vendor-narration"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchFor(null)}>Cancel</Button>
            <Button onClick={() => dispatchMutation.mutate()} disabled={dispatchMutation.isPending} data-testid="button-save-dispatch">
              {dispatchMutation.isPending ? "Saving..." : "Send to Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
