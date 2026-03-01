import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { KPICard } from "@/components/KPICard";
import { ServiceWorkflowCard } from "@/components/ServiceWorkflowCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  IndianRupee, 
  Package, 
  Users, 
  AlertTriangle, 
  Plus, 
  TrendingUp,
  ClipboardCheck,
  UserCheck,
  FileText,
  CheckCircle,
  ShoppingCart,
  BarChart3,
  PieChart,
  Activity,
  CalendarOff,
  CheckSquare,
  UserCircle,
  Ticket,
  AlertCircle,
  Store
} from "lucide-react";
import { formatDistance } from "date-fns";
import { 
  BarChart, 
  Bar, 
  PieChart as RechartsPie, 
  Pie, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell 
} from "recharts";

interface DashboardStats {
  // Admin stats
  todaySales?: number;
  activeServices?: number;
  totalCustomers?: number;
  lowStockProducts?: any[];
  totalEmployees?: number;
  totalProducts?: number;
  
  // Inventory Manager stats
  totalInventoryValue?: number;
  recentTransactions?: number;
  
  // Sales Executive stats (service-related)
  completedToday?: number;
  waitingServices?: number;
  totalServiceVisits?: number;
  inquiredServices?: number;
  workingServices?: number;
  activeOrders?: number;
  totalOrders?: number;
  
  // HR Manager stats
  presentToday?: number;
  pendingLeaves?: number;
  activeTasks?: number;
  
  // Service Staff stats
  myOpenTickets?: number;
  resolvedToday?: number;
  urgentTickets?: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Get selected shop from localStorage
  const selectedShopId = localStorage.getItem('selectedShop');
  const shopName = selectedShopId === 'beed' ? 'Shop A - Beed' : selectedShopId === 'ahilyanagar' ? 'Shop B - Chhatrapati Sambhaji Nagar' : 'Shop Not Selected';

