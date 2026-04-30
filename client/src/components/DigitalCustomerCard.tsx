import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DigitalCustomerCardProps {
  customer: {
    name: string;
    phone: string;
    email: string;
    vehicle: {
      regNo: string;
      make: string;
      model: string;
      year: number;
    };
  };
  totalVisits: number;
  lastHandler: string;
  currentHandler: string;
  recentVisits: Array<{
    date: string;
    handler: string;
    status: string;
    parts: string[];
  }>;
}

export function DigitalCustomerCard({
  customer,
  totalVisits,
  lastHandler,
  currentHandler,
  recentVisits,
}: DigitalCustomerCardProps) {
  return (
    <Card data-testid="digital-customer-card">
      <CardHeader>
        <CardTitle>{customer.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 text-sm">
          <p>{customer.phone}</p>
          <p>{customer.email}</p>
          <p className="font-medium">
            {customer.vehicle.regNo} - {customer.vehicle.make} {customer.vehicle.model} ({customer.vehicle.year})
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Visits</p>
            <p className="font-semibold">{totalVisits}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Handler</p>
            <p className="font-semibold">{lastHandler}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Current Handler</p>
            <p className="font-semibold">{currentHandler}</p>
          </div>
        </div>

        <div className="space-y-2">
          {recentVisits.map((visit) => (
            <div key={`${visit.date}-${visit.handler}`} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{visit.date}</p>
                <Badge variant="secondary">{visit.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{visit.handler}</p>
              <p className="text-xs mt-2">{visit.parts.join(", ")}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
