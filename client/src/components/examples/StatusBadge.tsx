import { StatusBadge } from "../StatusBadge";

export default function StatusBadgeExample() {
  return (
    <div className="p-6 bg-background flex flex-wrap gap-3">
      <StatusBadge type="service" status="inquired" />
      <StatusBadge type="service" status="working" />
      <StatusBadge type="service" status="waiting" />
      <StatusBadge type="service" status="completed" />
      <StatusBadge type="stock" status="in_stock" />
      <StatusBadge type="stock" status="low_stock" />
      <StatusBadge type="stock" status="out_of_stock" />
      <StatusBadge type="payment" status="paid" />
      <StatusBadge type="payment" status="partial" />
      <StatusBadge type="payment" status="due" />
    </div>
  );
}