  const { data: dashboardStats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats"],
  });

  const { data: serviceVisits, isLoading: visitsLoading, error: visitsError, refetch: refetchVisits } = useQuery<any[]>({
    queryKey: ["/api/service-visits"],
    enabled: user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'Sales Executive',
  });

  const { data: supportTickets, isLoading: ticketsLoading, error: ticketsError, refetch: refetchTickets } = useQuery<any[]>({
    queryKey: ["/api/support-tickets"],
    enabled: user?.role === 'Service Staff',
  });

  const { data: salesTrends = [] } = useQuery<any[]>({
    queryKey: ["/api/dashboard/sales-trends"],
    enabled: user?.role === 'Admin' || user?.role === 'Manager',
  });

  const { data: serviceStatus = [] } = useQuery<any[]>({
    queryKey: ["/api/dashboard/service-status"],
    enabled: user?.role === 'Admin' || user?.role === 'Manager',
  });

  const { data: customerGrowth = [] } = useQuery<any[]>({
    queryKey: ["/api/dashboard/customer-growth"],
    enabled: user?.role === 'Admin' || user?.role === 'Manager',
  });

  const { data: productCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/dashboard/product-categories"],
    enabled: user?.role === 'Admin' || user?.role === 'Manager',
  });

  const activeServices = serviceVisits?.filter((visit: any) => 
    ['inquired', 'working', 'waiting'].includes(visit.status)
  ).slice(0, 3) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Role-based KPI configuration
  const getRoleKPIs = () => {
    if (!user || !dashboardStats) return [];

    switch (user.role) {
      case 'Admin':
        return [
          {
            title: "Today's Sales",
            value: formatCurrency(dashboardStats.todaySales || 0),
            icon: IndianRupee,
            trend: { value: 12.5, isPositive: true },
            color: "blue" as const,
          },
          {
            title: "Active Service Jobs",
            value: dashboardStats.activeServices || 0,
            icon: Package,
            color: "yellow" as const,
          },
          {
            title: "Low Stock Items",
            value: dashboardStats.lowStockProducts?.length || 0,
            icon: AlertTriangle,
            color: "orange" as const,
          },
          {
            title: "Total Customers",
            value: dashboardStats.totalCustomers || 0,
            icon: Users,
            color: "green" as const,
          },
        ];
      
      case 'Manager':
        return [
          {
            title: "Today's Sales",
            value: formatCurrency(dashboardStats.todaySales || 0),
            icon: IndianRupee,
            trend: { value: 12.5, isPositive: true },
            color: "blue" as const,
          },
          {
            title: "Active Service Jobs",
            value: dashboardStats.activeServices || 0,
            icon: Package,
            color: "yellow" as const,
          },
          {
            title: "Total Customers",
            value: dashboardStats.totalCustomers || 0,
            icon: Users,
            color: "green" as const,
          },
          {
            title: "Present Today",
            value: dashboardStats.presentToday || 0,
            icon: UserCheck,
            color: "purple" as const,
          },
          {
            title: "Total Employees",
            value: dashboardStats.totalEmployees || 0,
            icon: UserCircle,
            color: "purple" as const,
          },
          {
            title: "Active Orders",
            value: dashboardStats.activeOrders || 0,
            icon: ShoppingCart,
            color: "orange" as const,
          },
          {
            title: "Pending Leaves",
            value: dashboardStats.pendingLeaves || 0,
            icon: CalendarOff,
            color: "yellow" as const,
          },
          {
            title: "Active Tasks",
            value: dashboardStats.activeTasks || 0,
            icon: CheckSquare,
            color: "pink" as const,
          },
        ];
      
      case 'Inventory Manager':
        return [
          {
            title: "Total Products",
            value: dashboardStats.totalProducts || 0,
            icon: Package,
            color: "purple" as const,
          },
          {
            title: "Inventory Value",
            value: formatCurrency(dashboardStats.totalInventoryValue || 0),
            icon: IndianRupee,
            color: "blue" as const,
          },
          {
            title: "Low Stock Items",
            value: dashboardStats.lowStockProducts?.length || 0,
            icon: AlertTriangle,
            color: "orange" as const,
          },
          {
            title: "Today's Transactions",
            value: dashboardStats.recentTransactions || 0,
            icon: TrendingUp,
            color: "green" as const,
          },
        ];
      
      case 'Sales Executive':
        return [
          {
            title: "Active Service Jobs",
            value: dashboardStats.activeServices || 0,
            icon: Package,
            color: "blue" as const,
          },
          {
            title: "Completed Today",
            value: dashboardStats.completedToday || 0,
            icon: CheckCircle,
            color: "green" as const,
          },
          {
            title: "Waiting Services",
            value: dashboardStats.waitingServices || 0,
            icon: AlertCircle,
            color: "yellow" as const,
          },
          {
            title: "Total Service Visits",
            value: dashboardStats.totalServiceVisits || 0,
            icon: ClipboardCheck,
            color: "purple" as const,
          },
        ];
      
      case 'HR Manager':
        return [
          {
            title: "Total Employees",
            value: dashboardStats.totalEmployees || 0,
            icon: Users,
            color: "blue" as const,
          },
          {
            title: "Present Today",
            value: dashboardStats.presentToday || 0,
            icon: UserCheck,
            color: "green" as const,
          },
          {
            title: "Pending Leaves",
            value: dashboardStats.pendingLeaves || 0,
            icon: FileText,
            color: "yellow" as const,
          },
          {
            title: "Active Tasks",
            value: dashboardStats.activeTasks || 0,
            icon: ClipboardCheck,
            color: "purple" as const,
          },
        ];
      
      case 'Service Staff':
        return [
          {
            title: "My Open Tickets",
            value: dashboardStats.myOpenTickets || 0,
            icon: Ticket,
            color: "blue" as const,
          },
          {
            title: "Resolved Today",
            value: dashboardStats.resolvedToday || 0,
            icon: CheckCircle,
            color: "green" as const,
          },
          {
            title: "Urgent Tickets",
            value: dashboardStats.urgentTickets || 0,
            icon: AlertCircle,
            color: "orange" as const,
          },
        ];
      
      default:
        return [];
    }
  };

  const kpiData = getRoleKPIs();
  const showStatsLoading = statsLoading;
  const showVisitsLoading = visitsLoading && !statsLoading;

  // Role-based welcome message
  const getWelcomeMessage = () => {
    if (!user) return "Welcome back";
    
    switch (user.role) {
      case 'Admin':
        return `Welcome back, ${user.name}`;
      case 'Manager':
        return `Branch Dashboard - ${user.name}`;
      case 'Inventory Manager':
        return `Inventory Overview - ${user.name}`;
      case 'Sales Executive':
        return `Sales Dashboard - ${user.name}`;
      case 'HR Manager':
        return `HR Dashboard - ${user.name}`;
      case 'Service Staff':
        return `My Services - ${user.name}`;
      default:
        return `Welcome back, ${user.name}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1" data-testid="text-welcome">{getWelcomeMessage()}</p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 px-4 py-2 rounded-lg border border-primary/20">
          <Store className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Current Shop</p>
            <p className="font-semibold text-sm" data-testid="text-current-shop">{shopName}</p>
          </div>
        </div>
      </div>

      {statsError && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-sm">Failed to load dashboard statistics</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchStats()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showStatsLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !statsError && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {kpiData.map((kpi) => (
            <KPICard key={kpi.title} {...kpi} />
          ))}
        </div>
      )}

      {/* Analytics Graphs - Admin and Manager */}
      {(user?.role === 'Admin' || user?.role === 'Manager') && !statsError && !showStatsLoading && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sales Trends Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                Sales Trends (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="sales" fill="#3b82f6" name="Sales (₹)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="orders" fill="#10b981" name="Orders" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Service Status Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-purple-500" />
                Service Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={serviceStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {serviceStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Customer Growth Line Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                Customer Growth (6 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={customerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="customers" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    name="Total Customers"
                    dot={{ fill: '#10b981', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Product Categories Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                Product Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart 
                  data={productCategories}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="category" className="text-xs" width={100} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="#f59e0b" name="Products" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Service Jobs - Admin, Manager and Sales Executive */}
        {(user?.role === 'Admin' || user?.role === 'Manager' || user?.role === 'Sales Executive') && (
          <Card>
            <CardHeader>
              <CardTitle>Active Service Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visitsError ? (
                <div className="text-center py-4">
                  <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Failed to load service visits</p>
                  <Button variant="outline" size="sm" onClick={() => refetchVisits()}>Retry</Button>
                </div>
              ) : showVisitsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : (
                <>
                  {activeServices.map((service: any) => (
                    <ServiceWorkflowCard
                      key={service._id}
                      customerName={service.customerId?.name || 'Unknown'}
                      vehicleReg={service.vehicleReg}
                      status={service.status}
                      handlers={[service.handlerId?.name || 'Unassigned']}
                      startTime={formatDistance(new Date(service.createdAt), new Date(), { addSuffix: true })}
                      onView={() => setLocation('/visits')}
                    />
                  ))}
                  {activeServices.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No active service jobs</p>
                  )}
                  <Button variant="outline" className="w-full" data-testid="button-view-all-services" onClick={() => setLocation('/visits')}>
                    View All Services
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Support Tickets - Service Staff only */}
        {user?.role === 'Service Staff' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                My Support Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticketsError ? (
                <div className="text-center py-4">
                  <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Failed to load support tickets</p>
                  <Button variant="outline" size="sm" onClick={() => refetchTickets()}>Retry</Button>
                </div>
              ) : ticketsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : (
                <>
                  {supportTickets?.filter((ticket: any) => 
                    ['pending', 'in_progress'].includes(ticket.status)
                  ).slice(0, 5).map((ticket: any) => (
                    <div
                      key={ticket._id}
                      className="p-3 rounded-lg border border-border hover-elevate cursor-pointer"
                      onClick={() => setLocation('/support')}
                      data-testid={`ticket-${ticket._id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            #{ticket.ticketNumber} • {ticket.customerId?.fullName || 'Unknown'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            ticket.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-200' :
                            ticket.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-200' :
                            ticket.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-200' :
                            'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                          }`}>
                            {ticket.priority}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            ticket.status === 'pending' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-200' :
                            'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-200'
                          }`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{ticket.description}</p>
                    </div>
                  ))}
                  {(!supportTickets || supportTickets.filter((t: any) => ['pending', 'in_progress'].includes(t.status)).length === 0) && (
                    <p className="text-muted-foreground text-center py-4">No open support tickets</p>
                  )}
                  <Button variant="outline" className="w-full" data-testid="button-view-all-tickets" onClick={() => setLocation('/support')}>
                    View All Tickets
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Low Stock Alerts - Admin and Inventory Manager only */}
        {(user?.role === 'Admin' || user?.role === 'Inventory Manager') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsError ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Stock data unavailable</p>
                </div>
              ) : showStatsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboardStats?.lowStockProducts?.map((item: any) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover-elevate"
                      data-testid={`low-stock-${item._id}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Reorder level: {item.minStockLevel}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-warning">{item.stockQty}</p>
                        <p className="text-xs text-muted-foreground">in stock</p>
                      </div>
                    </div>
                  ))}
                  {(!dashboardStats?.lowStockProducts || dashboardStats.lowStockProducts.length === 0) && (
                    <p className="text-muted-foreground text-center py-4">No low stock items</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {user?.role === 'Admin' && (
        <ActivityFeed limit={15} />
      )}
    </div>
  );
}
