import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  color?: "blue" | "yellow" | "green" | "purple" | "orange" | "pink";
}

// The surface stays neutral; colour appears only on the icon chip and the
// trend, so a wall of KPIs reads as one system and the numbers lead.
const accentClasses: Record<string, string> = {
  blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  yellow: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  purple: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
};

export function KPICard({ title, value, icon: Icon, trend, className, color = "blue" }: KPICardProps) {
  const TrendIcon = trend?.isPositive ? TrendingUp : TrendingDown;

  return (
    <Card
      className={cn(
        "group transition-shadow duration-200 hover:shadow-md",
        className,
      )}
      data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p
              className="text-2xl font-semibold tabular-nums tracking-tight text-foreground"
              data-testid={`value-${title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {value}
            </p>
            {trend && (
              <p
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium",
                  trend.isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                <TrendIcon className="h-3.5 w-3.5" />
                {trend.isPositive ? "+" : ""}{trend.value}%
                <span className="font-normal text-muted-foreground">vs last month</span>
              </p>
            )}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105",
              accentClasses[color],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
