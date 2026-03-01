import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download, TrendingUp, Package, Users, DollarSign, FileText, 
  AlertCircle, Shield, MessageSquare, ShoppingCart, Gift, MapPin
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import {
  exportToExcel,
  formatSalesEnhancedForExcel,
  formatCustomersForExcel,
  formatInventoryEnhancedForExcel,
  formatWarrantiesForExcel,
  formatFeedbackForExcel,
  formatEmployeePerformanceForExcel
} from "@/lib/excelExport";

type ReportPeriod = "today" | "week" | "month" | "year";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

interface DashboardData {
  totalSales: number;
  totalInvoices: number;
  lowStockCount: number;
  activeWarranties: number;
  openComplaints: number;
  newCustomers: number;
}

interface SalesEnhancedData {
  invoices: {
    totalInvoices: number;
    totalRevenue: number;
    totalDiscount: number;
    avgInvoiceValue: number;
  };
  coupons: Array<{
    _id: string;
    usageCount: number;
    totalDiscount: number;
  }>;
}

interface CustomerReportData {
  total: number;
  active: number;
  new: number;
  repeat: number;
  referred: number;
  byReferralSource: Array<{
    _id: string;
    count: number;
  }>;
}

interface InventoryEnhancedData {
  brandWise: Array<{
    _id: string;
    totalProducts: number;
    totalStock: number;
    totalValue: number;
    avgPrice: number;
  }>;
  colorWise: Array<{
    _id: string;
    totalProducts: number;
    totalStock: number;
  }>;
  lowStockProducts: Array<any>;
  outOfStockProducts: Array<any>;
  totalInventoryValue: {
    totalValue: number;
    totalItems: number;
    totalProducts: number;
  };
}

interface WarrantyReportData {
  active: number;
  expiring: Array<any>;
  expiringCount: number;
  expired: number;
  byProduct: Array<{
    _id: string;
    count: number;
    activeCount: number;
  }>;
  recentWarranties: Array<any>;
}

interface FeedbackReportData {
  ratingDistribution: Array<{
    _id: number;
    count: number;
  }>;
  byType: Array<{
    _id: string;
    count: number;
    avgRating: number;
  }>;
  byStatus: Array<{
    _id: string;
    count: number;
  }>;
  byPriority: Array<{
    _id: string;
    count: number;
  }>;
  averageRating: number;
  totalRated: number;
  totalComplaints: number;
  openComplaints: number;
  recentFeedback: Array<any>;
}

interface EmployeePerformanceData {
  _id: string;
  totalSales: number;
  orderCount: number;
  avgOrderValue: number;
  employee: {
    name: string;
    role: string;
  };
}

