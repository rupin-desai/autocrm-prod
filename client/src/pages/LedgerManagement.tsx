import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, EmptyState, TableSkeleton } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const blank = {
  groupId: "",
  code: "",
  name: "",
  ledgerType: "general",
  description: "",
  openingBalancePaise: 0,
  openingBalanceType: "none",
  customerId: "",
  supplierId: "",
  bankName: "",
  accountNumberLast4: "",
  status: "active",
};
function toPaise(value: string) {
  const normalized = value.trim();
  if (!/^\d*(\.\d{0,2})?$/.test(normalized)) return 0;
  const [whole = "0", fraction = ""] = normalized.split(".");
  return Number(`${whole || "0"}${fraction.padEnd(2, "0")}`);
}
function fromPaise(value: number) {
  return ((Number(value) || 0) / 100).toFixed(2);
}

export default function LedgerManagement() {
  const { toast } = useToast();
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const { data: context } = useQuery<any>({
    queryKey: ["/api/accounting/context"],
  });
  const companyId = context?.company?._id;
  const financialYearId = context?.financialYear?._id;
  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ["/api/accounting/account-groups", companyId],
    queryFn: async () =>
      companyId
        ? (
            await fetch(
              `/api/accounting/account-groups?companyId=${companyId}`,
              { credentials: "include" },
            )
          ).json()
        : [],
    enabled: Boolean(companyId),
  });
  const queryString = useMemo(
    () =>
      new URLSearchParams({
        companyId: companyId || "",
        page: String(page),
        limit: "10",
        ...(search ? { search } : {}),
        ...(type !== "all" ? { ledgerType: type } : {}),
      }).toString(),
    [companyId, page, search, type],
  );
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["/api/accounting/ledgers", queryString],
    queryFn: async () =>
      (
        await fetch(`/api/accounting/ledgers?${queryString}`, {
          credentials: "include",
        })
      ).json(),
    enabled: Boolean(companyId),
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        companyId,
        financialYearId,
        openingBalancePaise: Number(form.openingBalancePaise) || 0,
        customerId: form.customerId || null,
        supplierId: form.supplierId || null,
      };
      return (
        await apiRequest(
          editingId ? "PATCH" : "POST",
          editingId
            ? `/api/accounting/ledgers/${editingId}`
            : "/api/accounting/ledgers",
          editingId ? { ...payload, financialYearId } : payload,
        )
      ).json();
    },
    onSuccess: () => {
      setForm(blank);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/ledgers"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/opening-balances"],
      });
      toast({ title: editingId ? "Ledger updated" : "Ledger created" });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to save ledger",
        description: error.message,
        variant: "destructive",
      }),
  });
  const edit = (ledger: any) => {
    setEditingId(ledger._id);
    setForm({
      ...blank,
      ...ledger,
      groupId: ledger.groupId?._id || ledger.groupId,
      openingBalancePaise: ledger.openingBalancePaise || 0,
      customerId: ledger.customerId || "",
      supplierId: ledger.supplierId || "",
    });
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Ledger management"
        description="Create and maintain postable ledger accounts."
        icon={BookOpen}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,450px)]">
        <Card>
          <CardHeader>
            <CardTitle>Ledgers</CardTitle>
            <div className="flex flex-wrap gap-2 pt-2">
              <Input
                className="max-w-xs"
                placeholder="Search code or name"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <Select
                value={type}
                onValueChange={(value) => {
                  setType(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={6} />
            ) : isError ? (
              <EmptyState
                title="Unable to load ledgers"
                action={<Button onClick={() => refetch()}>Try again</Button>}
              />
            ) : !data?.items?.length ? (
              <EmptyState
                icon={BookOpen}
                title="No ledgers found"
                description="Create a ledger after initializing account groups."
              />
            ) : (
              <div className="space-y-2">
                {data.items.map((ledger: any) => (
                  <div
                    key={ledger._id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {ledger.code}
                        </span>
                        <p className="truncate font-medium">{ledger.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ledger.groupId?.name || "Group"} · {ledger.ledgerType}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          ledger.status === "active" ? "default" : "secondary"
                        }
                      >
                        {ledger.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => edit(ledger)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 text-sm text-muted-foreground">
                  <span>
                    Page {data.page} of {Math.max(1, data.totalPages || 1)}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={page >= (data.totalPages || 1)}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />{" "}
              {editingId ? "Edit ledger" : "Create ledger"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Code *</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Account group *</Label>
                <Select
                  value={form.groupId}
                  onValueChange={(value) =>
                    setForm({ ...form, groupId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group._id} value={group._id}>
                        {group.code} — {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ledger type</Label>
                <Select
                  value={form.ledgerType}
                  onValueChange={(value) =>
                    setForm({ ...form, ledgerType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["general", "cash", "bank", "customer", "supplier"].map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {value[0].toUpperCase() + value.slice(1)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              {form.ledgerType === "bank" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Bank name</Label>
                    <Input
                      value={form.bankName}
                      onChange={(e) =>
                        setForm({ ...form, bankName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Account last 4 digits</Label>
                    <Input
                      maxLength={4}
                      value={form.accountNumberLast4}
                      onChange={(e) =>
                        setForm({ ...form, accountNumberLast4: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
              {form.ledgerType === "customer" && (
                <div>
                  <Label>Customer ID</Label>
                  <Input
                    value={form.customerId}
                    onChange={(e) =>
                      setForm({ ...form, customerId: e.target.value })
                    }
                    placeholder="Existing CRM customer id"
                  />
                </div>
              )}
              {form.ledgerType === "supplier" && (
                <div>
                  <Label>Supplier ID</Label>
                  <Input
                    value={form.supplierId}
                    onChange={(e) =>
                      setForm({ ...form, supplierId: e.target.value })
                    }
                    placeholder="Existing supplier id"
                  />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Opening balance (₹)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={fromPaise(Number(form.openingBalancePaise))}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        openingBalancePaise: toPaise(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Opening type</Label>
                  <Select
                    value={form.openingBalanceType}
                    onValueChange={(value) =>
                      setForm({ ...form, openingBalanceType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={
                    !companyId || !form.groupId || saveMutation.isPending
                  }
                >
                  {saveMutation.isPending
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Create ledger"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setForm(blank);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
