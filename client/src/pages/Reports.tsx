import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, TrendingUp, Package, Users, DollarSign, FileText, Calendar, TrendingDown, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  exportToExcel, 
  formatSalesDataForExcel, 
  formatInventoryDataForExcel, 
  formatTopProductsForExcel, 
  formatEmployeePerformanceForExcel 
} from "@/lib/excelExport";

type ReportPeriod = "today" | "week" | "month" | "year";

interface SalesReportData {
  _id: { year: number; month: number; day?: number };
  totalSales: number;
  totalOrders: number;
  avgOrderValue: number;
}

interface InventoryReportData {
  lowStockProducts: any[];
  outOfStockProducts: any[];
  totalInventoryValue: {
    totalValue: number;
    totalItems: number;
  };
}

interface TopProductData {
  _id: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  product: {
    name: string;
    category: string;
  };
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

export default function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("month");
  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean;
    type: string;
    title: string;
  }>({ open: false, type: "", title: "" });
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

  const { data: salesReport, isLoading: salesLoading } = useQuery<SalesReportData[]>({
    queryKey: ["/api/reports/sales", selectedPeriod],
    queryFn: async () => {
      const response = await fetch(
        `/api/reports/sales?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&period=${selectedPeriod === "month" || selectedPeriod === "year" ? "monthly" : "daily"}`
      );
      if (!response.ok) throw new Error("Failed to fetch sales report");
      return response.json();
    },
  });

  const { data: inventoryReport, isLoading: inventoryLoading } = useQuery<InventoryReportData>({
    queryKey: ["/api/reports/inventory"],
  });

  const { data: topProducts, isLoading: topProductsLoading } = useQuery<TopProductData[]>({
    queryKey: ["/api/reports/top-products"],
  });

  const { data: employeePerformance, isLoading: employeeLoading } = useQuery<EmployeePerformanceData[]>({
    queryKey: ["/api/reports/employee-performance"],
  });

  const totalSales = salesReport?.reduce((sum, item) => sum + item.totalSales, 0) || 0;
  const totalOrders = salesReport?.reduce((sum, item) => sum + item.totalOrders, 0) || 0;
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  const reportCards = [
    {
      title: "Sales Report",
      description: "Total sales and order analysis",
      icon: DollarSign,
      value: `₹${totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      period: `${totalOrders} Orders`,
      isLoading: salesLoading,
      type: "sales",
    },
    {
      title: "Inventory Status",
      description: "Stock levels and inventory value",
      icon: Package,
      value: `₹${(inventoryReport?.totalInventoryValue.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      period: `${inventoryReport?.totalInventoryValue.totalItems || 0} Items`,
      isLoading: inventoryLoading,
      type: "inventory",
    },
    {
      title: "Top Products",
      description: "Best selling products and revenue",
      icon: TrendingUp,
      value: `${topProducts?.length || 0}`,
      period: "Products Sold",
      isLoading: topProductsLoading,
      type: "products",
    },
    {
      title: "Employee Performance",
      description: "Sales team performance metrics",
      icon: Users,
      value: `${employeePerformance?.length || 0}`,
      period: "Active Salespeople",
      isLoading: employeeLoading,
      type: "employee",
    },
  ];

  const handleExport = (type: string) => {
    let sheets: any[] = [];
    let filename = "";

    switch (type) {
      case "sales":
        if (salesReport && salesReport.length > 0) {
          sheets = [{
            name: 'Sales Report',
            data: formatSalesDataForExcel(salesReport)
          }];
        }
        filename = "sales-report";
        break;
      case "inventory":
        if (inventoryReport) {
          sheets = formatInventoryDataForExcel(inventoryReport);
        }
        filename = "inventory-report";
        break;
      case "products":
        if (topProducts && topProducts.length > 0) {
          sheets = [{
            name: 'Top Products',
            data: formatTopProductsForExcel(topProducts)
          }];
        }
        filename = "top-products-report";
        break;
      case "employee":
        if (employeePerformance && employeePerformance.length > 0) {
          sheets = [{
            name: 'Employee Performance',
            data: formatEmployeePerformanceForExcel(employeePerformance)
          }];
        }
        filename = "employee-performance-report";
        break;
      case "all":
        sheets = [];
        if (salesReport && salesReport.length > 0) {
          sheets.push({
            name: 'Sales Report',
            data: formatSalesDataForExcel(salesReport)
          });
        }
        if (topProducts && topProducts.length > 0) {
          sheets.push({
            name: 'Top Products',
            data: formatTopProductsForExcel(topProducts)
          });
        }
        if (employeePerformance && employeePerformance.length > 0) {
          sheets.push({
            name: 'Employee Performance',
            data: formatEmployeePerformanceForExcel(employeePerformance)
          });
        }
        if (inventoryReport) {
          const inventorySheets = formatInventoryDataForExcel(inventoryReport);
          sheets.push(...inventorySheets);
        }
        filename = "complete-report";
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

  const openDetails = (type: string, title: string) => {
    setDetailsDialog({ open: true, type, title });
  };

  return (
    <div className="space-y-6 p-3 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Business insights and performance metrics</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
          <Button variant="outline" onClick={() => handleExport("all")} data-testid="button-export-report" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {reportCards.map((report) => (
          <Card
            key={report.title}
            className="hover-elevate cursor-pointer"
            data-testid={`report-${report.title.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => openDetails(report.type, report.title)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <report.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{report.title}</h3>
                  <p className="text-sm text-muted-foreground font-normal mt-1">
                    {report.description}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : (
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold">{report.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{report.period}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetails(report.type, report.title);
                    }}
                    data-testid={`button-view-${report.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    View Details
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Inventory Alerts */}
      {inventoryReport && (inventoryReport.lowStockProducts.length > 0 || inventoryReport.outOfStockProducts.length > 0) && (
        <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertCircle className="h-5 w-5" />
              Inventory Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inventoryReport.outOfStockProducts.length > 0 && (
              <div className="text-sm">
                <span className="font-semibold text-red-600 dark:text-red-400">Out of Stock:</span>{" "}
                {inventoryReport.outOfStockProducts.length} products
              </div>
            )}
            {inventoryReport.lowStockProducts.length > 0 && (
              <div className="text-sm">
                <span className="font-semibold text-orange-600 dark:text-orange-400">Low Stock:</span>{" "}
                {inventoryReport.lowStockProducts.length} products
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Additional Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border hover-elevate">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <span className="font-medium">Average Order Value</span>
                <p className="text-sm text-muted-foreground">₹{avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("sales")}
              data-testid="button-generate-profit/loss-summary"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border hover-elevate">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <span className="font-medium">Stock Status Overview</span>
                <p className="text-sm text-muted-foreground">
                  {inventoryReport?.lowStockProducts.length || 0} low stock,{" "}
                  {inventoryReport?.outOfStockProducts.length || 0} out of stock
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("inventory")}
              data-testid="button-generate-stock-aging-report"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border hover-elevate">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <span className="font-medium">Top Performing Salesperson</span>
                <p className="text-sm text-muted-foreground">
                  {employeePerformance?.[0]?.employee?.name || "N/A"}
                  {employeePerformance?.[0]?.totalSales ? ` - ₹${employeePerformance[0].totalSales.toLocaleString('en-IN')}` : ""}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("employee")}
              data-testid="button-generate-employee-performance"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border hover-elevate">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <span className="font-medium">Top Selling Product</span>
                <p className="text-sm text-muted-foreground">
                  {topProducts?.[0]?.product?.name || "N/A"}
                  {topProducts?.[0]?.totalRevenue ? ` - ₹${topProducts[0].totalRevenue.toLocaleString('en-IN')}` : ""}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("products")}
              data-testid="button-generate-payment-due-summary"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border hover-elevate">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <span className="font-medium">Period Analysis</span>
                <p className="text-sm text-muted-foreground">
                  {selectedPeriod === "today" ? "Today" : selectedPeriod === "week" ? "Last 7 days" : selectedPeriod === "month" ? "Last 30 days" : "Last year"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("all")}
              data-testid="button-generate-service-completion-rate"
            >
              <Download className="h-4 w-4 mr-2" />
              Export All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsDialog.open} onOpenChange={(open) => setDetailsDialog({ ...detailsDialog, open })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailsDialog.title} - Detailed View</DialogTitle>
          </DialogHeader>

          {detailsDialog.type === "sales" && salesReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">₹{totalSales.toLocaleString('en-IN')}</div>
                    <div className="text-sm text-muted-foreground">Total Sales</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{totalOrders}</div>
                    <div className="text-sm text-muted-foreground">Total Orders</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">₹{avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    <div className="text-sm text-muted-foreground">Avg Order Value</div>
                  </CardContent>
                </Card>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Period</th>
                      <th className="p-3 text-right">Sales</th>
                      <th className="p-3 text-right">Orders</th>
                      <th className="p-3 text-right">Avg Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesReport.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-3">
                          {item._id.day ? `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}` : `${item._id.year}-${String(item._id.month).padStart(2, '0')}`}
                        </td>
                        <td className="p-3 text-right">₹{item.totalSales.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right">{item.totalOrders}</td>
                        <td className="p-3 text-right">₹{item.avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detailsDialog.type === "inventory" && inventoryReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">₹{inventoryReport.totalInventoryValue.totalValue.toLocaleString('en-IN')}</div>
                    <div className="text-sm text-muted-foreground">Total Value</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{inventoryReport.lowStockProducts.length}</div>
                    <div className="text-sm text-muted-foreground">Low Stock</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{inventoryReport.outOfStockProducts.length}</div>
                    <div className="text-sm text-muted-foreground">Out of Stock</div>
                  </CardContent>
                </Card>
              </div>
              {inventoryReport.lowStockProducts.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Low Stock Products</h3>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full min-w-[400px]">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-3 text-left">Product</th>
                          <th className="p-3 text-right">Stock</th>
                          <th className="p-3 text-right">Min Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryReport.lowStockProducts.slice(0, 10).map((product, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-3">{product.name}</td>
                            <td className="p-3 text-right">{product.stockQty}</td>
                            <td className="p-3 text-right">{product.minStockLevel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {detailsDialog.type === "products" && topProducts && (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Product</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-3">{product.product.name}</td>
                      <td className="p-3">{product.product.category}</td>
                      <td className="p-3 text-right">{product.totalQuantity}</td>
                      <td className="p-3 text-right">₹{product.totalRevenue.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {detailsDialog.type === "employee" && employeePerformance && (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Employee</th>
                    <th className="p-3 text-left">Role</th>
                    <th className="p-3 text-right">Total Sales</th>
                    <th className="p-3 text-right">Orders</th>
                    <th className="p-3 text-right">Avg Value</th>
                  </tr>
                </thead>
                <tbody>
                  {employeePerformance.map((emp, idx) => (
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
          )}

          <div className="flex justify-end">
            <Button onClick={() => handleExport(detailsDialog.type)} data-testid="button-export-detailed-report">
              <Download className="h-4 w-4 mr-2" />
              Export This Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
