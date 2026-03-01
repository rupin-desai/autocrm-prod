import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
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

export function KPICard({ title, value, icon: Icon, trend, className, color = "blue" }: KPICardProps) {
  const colorClasses = {
    blue: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800",
    yellow: "bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800",
    green: "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800",
    purple: "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800",
    orange: "bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800",
    pink: "bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900 border-pink-200 dark:border-pink-800",
  };

  const iconColorClasses = {
    blue: "bg-blue-500/20 dark:bg-blue-500/30",
    yellow: "bg-yellow-500/20 dark:bg-yellow-500/30",
    green: "bg-green-500/20 dark:bg-green-500/30",
    purple: "bg-purple-500/20 dark:bg-purple-500/30",
    orange: "bg-orange-500/20 dark:bg-orange-500/30",
    pink: "bg-pink-500/20 dark:bg-pink-500/30",
  };

  const iconTextColorClasses = {
    blue: "text-blue-600 dark:text-blue-400",
    yellow: "text-yellow-600 dark:text-yellow-400",
    green: "text-green-600 dark:text-green-400",
    purple: "text-purple-600 dark:text-purple-400",
    orange: "text-orange-600 dark:text-orange-400",
    pink: "text-pink-600 dark:text-pink-400",
  };

  return (
    <Card className={cn("hover-elevate border-2", colorClasses[color], className)} data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100" data-testid={`value-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
            {trend && (
              <p className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? "+" : ""}{trend.value}% from last month
              </p>
            )}
          </div>
          <div className={cn("p-3 rounded-lg", iconColorClasses[color])}>
            <Icon className={cn("h-6 w-6", iconTextColorClasses[color])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
