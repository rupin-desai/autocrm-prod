import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FilePlus2, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, EmptyState, TableSkeleton } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const paise = (value: string) => {
  if (!/^\d*(\.\d{0,2})?$/.test(value.trim())) return 0;
  const [a = "0", b = ""] = value.trim().split(".");
  return Number(`${a || "0"}${b.padEnd(2, "0")}`);
};
const rupees = (value: number) => ((value || 0) / 100).toFixed(2);
export default function AccountingVouchers() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("journal");
  const [narration, setNarration] = useState("");
  const [rows, setRows] = useState([
    { ledgerAccountId: "", debitPaise: 0, creditPaise: 0 },
    { ledgerAccountId: "", debitPaise: 0, creditPaise: 0 },
  ]);
  const [selectedId, setSelectedId] = useState("");
  const [reverseDate, setReverseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const { data: context } = useQuery<any>({
    queryKey: ["/api/accounting/context"],
  });
  const companyId = context?.company?._id;
  const financialYearId = context?.financialYear?._id;
  const { data: periods } = useQuery<any>({
    queryKey: ["/api/accounting/periods", financialYearId],
    queryFn: async () =>
      (
        await fetch(
          `/api/accounting/financial-years/${financialYearId}/periods`,
          { credentials: "include" },
        )
      ).json(),
    enabled: Boolean(financialYearId),
  });
  const { data: ledgers } = useQuery<any>({
    queryKey: ["/api/accounting/ledgers", companyId],
    queryFn: async () =>
      (
        await fetch(
          `/api/accounting/ledgers?companyId=${companyId}&limit=100`,
          { credentials: "include" },
        )
      ).json(),
    enabled: Boolean(companyId),
  });
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/accounting/vouchers", companyId, financialYearId],
    queryFn: async () =>
      (
        await fetch(
          `/api/accounting/vouchers?companyId=${companyId}&financialYearId=${financialYearId}`,
          { credentials: "include" },
        )
      ).json(),
    enabled: Boolean(companyId && financialYearId),
  });
  const { data: selected } = useQuery<any>({
    queryKey: ["/api/accounting/voucher", selectedId],
    queryFn: async () =>
      (
        await fetch(`/api/accounting/vouchers/${selectedId}`, {
          credentials: "include",
        })
      ).json(),
    enabled: Boolean(selectedId),
  });
  const { data: audit } = useQuery<any[]>({
    queryKey: ["/api/accounting/voucher-audit", selectedId],
    queryFn: async () =>
      (
        await fetch(`/api/accounting/vouchers/${selectedId}/audit`, {
          credentials: "include",
        })
      ).json(),
    enabled: Boolean(selectedId),
  });
  const totalDebit = useMemo(
    () => rows.reduce((n, r) => n + r.debitPaise, 0),
    [rows],
  );
  const totalCredit = useMemo(
    () => rows.reduce((n, r) => n + r.creditPaise, 0),
    [rows],
  );
  const create = useMutation({
    mutationFn: async () =>
      await apiRequest("POST", "/api/accounting/vouchers", {
        companyId,
        financialYearId,
        accountingPeriodId: (
          periods?.find((p: any) => p.status === "open") || periods?.[0]
        )?._id,
        voucherType: type,
        voucherDate: new Date().toISOString().slice(0, 10),
        narration,
        lines: rows,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/vouchers"] });
      setShowForm(false);
      toast({ title: "Draft voucher created" });
    },
    onError: (e: Error) =>
      toast({
        title: "Unable to create voucher",
        description: e.message,
        variant: "destructive",
      }),
  });
  const action = useMutation({
    mutationFn: async ({ id, verb, body }: any) =>
      (
        await apiRequest(
          "POST",
          `/api/accounting/vouchers/${id}/${verb}`,
          body || {},
        )
      ).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/vouchers"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/voucher", selectedId],
      });
      toast({ title: "Voucher updated" });
    },
    onError: (e: Error) =>
      toast({
        title: "Voucher action failed",
        description: e.message,
        variant: "destructive",
      }),
  });
  const updateRow = (
    index: number,
    field: "ledgerAccountId" | "debitPaise" | "creditPaise",
    value: any,
  ) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vouchers"
        description="Create and control double-entry accounting vouchers."
        icon={FilePlus2}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              New voucher
            </Button>
          </div>
        }
      />
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New draft voucher</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="h-10 rounded-md border bg-background px-3"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="journal">Journal</option>
                <option value="payment">Payment</option>
                <option value="receipt">Receipt</option>
                <option value="contra">Contra</option>
              </select>
              <Input
                placeholder="Narration"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
              />
            </div>
            {rows.map((row, i) => (
              <div
                className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_150px]"
                key={i}
              >
                <select
                  className="h-10 rounded-md border bg-background px-3"
                  value={row.ledgerAccountId}
                  onChange={(e) =>
                    updateRow(i, "ledgerAccountId", e.target.value)
                  }
                >
                  <option value="">Select ledger</option>
                  {(ledgers?.items || ledgers || []).map((l: any) => (
                    <option key={l._id} value={l._id}>
                      {l.code} — {l.name}
                    </option>
                  ))}
                </select>
                <Input
                  inputMode="decimal"
                  placeholder="Debit ₹"
                  onChange={(e) =>
                    updateRow(i, "debitPaise", paise(e.target.value))
                  }
                />
                <Input
                  inputMode="decimal"
                  placeholder="Credit ₹"
                  onChange={(e) =>
                    updateRow(i, "creditPaise", paise(e.target.value))
                  }
                />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Button
                variant="outline"
                onClick={() =>
                  setRows([
                    ...rows,
                    { ledgerAccountId: "", debitPaise: 0, creditPaise: 0 },
                  ])
                }
              >
                Add line
              </Button>
              <span>Debit ₹{rupees(totalDebit)}</span>
              <span>Credit ₹{rupees(totalCredit)}</span>
              <span
                className={
                  totalDebit === totalCredit
                    ? "text-emerald-600"
                    : "text-destructive"
                }
              >
                {totalDebit === totalCredit ? "Balanced" : "Not balanced"}
              </span>
              <Button
                onClick={() => create.mutate()}
                disabled={
                  create.isPending ||
                  totalDebit === 0 ||
                  totalDebit !== totalCredit
                }
              >
                Save draft
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Voucher register</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : !(data?.items || []).length ? (
            <EmptyState
              icon={FilePlus2}
              title="No vouchers yet"
              description="Create a draft voucher to begin."
            />
          ) : (
            <div className="space-y-2">
              {data.items.map((v: any) => (
                <div className="rounded-lg border p-3" key={v._id}>
                  <button
                    className="w-full text-left"
                    onClick={() => setSelectedId(v._id)}
                  >
                    <div className="flex flex-wrap items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {v.voucherNumber || "Draft"} · {v.voucherType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {v.narration || "No narration"} ·{" "}
                          {new Date(v.voucherDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-3 py-1 text-xs">
                        {v.status}
                      </span>
                    </div>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {v.status === "draft" &&
                      user?.permissions?.accounting?.includes("submit") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            action.mutate({ id: v._id, verb: "submit" })
                          }
                        >
                          Submit
                        </Button>
                      )}
                    {v.status === "pending_approval" &&
                      user?.permissions?.accounting?.includes("approve") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            action.mutate({ id: v._id, verb: "approve" })
                          }
                        >
                          Approve
                        </Button>
                      )}
                    {v.status === "approved" &&
                      user?.permissions?.accounting?.includes("post") && (
                        <Button
                          size="sm"
                          onClick={() =>
                            action.mutate({ id: v._id, verb: "post" })
                          }
                        >
                          Post
                        </Button>
                      )}
                    {["draft", "pending_approval", "approved"].includes(
                      v.status,
                    ) &&
                      user?.permissions?.accounting?.includes("cancel") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            action.mutate({ id: v._id, verb: "cancel" })
                          }
                        >
                          Cancel
                        </Button>
                      )}
                    {v.status === "posted" &&
                      user?.permissions?.accounting?.includes("reverse") && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            action.mutate({
                              id: v._id,
                              verb: "reverse",
                              body: {
                                voucherDate: reverseDate,
                                accountingPeriodId: (
                                  periods?.find(
                                    (p: any) => p.status === "open",
                                  ) || periods?.[0]
                                )?._id,
                                reason: "User reversal",
                              },
                            })
                          }
                        >
                          Reverse using {reverseDate}
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <label className="text-sm">Reversal date</label>
            <Input
              type="date"
              className="w-auto"
              value={reverseDate}
              onChange={(e) => setReverseDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>
              Voucher detail — {selected.voucherNumber || "Draft"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Status: <strong>{selected.status}</strong> · Debit ₹
              {rupees(selected.totalDebitPaise)} · Credit ₹
              {rupees(selected.totalCreditPaise)}
            </p>
            <div className="space-y-1">
              {selected.lines?.map((line: any) => (
                <div
                  className="grid grid-cols-3 rounded border p-2 text-sm"
                  key={line._id}
                >
                  <span>
                    {line.ledgerAccountId?.code} — {line.ledgerAccountId?.name}
                  </span>
                  <span>Dr ₹{rupees(line.debitPaise)}</span>
                  <span>Cr ₹{rupees(line.creditPaise)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="font-medium">Audit history</p>
              {(audit || []).map((event: any) => (
                <p className="text-xs text-muted-foreground" key={event._id}>
                  {event.action} ·{" "}
                  {new Date(event.performedAt).toLocaleString()}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
