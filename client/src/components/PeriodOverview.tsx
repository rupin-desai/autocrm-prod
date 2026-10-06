import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PeriodFilter, periodToQuery, type PeriodValue } from "@/components/PeriodFilter";
import { EmptyState } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import {
  ArrowDownRight, ArrowUpRight, Banknote, CreditCard, IndianRupee,
  Smartphone, Users, Wallet,
} from "lucide-react";

// Requirement 4: date/period-wise dashboard figures and customer analytics.
// Everything below reads from one resolved window, so changing the date,
// month, year or range updates every figure together.

const money = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const localDay = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function Delta({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center text-xs ${up ? "text-green-600" : "text-red-600"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  );
}

export function PeriodOverview() {
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<PeriodValue>({ period: "today" });

  const qs = useMemo(() => periodToQuery(period), [period]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/period", qs],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/period?${qs}&compare=true`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load dashboard data");
      return res.json();
    },
  });

  const { data: analytics } = useQuery<any>({
    queryKey: ["/api/dashboard/customer-analytics", qs],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/customer-analytics?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load customer analytics");
      return res.json();
    },
  });

  const change = data?.comparison?.change;

  const cards = [
    {
      title: "Sales",
      value: money(data?.sales?.billed || 0),
      sub: `${data?.sales?.invoiceCount || 0} invoice(s)`,
      icon: IndianRupee,
      delta: change?.billed,
      chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    {
      title: "UPI",
      value: money(data?.collection?.upi || 0),
      sub: "collected",
      icon: Smartphone,
      chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      title: "Cash",
      value: money(data?.collection?.cash || 0),
      sub: "collected",
      icon: Banknote,
      chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Card",
      value: money(data?.collection?.card || 0),
      sub: "collected",
      icon: CreditCard,
      chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    },
    {
      title: "Pending",
      value: money(data?.pending?.amount || 0),
      sub: `${data?.pending?.invoiceCount || 0} unpaid invoice(s)`,
      icon: Wallet,
      chip: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
    {
      title: "Total Customers",
      value: String(data?.customers?.total ?? 0),
      sub: `${data?.customers?.added ?? 0} added in period`,
      icon: Users,
      delta: change?.customersAdded,
      chip: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    },
  ];

  const series = useMemo(() => {
    const added = analytics?.series?.added || [];
    const visited = analytics?.series?.visited || [];
    const buckets = Array.from(new Set([...added, ...visited].map((r: any) => r.bucket))).sort();
    return buckets.map((b) => ({
      bucket: b,
      added: added.find((r: any) => r.bucket === b)?.count || 0,
      visited: visited.find((r: any) => r.bucket === b)?.count || 0,
    }));
  }, [analytics]);

  // Open the customer list already filtered to this period's window.
  const registrationLink = data?.range
    ? `/registration-dashboard?from=${localDay(data.range.from)}&to=${localDay(data.range.to)}`
    : "/registration-dashboard";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Business Overview</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data?.range?.label || "Loading..."}
              {data?.collection?.total > 0 && (
                <> · {money(data.collection.total)} collected across {data.collection.paymentCount} payment(s)</>
              )}
            </p>
          </div>
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[104px] w-full rounded-lg" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map((c) => (
              <div
                key={c.title}
                className="group rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
                data-testid={`card-period-${c.title.toLowerCase().replace(/\s/g, "-")}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-h-[2rem] text-[11px] font-medium uppercase leading-4 tracking-wide text-muted-foreground">
                    {c.title}
                  </span>
                  <span className={cn("rounded-md p-1.5 transition-transform duration-200 group-hover:scale-105", c.chip)}>
                    <c.icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-2 text-xl font-semibold tabular-nums tracking-tight">{c.value}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="truncate text-xs text-muted-foreground">{c.sub}</span>
                  <Delta value={c.delta} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Customers added vs visited</h3>
              <Badge variant="outline" className="text-xs">by {analytics?.groupBy || "day"}</Badge>
            </div>
            {series.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No customer activity"
                description="Nothing was recorded in this period. Try a wider date range."
                className="h-[220px] py-0"
              />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="bucket" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="added" name="Added" stroke="#0ea5e9" strokeWidth={2} />
                  <Line type="monotone" dataKey="visited" name="Visited" stroke="#22c55e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-medium">In this period</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: "Customers added", value: data?.customers?.added ?? 0, to: registrationLink },
                { label: "Customers visited", value: data?.customers?.visited ?? 0, to: "/visits" },
                { label: "Verified", value: analytics?.totals?.verified ?? 0 },
                { label: "Unverified", value: analytics?.totals?.unverified ?? 0 },
                { label: "Service visits", value: data?.services?.total ?? 0, to: "/visits" },
                { label: "Inquiries", value: data?.inquiries?.count ?? 0, to: "/inquiries" },
                { label: "Quotations", value: data?.quotations?.count ?? 0, to: "/quotations" },
                { label: "Advances", value: money(data?.advances?.amount ?? 0), to: "/advance-payments" },
                { label: "Open warranty items", value: data?.warranties?.open ?? 0, to: "/warranty-claims" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between border-b border-border/50 pb-1.5 last:border-0 last:pb-0"
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  {row.to ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 font-semibold tabular-nums hover:text-primary"
                      onClick={() => setLocation(row.to!)}
                    >
                      {row.value}
                    </Button>
                  ) : (
                    <span className="font-semibold tabular-nums">{row.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {(analytics?.byReferralSource?.length ?? 0) > 0 && (
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-3">How they found us</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analytics.byReferralSource}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="source" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" name="Customers" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
