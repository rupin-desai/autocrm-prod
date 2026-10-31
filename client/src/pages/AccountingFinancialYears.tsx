import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarRange, Lock, RefreshCw, Unlock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, EmptyState, TableSkeleton } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

function suggestedYear() {
  const now = new Date();
  const startYear =
    now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
    startDate: `${startYear}-04-01`,
    endDate: `${startYear + 1}-03-31`,
  };
}

export default function AccountingFinancialYears() {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...suggestedYear(), status: "inactive" });
  const { data: context } = useQuery<any>({
    queryKey: ["/api/accounting/context"],
  });
  const companyId = context?.company?._id;
  const {
    data: years = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ["/api/accounting/financial-years", companyId],
    queryFn: async () =>
      companyId
        ? (
            await fetch(
              `/api/accounting/financial-years?companyId=${companyId}`,
              { credentials: "include" },
            )
          ).json()
        : [],
    enabled: Boolean(companyId),
  });
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const { data: periods = [] } = useQuery<any[]>({
    queryKey: ["/api/accounting/periods", selectedYearId],
    queryFn: async () =>
      (
        await fetch(
          `/api/accounting/financial-years/${selectedYearId}/periods`,
          { credentials: "include" },
        )
      ).json(),
    enabled: Boolean(selectedYearId),
  });
  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/accounting/financial-years", {
          ...form,
          companyId,
        })
      ).json(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/accounting/financial-years"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/accounting/context"],
      });
      toast({ title: "Financial year created" });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to create financial year",
        description: error.message,
        variant: "destructive",
      }),
  });
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (
        await apiRequest("PATCH", `/api/accounting/financial-years/${id}`, {
          status,
        })
      ).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/financial-years"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/context"] });
      toast({ title: "Financial year updated" });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to update financial year",
        description: error.message,
        variant: "destructive",
      }),
  });
  const periodMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (
        await apiRequest("PATCH", `/api/accounting/periods/${id}`, { status })
      ).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/periods", selectedYearId],
      });
      toast({ title: "Accounting period updated" });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to update period",
        description: error.message,
        variant: "destructive",
      }),
  });
  const dateHint = useMemo(() => "Dates must be April 1 through March 31.", []);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial years"
        description="Manage April-to-March accounting years and their periods."
        icon={CalendarRange}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
        <Card>
          <CardHeader>
            <CardTitle>Financial years</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={4} />
            ) : isError ? (
              <EmptyState
                title="Unable to load financial years"
                action={<Button onClick={() => refetch()}>Try again</Button>}
              />
            ) : years.length === 0 ? (
              <EmptyState
                icon={CalendarRange}
                title="No financial years"
                description="Create the first April-to-March financial year."
              />
            ) : (
              <div className="space-y-3">
                {years.map((year) => (
                  <div key={year._id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">FY {year.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(year.startDate).toLocaleDateString("en-IN")}{" "}
                          – {new Date(year.endDate).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <Badge
                        variant={
                          year.status === "active"
                            ? "default"
                            : year.status === "closed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {year.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSelectedYearId(
                            selectedYearId === year._id ? null : year._id,
                          )
                        }
                      >
                        {selectedYearId === year._id
                          ? "Hide periods"
                          : "View periods"}
                      </Button>
                      {year.status !== "closed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            statusMutation.mutate({
                              id: year._id,
                              status:
                                year.status === "active"
                                  ? "inactive"
                                  : "active",
                            })
                          }
                        >
                          {year.status === "active"
                            ? "Make inactive"
                            : "Set active"}
                        </Button>
                      )}
                      {year.status !== "closed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            statusMutation.mutate({
                              id: year._id,
                              status: "closed",
                            })
                          }
                        >
                          Close year
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedYearId && (
              <div className="mt-5 border-t pt-4">
                <p className="mb-3 text-sm font-medium">Accounting periods</p>
                <div className="space-y-2">
                  {periods.map((period) => (
                    <div
                      key={period._id}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm">{period.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {period.status}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          periodMutation.mutate({
                            id: period._id,
                            status:
                              period.status === "open" ? "locked" : "open",
                          })
                        }
                      >
                        {period.status === "open" ? (
                          <>
                            <Lock className="mr-1 h-3.5 w-3.5" /> Lock
                          </>
                        ) : (
                          <>
                            <Unlock className="mr-1 h-3.5 w-3.5" /> Unlock
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Create financial year</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                createMutation.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label>Label *</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Start date *</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End date *</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{dateHint}</p>
              <Button
                type="submit"
                disabled={createMutation.isPending || !companyId}
              >
                {createMutation.isPending
                  ? "Saving..."
                  : "Create financial year"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
