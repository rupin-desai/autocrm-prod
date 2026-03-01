import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";

type ServiceStatus = "inquired" | "working" | "waiting" | "completed";
type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
type PaymentStatus = "paid" | "partial" | "due";

interface StatusBadgeProps {
  type: "service" | "stock" | "payment";
  status: ServiceStatus | StockStatus | PaymentStatus;
  className?: string;
}

const serviceStatusConfig = {
  inquired: {
    label: "Inquired",
    phase: "Phase 1",
    icon: Clock,
    className: "bg-status-inquired/10 text-status-inquired border-status-inquired/20",
  },
  waiting: {
    label: "Waiting for Parts",
    phase: "Phase 3",
    icon: AlertCircle,
    className: "bg-status-waiting/10 text-status-waiting border-status-waiting/20",
  },
  working: {
    label: "Working",
    phase: "Phase 2",
    icon: Loader2,
    className: "bg-status-working/10 text-status-working border-status-working/20",
  },
  completed: {
    label: "Completed",
    phase: "Phase 4",
    icon: CheckCircle,
    className: "bg-status-completed/10 text-status-completed border-status-completed/20",
  },
};

const stockStatusConfig = {
  in_stock: {
    label: "In Stock",
    className: "bg-success/10 text-success border-success/20",
  },
  low_stock: {
    label: "Low Stock",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  out_of_stock: {
    label: "Out of Stock",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const paymentStatusConfig = {
  paid: {
    label: "Paid",
    className: "bg-success/10 text-success border-success/20",
  },
  partial: {
    label: "Partial",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  due: {
    label: "Due",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function StatusBadge({ type, status, className }: StatusBadgeProps) {
  if (type === "service") {
    const config = serviceStatusConfig[status as ServiceStatus];
    const Icon = config.icon;
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400" data-testid={`phase-${status}`}>
          {config.phase}
        </span>
        <Badge variant="outline" className={cn("border", config.className, className)} data-testid={`status-${status}`}>
          <Icon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      </div>
    );
  }

  if (type === "stock") {
    const config = stockStatusConfig[status as StockStatus];
    return (
      <Badge variant="outline" className={cn("border", config.className, className)} data-testid={`status-${status}`}>
        {config.label}
      </Badge>
    );
  }

  const config = paymentStatusConfig[status as PaymentStatus];
  return (
    <Badge variant="outline" className={cn("border", config.className, className)} data-testid={`status-${status}`}>
      {config.label}
    </Badge>
  );
}