export default function Analytics() {
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("month");
  const { toast } = useToast();

  const getDateRange = (period: ReportPeriod) => {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "week":
        start.setDate(start.getDate() - 7);
        break;
      case "month":
        start.setMonth(start.getMonth() - 1);
        break;
      case "year":
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  };

  const dateRange = getDateRange(selectedPeriod);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/reports/dashboard"],
  });

  const { data: salesEnhanced, isLoading: salesLoading } = useQuery<SalesEnhancedData>({
    queryKey: ["/api/reports/sales-enhanced", selectedPeriod],
    queryFn: async () => {
      const response = await fetch(
        `/api/reports/sales-enhanced?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      if (!response.ok) throw new Error("Failed to fetch sales report");
      return response.json();
    },
  });

  const { data: customers, isLoading: customersLoading } = useQuery<CustomerReportData>({
    queryKey: ["/api/reports/customers"],
  });

  const { data: inventoryEnhanced, isLoading: inventoryLoading } = useQuery<InventoryEnhancedData>({
    queryKey: ["/api/reports/inventory-enhanced"],
  });

  const { data: warranties, isLoading: warrantiesLoading } = useQuery<WarrantyReportData>({
    queryKey: ["/api/reports/warranties"],
  });

  const { data: feedback, isLoading: feedbackLoading } = useQuery<FeedbackReportData>({
    queryKey: ["/api/reports/feedback"],
  });

  const { data: employeePerformance, isLoading: employeeLoading } = useQuery<EmployeePerformanceData[]>({
    queryKey: ["/api/reports/employee-performance"],
  });

  const handleExport = (type: string) => {
    let sheets: any[] = [];
    let filename = "";

    switch (type) {
      case "sales":
        if (salesEnhanced) {
          sheets = formatSalesEnhancedForExcel(salesEnhanced);
        }
        filename = "sales-report";
        break;
      case "customers":
        if (customers) {
          sheets = formatCustomersForExcel(customers);
        }
        filename = "customer-report";
        break;
      case "inventory":
        if (inventoryEnhanced) {
          sheets = formatInventoryEnhancedForExcel(inventoryEnhanced);
        }
        filename = "inventory-report";
        break;
      case "warranties":
        if (warranties) {
          sheets = formatWarrantiesForExcel(warranties);
        }
        filename = "warranty-report";
        break;
      case "feedback":
        if (feedback) {
          sheets = formatFeedbackForExcel(feedback);
        }
        filename = "feedback-report";
        break;
      case "employees":
        if (employeePerformance && employeePerformance.length > 0) {
          sheets = [{
            name: 'Employee Performance',
            data: formatEmployeePerformanceForExcel(employeePerformance)
          }];
        }
        filename = "employee-report";
        break;
      case "all":
        sheets = [];
        if (salesEnhanced) {
          sheets.push(...formatSalesEnhancedForExcel(salesEnhanced));
        }
        if (customers) {
          sheets.push(...formatCustomersForExcel(customers));
        }
        if (inventoryEnhanced) {
          sheets.push(...formatInventoryEnhancedForExcel(inventoryEnhanced));
        }
        if (warranties) {
          sheets.push(...formatWarrantiesForExcel(warranties));
        }
        if (feedback) {
          sheets.push(...formatFeedbackForExcel(feedback));
        }
        if (employeePerformance && employeePerformance.length > 0) {
          sheets.push({
            name: 'Employee Performance',
            data: formatEmployeePerformanceForExcel(employeePerformance)
          });
        }
        filename = "complete-analytics-report";
        break;
    }

    if (sheets.length > 0) {
      exportToExcel(sheets, filename);
      toast({
        title: "Report Exported",
        description: `${filename} has been downloaded as Excel file successfully.`,
      });
    } else {
      toast({
        title: "No Data",
        description: "No data available to export.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6" data-testid="page-analytics">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics & Reports</h1>
          <p className="text-muted-foreground mt-1">Comprehensive business insights and performance metrics</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as ReportPeriod)}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-report-period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleExport("all")} data-testid="button-export-all" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Dashboard Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card data-testid="card-total-sales">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales (30 days)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">₹{(dashboard?.totalSales || 0).toLocaleString('en-IN')}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {dashboard?.totalInvoices || 0} invoices generated
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-new-customers">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{dashboard?.newCustomers || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card data-testid="card-low-stock">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">{dashboard?.lowStockCount || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-warranties">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Warranties</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{dashboard?.activeWarranties || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Currently valid</p>
          </CardContent>
        </Card>

        <Card data-testid="card-open-complaints">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Complaints</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{dashboard?.openComplaints || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Needs resolution</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-invoices">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{dashboard?.totalInvoices || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports Tabs */}
      <Tabs defaultValue="sales" className="space-y-4">
        <div className="w-full overflow-x-auto">
          <TabsList data-testid="tabs-reports" className="w-full justify-start">
            <TabsTrigger value="sales" data-testid="tab-sales">Sales</TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">Customers</TabsTrigger>
            <TabsTrigger value="inventory" data-testid="tab-inventory">Inventory</TabsTrigger>
            <TabsTrigger value="employees" data-testid="tab-employees">Employees</TabsTrigger>
            <TabsTrigger value="warranties" data-testid="tab-warranties">Warranties</TabsTrigger>
            <TabsTrigger value="feedback" data-testid="tab-feedback">Feedback</TabsTrigger>
          </TabsList>
        </div>

        {/* Sales Report */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h2 className="text-2xl font-bold">Sales Report</h2>
            <Button onClick={() => handleExport("sales")} data-testid="button-export-sales" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Sales Report
            </Button>
          </div>

          {salesLoading ? (
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ₹{(salesEnhanced?.invoices?.totalRevenue || 0).toLocaleString('en-IN')}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {salesEnhanced?.invoices?.totalInvoices || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Avg Invoice Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ₹{(salesEnhanced?.invoices?.avgInvoiceValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Discounts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      ₹{(salesEnhanced?.invoices?.totalDiscount || 0).toLocaleString('en-IN')}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {salesEnhanced?.coupons && salesEnhanced.coupons.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Coupon Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {salesEnhanced.coupons.slice(0, 10).map((coupon: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Gift className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium">{coupon._id}</p>
                              <p className="text-sm text-muted-foreground">{coupon.usageCount} uses</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">₹{coupon.totalDiscount.toLocaleString('en-IN')}</p>
                            <p className="text-sm text-muted-foreground">Total discount</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Customer Report */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h2 className="text-2xl font-bold">Customer Report</h2>
            <Button onClick={() => handleExport("customers")} data-testid="button-export-customers" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Customer Report
            </Button>
          </div>

          {customersLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-5">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{customers?.total || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Active</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{customers?.active || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">New (30d)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{customers?.new || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Repeat</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">{customers?.repeat || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Referred</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{customers?.referred || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {customers?.byReferralSource && customers.byReferralSource.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Acquisition Sources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={customers.byReferralSource}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry._id}: ${entry.count}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {customers.byReferralSource.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Inventory Report */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h2 className="text-2xl font-bold">Inventory Report</h2>
            <Button onClick={() => handleExport("inventory")} data-testid="button-export-inventory" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Inventory Report
            </Button>
          </div>

          {inventoryLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ₹{(inventoryEnhanced?.totalInventoryValue?.totalValue || 0).toLocaleString('en-IN')}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {inventoryEnhanced?.totalInventoryValue?.totalProducts || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {inventoryEnhanced?.lowStockProducts?.length || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {inventoryEnhanced?.outOfStockProducts?.length || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {inventoryEnhanced?.brandWise && inventoryEnhanced.brandWise.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Inventory by Brand</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={inventoryEnhanced.brandWise.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="_id" />
                        <YAxis />
                        <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                        <Legend />
                        <Bar dataKey="totalValue" fill="#8884d8" name="Total Value" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {inventoryEnhanced?.colorWise && inventoryEnhanced.colorWise.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Inventory by Color</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={inventoryEnhanced.colorWise.slice(0, 10)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry._id || 'N/A'}: ${entry.totalProducts}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="totalProducts"
                        >
                          {inventoryEnhanced.colorWise.slice(0, 10).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Employee Performance */}
        <TabsContent value="employees" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h2 className="text-2xl font-bold">Employee Performance Report</h2>
            <Button onClick={() => handleExport("employees")} data-testid="button-export-employees" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Employee Report
            </Button>
          </div>

          {employeeLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Sales Performance by Employee</CardTitle>
              </CardHeader>
              <CardContent>
                {employeePerformance && employeePerformance.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={employeePerformance.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="employee.name" />
                        <YAxis />
                        <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                        <Legend />
                        <Bar dataKey="totalSales" fill="#8884d8" name="Total Sales" />
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="mt-6 border rounded-lg overflow-x-auto">
                      <table className="w-full min-w-[700px]">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left">Employee</th>
                            <th className="p-3 text-left">Role</th>
                            <th className="p-3 text-right">Total Sales</th>
                            <th className="p-3 text-right">Orders</th>
                            <th className="p-3 text-right">Avg Order Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeePerformance.map((emp: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="p-3">{emp.employee.name}</td>
                              <td className="p-3">{emp.employee.role}</td>
                              <td className="p-3 text-right">₹{emp.totalSales.toLocaleString('en-IN')}</td>
                              <td className="p-3 text-right">{emp.orderCount}</td>
                              <td className="p-3 text-right">₹{emp.avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No employee performance data available</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Warranty Report */}
        <TabsContent value="warranties" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h2 className="text-2xl font-bold">Warranty Report</h2>
            <Button onClick={() => handleExport("warranties")} data-testid="button-export-warranties" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Warranty Report
            </Button>
          </div>

          {warrantiesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Active Warranties</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{warranties?.active || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Expiring Soon (30d)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{warranties?.expiringCount || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Expired</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{warranties?.expired || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {warranties?.byProduct && warranties.byProduct.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Warranties by Product</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={warranties.byProduct.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="_id" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#8884d8" name="Total Warranties" />
                        <Bar dataKey="activeCount" fill="#82ca9d" name="Active Warranties" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {warranties?.expiring && warranties.expiring.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600">
                      <AlertCircle className="h-5 w-5" />
                      Expiring Warranties (Next 30 Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left">Product</th>
                            <th className="p-3 text-left">Customer</th>
                            <th className="p-3 text-right">Expiry Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {warranties.expiring.slice(0, 10).map((warranty: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="p-3">{warranty.productName}</td>
                              <td className="p-3">{warranty.customerId?.fullName || 'N/A'}</td>
                              <td className="p-3 text-right">
                                {new Date(warranty.endDate).toLocaleDateString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Feedback Report */}
        <TabsContent value="feedback" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h2 className="text-2xl font-bold">Feedback & Complaints Report</h2>
            <Button onClick={() => handleExport("feedback")} data-testid="button-export-feedback" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Feedback Report
            </Button>
          </div>

          {feedbackLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {feedback?.averageRating ? feedback.averageRating.toFixed(1) : '0.0'} / 5.0
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{feedback?.totalRated || 0} ratings</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Complaints</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{feedback?.totalComplaints || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Open Complaints</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{feedback?.openComplaints || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {feedback && feedback.totalComplaints > 0
                        ? (((feedback.totalComplaints - feedback.openComplaints) / feedback.totalComplaints) * 100).toFixed(0)
                        : 0}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {feedback?.ratingDistribution && feedback.ratingDistribution.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Rating Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={feedback.ratingDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="_id" label={{ value: 'Rating', position: 'insideBottom', offset: -5 }} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#8884d8" name="Count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {feedback?.byType && feedback.byType.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Feedback by Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={feedback.byType}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry._id}: ${entry.count}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {feedback.byType.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
