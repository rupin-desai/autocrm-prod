import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, EmptyState, TableSkeleton } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

function toPaise(value: string) {
  const normalized = value.trim();
  if (!/^\d*(\.\d{0,2})?$/.test(normalized)) return 0;
  const [whole = "0", fraction = ""] = normalized.split(".");
  return Number(`${whole || "0"}${fraction.padEnd(2, "0")}`);
}
function fromPaise(value: number) {
  return ((Number(value) || 0) / 100).toFixed(2);
}

export default function OpeningBalances() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const { data: context } = useQuery<any>({
    queryKey: ["/api/accounting/context"],
  });
  const companyId = context?.company?._id;
  const financialYearId = context?.financialYear?._id;
  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["/api/accounting/opening-balances", companyId, financialYearId],
    queryFn: async () =>
      (
        await fetch(
          `/api/accounting/opening-balances?companyId=${companyId}&financialYearId=${financialYearId}`,
          { credentials: "include" },
        )
      ).json(),
    enabled: Boolean(companyId && financialYearId),
  });
  const [drafts, setDrafts] = useState<
    Record<string, { debitPaise: number; creditPaise: number }>
  >({});
  const saveMutation = useMutation({
    mutationFn: async ({
      ledgerId,
      debitPaise,
      creditPaise,
    }: {
      ledgerId: string;
      debitPaise: number;
      creditPaise: number;
    }) =>
      (
        await apiRequest("POST", "/api/accounting/opening-balances", {
          companyId,
          financialYearId,
          ledgerAccountId: ledgerId,
          debitPaise,
          creditPaise,
        })
      ).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/opening-balances"],
      });
      toast({ title: "Opening balance saved" });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to save opening balance",
        description: error.message,
        variant: "destructive",
      }),
  });
  const filtered = useMemo(
    () =>
      (data?.items || []).filter((ledger: any) =>
        `${ledger.code} ${ledger.name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [data?.items, search],
  );
  const valueFor = (ledger: any) =>
    drafts[ledger._id] || {
      debitPaise: ledger.openingBalance?.debitPaise || 0,
      creditPaise: ledger.openingBalance?.creditPaise || 0,
    };
  const total = data?.summary || {
    totalDebitPaise: 0,
    totalCreditPaise: 0,
    differencePaise: 0,
    balanced: true,
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Opening balances"
        description={`Opening balances for FY ${data?.financialYear?.label || context?.financialYear?.label || "—"}.`}
        icon={ClipboardList}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">
              Total debit
            </p>
            <p className="mt-1 text-xl font-semibold">
              ₹{fromPaise(total.totalDebitPaise)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">
              Total credit
            </p>
            <p className="mt-1 text-xl font-semibold">
              ₹{fromPaise(total.totalCreditPaise)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Status</p>
            <p
              className={`mt-1 flex items-center gap-2 text-xl font-semibold ${total.balanced ? "text-emerald-600" : "text-destructive"}`}
            >
              {total.balanced && <CheckCircle2 className="h-5 w-5" />}
              {total.balanced
                ? "Balanced"
                : `Difference ₹${fromPaise(Math.abs(total.differencePaise))}`}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ledger opening balances</CardTitle>
          <Input
            className="max-w-sm"
            placeholder="Search ledger"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={8} />
          ) : isError ? (
            <EmptyState
              title="Unable to load opening balances"
              action={<Button onClick={() => refetch()}>Try again</Button>}
            />
          ) : !filtered.length ? (
            <EmptyState
              icon={ClipboardList}
              title="No active ledgers"
              description="Create active ledgers before entering opening balances."
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((ledger: any) => {
                const value = valueFor(ledger);
                return (
                  <div
                    key={ledger._id}
                    className="grid items-center gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_150px_150px_auto]"
                  >
                    <div>
                      <p className="font-medium">
                        {ledger.code} — {ledger.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ledger.groupId?.name || "Group"}
                      </p>
                    </div>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="Debit ₹"
                      value={fromPaise(value.debitPaise)}
                      onChange={(e) =>
                        setDrafts({
                          ...drafts,
                          [ledger._id]: {
                            debitPaise: toPaise(e.target.value),
                            creditPaise: 0,
                          },
                        })
                      }
                    />
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="Credit ₹"
                      value={fromPaise(value.creditPaise)}
                      onChange={(e) =>
                        setDrafts({
                          ...drafts,
                          [ledger._id]: {
                            debitPaise: 0,
                            creditPaise: toPaise(e.target.value),
                          },
                        })
                      }
                    />
                    <Button
                      size="sm"
                      onClick={() =>
                        saveMutation.mutate({ ledgerId: ledger._id, ...value })
                      }
                      disabled={saveMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
