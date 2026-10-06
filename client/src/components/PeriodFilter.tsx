import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange, RotateCcw } from "lucide-react";

// Shared day / range / month / year picker. Every screen that filters by date
// uses this so "this month" means the same thing everywhere.

export interface PeriodValue {
  period: string;
  date?: string;
  month?: string;
  year?: string;
  fromDate?: string;
  toDate?: string;
}

export const DEFAULT_PERIOD: PeriodValue = { period: "today" };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Turns the selection into the query string the API expects. */
export function periodToQuery(value: PeriodValue): string {
  const params = new URLSearchParams();
  switch (value.period) {
    case "day":
      if (value.date) params.set("date", value.date);
      break;
    case "month":
      if (value.month) params.set("month", value.month);
      if (value.year) params.set("year", value.year);
      break;
    case "year":
      if (value.year) params.set("year", value.year);
      break;
    case "custom":
      if (value.fromDate) params.set("fromDate", value.fromDate);
      if (value.toDate) params.set("toDate", value.toDate);
      break;
    default:
      params.set("period", value.period);
  }
  return params.toString();
}

interface PeriodFilterProps {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  className?: string;
}

export function PeriodFilter({ value, onChange, className }: PeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 6 }, (_, i) => String(currentYear - i)),
    [currentYear],
  );

  const set = (patch: Partial<PeriodValue>) => onChange({ ...value, ...patch });

  // A page may start on "month" or "year" without naming one. Show the current
  // month/year, which is what the API falls back to, so the controls match the
  // data on screen.
  const effectiveMonth = value.month || String(new Date().getMonth() + 1);
  const effectiveYear = value.year || String(currentYear);

  const showsExtraControls = ["day", "month", "year", "custom"].includes(value.period);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <Label className="text-xs text-muted-foreground">Period</Label>
          <Select
            value={value.period}
            onValueChange={(period) => {
              // Seed sensible defaults so the view never goes blank on switch.
              const today = new Date().toISOString().slice(0, 10);
              if (period === "day") set({ period, date: value.date || today });
              else if (period === "month")
                set({ period, month: value.month || String(new Date().getMonth() + 1), year: value.year || String(currentYear) });
              else if (period === "year") set({ period, year: value.year || String(currentYear) });
              else if (period === "custom")
                set({ period, fromDate: value.fromDate || today, toDate: value.toDate || today });
              else set({ period });
            }}
          >
            <SelectTrigger data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="year">Year</SelectItem>
              <SelectItem value="day">Specific date</SelectItem>
              <SelectItem value="custom">Date range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {value.period === "day" && (
          <div>
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input
              type="date"
              value={value.date || ""}
              onChange={(e) => set({ date: e.target.value })}
              data-testid="input-period-date"
            />
          </div>
        )}

        {value.period === "month" && (
          <>
            <div className="min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Month</Label>
              <Select value={effectiveMonth} onValueChange={(month) => set({ month })}>
                <SelectTrigger data-testid="select-period-month">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[110px]">
              <Label className="text-xs text-muted-foreground">Year</Label>
              <Select value={effectiveYear} onValueChange={(year) => set({ year })}>
                <SelectTrigger data-testid="select-period-year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {value.period === "year" && (
          <div className="min-w-[110px]">
            <Label className="text-xs text-muted-foreground">Year</Label>
            <Select value={effectiveYear} onValueChange={(year) => set({ year })}>
              <SelectTrigger data-testid="select-period-year-only">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {value.period === "custom" && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={value.fromDate || ""}
                onChange={(e) => set({ fromDate: e.target.value })}
                data-testid="input-period-from"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={value.toDate || ""}
                onChange={(e) => set({ toDate: e.target.value })}
                data-testid="input-period-to"
              />
            </div>
          </>
        )}

        {showsExtraControls && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(DEFAULT_PERIOD)}
            data-testid="button-reset-period"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}

export function PeriodLabel({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <CalendarRange className="h-4 w-4" />
      {label}
    </span>
  );
}
