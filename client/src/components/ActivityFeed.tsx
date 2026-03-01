import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  Package, 
  ShoppingCart, 
  Users, 
  Warehouse, 
  FileText,
  ClipboardList,
  Building2,
  Calendar,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { formatDistance } from "date-fns";

interface ActivityLog {
  _id: string;
  userName: string;
  userRole: string;
  action: string;
  resource: string;
  description: string;
  createdAt: string;
}

const getActionColor = (action: string) => {
  switch (action) {
    case 'create':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'update':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'delete':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'login':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'approve':
      return 'bg-teal-500/10 text-teal-500 border-teal-500/20';
    case 'reject':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'complete':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
};

const getResourceIcon = (resource: string) => {
  const iconClass = "h-4 w-4";
  switch (resource) {
    case 'product':
      return <Package className={iconClass} />;
    case 'order':
      return <ShoppingCart className={iconClass} />;
    case 'customer':
      return <Users className={iconClass} />;
    case 'employee':
      return <Users className={iconClass} />;
    case 'inventory':
      return <Warehouse className={iconClass} />;
    case 'supplier':
      return <Building2 className={iconClass} />;
    case 'purchase_order':
      return <FileText className={iconClass} />;
    case 'service_visit':
      return <ClipboardList className={iconClass} />;
    case 'attendance':
      return <Calendar className={iconClass} />;
    case 'communication':
      return <MessageSquare className={iconClass} />;
    default:
      return <Activity className={iconClass} />;
  }
};

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'Admin':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'Inventory Manager':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'Sales Executive':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'HR Manager':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'Service Staff':
      return 'bg-teal-500/10 text-teal-500 border-teal-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
};

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const { data: activities = [], isLoading, error } = useQuery<ActivityLog[]>({
    queryKey: [`/api/activity-logs?limit=${limit}`],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card data-testid="card-activity-feed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="card-activity-feed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-3" />
            <p className="text-destructive font-medium mb-1">Failed to load activities</p>
            <p className="text-muted-foreground text-sm">
              {error instanceof Error ? error.message : 'An error occurred while loading activities'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card data-testid="card-activity-feed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No activities recorded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-activity-feed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity._id}
                className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0"
                data-testid={`activity-${activity._id}`}
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    {getResourceIcon(activity.resource)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-description-${activity._id}`}>
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getRoleBadgeColor(activity.userRole)}`}
                          data-testid={`badge-role-${activity._id}`}
                        >
                          {activity.userName}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getActionColor(activity.action)}`}
                          data-testid={`badge-action-${activity._id}`}
                        >
                          {activity.action}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`text-time-${activity._id}`}>
                      {formatDistance(new Date(activity.createdAt), new Date(), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
