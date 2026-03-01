import { KPICard } from "../KPICard";
import { DollarSign } from "lucide-react";

export default function KPICardExample() {
  return (
    <div className="p-6 bg-background">
      <KPICard
        title="Today's Sales"
        value="₹1,24,500"
        icon={DollarSign}
        trend={{ value: 12.5, isPositive: true }}
      />
    </div>
  );
}
