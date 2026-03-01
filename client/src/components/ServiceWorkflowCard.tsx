import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, Package, IndianRupee, FileText, Eye, Edit } from "lucide-react";

interface ServiceWorkflowCardProps {
  customerName: string;
  vehicleReg: string;
  status: "inquired" | "working" | "waiting" | "completed";
  handlers: string[];
  startTime: string;
  totalAmount?: number;
  partsCount?: number;
  notes?: string;
  onView?: () => void;
  onEdit?: () => void;
}

export function ServiceWorkflowCard({
  customerName,
  vehicleReg,
  status,
  handlers,
  startTime,
  totalAmount,
  partsCount,
  notes,
  onView,
  onEdit,
}: ServiceWorkflowCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getPhaseBackgroundColor = (status: string) => {
    switch (status) {
      case "inquired":
        return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50";
      case "working":
        return "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50";
      case "waiting":
        return "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50";
      case "completed":
        return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50";
      default:
        return "";
    }
  };

  return (
    <Card className={`hover-elevate ${getPhaseBackgroundColor(status)}`} data-testid={`service-card-${vehicleReg}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold">{customerName}</CardTitle>
            <p className="text-sm text-muted-foreground font-mono mt-2">{vehicleReg}</p>
          </div>
          <StatusBadge type="service" status={status} />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {handlers?.length > 0 ? `Handler${handlers.length > 1 ? 's' : ''}` : 'No handlers assigned'}
          </p>
          {handlers?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {handlers.map((handler, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(handler)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs font-medium">{handler}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Unassigned</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{startTime}</p>
            </div>
          </div>
          
          {partsCount !== undefined && partsCount > 0 && (
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{partsCount} parts</p>
              </div>
            </div>
          )}
        </div>

        {totalAmount !== undefined && totalAmount > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <IndianRupee className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        )}

        {notes && (
          <div className="flex items-start gap-2 pt-2 border-t">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{notes}</p>
          </div>
        )}

        <div className="flex gap-2 pt-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onView?.();
            }}
            data-testid={`button-view-${vehicleReg}`}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            View Details
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            data-testid={`button-edit-${vehicleReg}`}
          >
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
