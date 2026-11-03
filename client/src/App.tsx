import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { AuthProvider, useAuth } from "@/lib/auth";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Inventory from "@/pages/Inventory";
import BarcodeInventory from "@/pages/BarcodeInventory";
import ServiceVisits from "@/pages/ServiceVisits";
import Orders from "@/pages/Orders";
import Employees from "@/pages/Employees";
import Attendance from "@/pages/Attendance";
import Reports from "@/pages/Reports";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import Profile from "@/pages/Profile";
import RoleSelection from "@/pages/RoleSelection";
import ShopSelection from "@/pages/ShopSelection";
import UserManagement from "@/pages/UserManagement";
import Tasks from "@/pages/Tasks";
import Leaves from "@/pages/Leaves";
import CustomerRegistration from "@/pages/CustomerRegistration";
import CustomerRegistrationDashboard from "@/pages/CustomerRegistrationDashboard";
import CarMaster from "@/pages/CarMaster";
import Invoices from "@/pages/Invoices";
import SupportFeedback from "@/pages/SupportFeedback";
import CustomerCare from "@/pages/CustomerCare";
import AdvancePayments from "@/pages/AdvancePayments";
import Inquiries from "@/pages/Inquiries";
import WarrantyClaims from "@/pages/WarrantyClaims";
import Quotations from "@/pages/Quotations";
import WebsiteProducts from "@/pages/WebsiteProducts";
import AccountingCompanies from "@/pages/AccountingCompanies";
import AccountingFinancialYears from "@/pages/AccountingFinancialYears";
import AccountingSettings from "@/pages/AccountingSettings";
import AccountingContextSelector from "@/components/AccountingContextSelector";
import AccountGroups from "@/pages/AccountGroups";
import LedgerManagement from "@/pages/LedgerManagement";
import OpeningBalances from "@/pages/OpeningBalances";
import AccountingVouchers from "@/pages/AccountingVouchers";
import SalesAccountingMappings from "@/pages/SalesAccountingMappings";
import SalesAccounting from "@/pages/SalesAccounting";
import CustomerLedger from "@/pages/CustomerLedger";
import SalesReconciliation from "@/pages/SalesReconciliation";
import PurchaseAccounting from "@/pages/PurchaseAccounting";
import InventoryAccounting from "@/pages/InventoryAccounting";
import InventoryMappings from "@/pages/InventoryMappings";
import InventoryReports from "@/pages/InventoryReports";
import InventoryReturns from "@/pages/InventoryReturns";
import FinancialReports from "@/pages/FinancialReports";
import { useEffect } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";

// Route to resource permission mapping
const ROUTE_PERMISSIONS: Record<
  string,
  { resource: string; action: string } | null
> = {
  "/": null, // Dashboard is accessible to all authenticated users
  "/profile": null, // Profile is accessible to all authenticated users
  "/settings": null, // Settings is accessible to all authenticated users
  "/register-customer": { resource: "customers", action: "create" },
  "/registration-dashboard": { resource: "customers", action: "create" },
  "/car-master": { resource: "customers", action: "update" },
  "/products": { resource: "products", action: "read" },
  "/inventory": { resource: "inventory", action: "read" },
  "/barcode-inventory": { resource: "inventory", action: "read" },
  "/orders": { resource: "orders", action: "read" },
  "/employees": { resource: "employees", action: "read" },
  "/attendance": { resource: "attendance", action: "read" },
  "/visits": { resource: "orders", action: "read" }, // Service visits use orders permission
  "/reports": { resource: "reports", action: "read" },
  "/users": { resource: "users", action: "read" }, // User management is admin-only
  "/tasks": { resource: "tasks", action: "read" },
  "/leaves": { resource: "leaves", action: "read" },
  "/invoices": { resource: "invoices", action: "read" },
  "/analytics": { resource: "reports", action: "read" },
  "/support": { resource: "supportTickets", action: "read" },
  "/advance-payments": { resource: "advancePayments", action: "read" },
  "/inquiries": { resource: "inquiries", action: "read" },
  "/warranty-claims": { resource: "warrantyClaims", action: "read" },
  "/quotations": { resource: "quotations", action: "read" },
  "/website-products": { resource: "website", action: "read" },
  "/accounting/companies": { resource: "accounting", action: "read" },
  "/accounting/financial-years": { resource: "accounting", action: "read" },
  "/accounting/settings": { resource: "accounting", action: "read" },
  "/accounting/account-groups": { resource: "accounting", action: "read" },
  "/accounting/ledgers": { resource: "accounting", action: "read" },
  "/accounting/opening-balances": { resource: "accounting", action: "read" },
  "/accounting/vouchers": { resource: "accounting", action: "read" },
  "/accounting/sales-mappings": { resource: "accounting", action: "read" },
  "/accounting/sales": { resource: "accounting", action: "read" },
  "/accounting/customer-ledger": { resource: "accounting", action: "read" },
  "/accounting/reconciliation": { resource: "accounting", action: "read" },
  "/accounting/purchase/suppliers": { resource: "suppliers", action: "read" },
  "/accounting/purchase/bills": { resource: "accounting", action: "read" },
  "/accounting/purchase/mappings": { resource: "accounting", action: "read" },
  "/accounting/purchase/payments": { resource: "accounting", action: "read" },
  "/accounting/purchase/advances": { resource: "accounting", action: "read" },
  "/accounting/purchase/returns": { resource: "accounting", action: "read" },
  "/accounting/purchase/supplier-ledger": {
    resource: "accounting",
    action: "read",
  },
  "/accounting/purchase/reconciliation": {
    resource: "accounting",
    action: "read",
  },
};

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      location !== "/login" &&
      location !== "/select-role" &&
      location !== "/select-shop" &&
      location !== "/forgot-password"
    ) {
      const timer = setTimeout(() => {
        setLocation("/select-shop");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, setLocation, location]);

  // Check route permissions after user is loaded
  useEffect(() => {
    if (user && !isLoading) {
      const routePermission = ROUTE_PERMISSIONS[location];

      // If route requires specific permission, check it
      if (routePermission) {
        const { resource, action } = routePermission;
        const hasAccess = user.permissions?.[resource]?.includes(action);

        if (!hasAccess) {
          // Redirect to dashboard if user doesn't have permission
          setLocation("/");
        }
      }
    }
  }, [user, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/select-shop" component={ShopSelection} />
      <Route path="/select-role" component={RoleSelection} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/users">
        {() => <ProtectedRoute component={UserManagement} />}
      </Route>
      <Route path="/products">
        {() => <ProtectedRoute component={Products} />}
      </Route>
      <Route path="/inventory">
        {() => <ProtectedRoute component={Inventory} />}
      </Route>
      <Route path="/barcode-inventory">
        {() => <ProtectedRoute component={BarcodeInventory} />}
      </Route>
      <Route path="/visits">
        {() => <ProtectedRoute component={ServiceVisits} />}
      </Route>
      <Route path="/orders">
        {() => <ProtectedRoute component={Orders} />}
      </Route>
      <Route path="/employees">
        {() => <ProtectedRoute component={Employees} />}
      </Route>
      <Route path="/attendance">
        {() => <ProtectedRoute component={Attendance} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={Reports} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      <Route path="/tasks">{() => <ProtectedRoute component={Tasks} />}</Route>
      <Route path="/leaves">
        {() => <ProtectedRoute component={Leaves} />}
      </Route>
      <Route path="/invoices">
        {() => <ProtectedRoute component={Invoices} />}
      </Route>
      <Route path="/register-customer">
        {() => <ProtectedRoute component={CustomerRegistration} />}
      </Route>
      <Route path="/registration-dashboard">
        {() => <ProtectedRoute component={CustomerRegistrationDashboard} />}
      </Route>
      <Route path="/car-master">
        {() => <ProtectedRoute component={CarMaster} />}
      </Route>
      <Route path="/analytics">
        {() => <ProtectedRoute component={Analytics} />}
      </Route>
      <Route path="/support">
        {() => <ProtectedRoute component={CustomerCare} />}
      </Route>
      <Route path="/advance-payments">
        {() => <ProtectedRoute component={AdvancePayments} />}
      </Route>
      <Route path="/inquiries">
        {() => <ProtectedRoute component={Inquiries} />}
      </Route>
      <Route path="/warranty-claims">
        {() => <ProtectedRoute component={WarrantyClaims} />}
      </Route>
      <Route path="/quotations">
        {() => <ProtectedRoute component={Quotations} />}
      </Route>
      <Route path="/website-products">
        {() => <ProtectedRoute component={WebsiteProducts} />}
      </Route>
      <Route path="/accounting/companies">
        {() => <ProtectedRoute component={AccountingCompanies} />}
      </Route>
      <Route path="/accounting/financial-years">
        {() => <ProtectedRoute component={AccountingFinancialYears} />}
      </Route>
      <Route path="/accounting/settings">
        {() => <ProtectedRoute component={AccountingSettings} />}
      </Route>
      <Route path="/accounting/account-groups">
        {() => <ProtectedRoute component={AccountGroups} />}
      </Route>
      <Route path="/accounting/ledgers">
        {() => <ProtectedRoute component={LedgerManagement} />}
      </Route>
      <Route path="/accounting/opening-balances">
        {() => <ProtectedRoute component={OpeningBalances} />}
      </Route>
      <Route path="/accounting/vouchers">
        {() => <ProtectedRoute component={AccountingVouchers} />}
      </Route>
      <Route path="/accounting/sales-mappings">
        {() => <ProtectedRoute component={SalesAccountingMappings} />}
      </Route>
      <Route path="/accounting/sales">
        {() => <ProtectedRoute component={SalesAccounting} />}
      </Route>
      <Route path="/accounting/customer-ledger">
        {() => <ProtectedRoute component={CustomerLedger} />}
      </Route>
      <Route path="/accounting/reconciliation">
        {() => <ProtectedRoute component={SalesReconciliation} />}
      </Route>
      <Route path="/accounting/purchase/suppliers">
        {() => <ProtectedRoute component={PurchaseAccounting} />}
      </Route>
      <Route path="/accounting/purchase/bills">
        {() => <ProtectedRoute component={PurchaseAccounting} />}
      </Route>
      <Route path="/accounting/purchase/mappings">
        {() => <ProtectedRoute component={PurchaseAccounting} />}
      </Route>
      <Route path="/accounting/purchase/payments">
        {() => <ProtectedRoute component={PurchaseAccounting} />}
      </Route>
      <Route path="/accounting/purchase/advances">
        {() => <ProtectedRoute component={PurchaseAccounting} />}
      </Route>
      <Route path="/accounting/purchase/returns">
        {() => <ProtectedRoute component={PurchaseAccounting} />}
      </Route>
      <Route path="/accounting/purchase/supplier-ledger">
        {() => <ProtectedRoute component={PurchaseAccounting} />}
      </Route>
      <Route path="/accounting/purchase/reconciliation">
        {() => <ProtectedRoute component={PurchaseAccounting} />}
      </Route>
      <Route path="/accounting/inventory/warehouses">
        {() => <ProtectedRoute component={InventoryAccounting} />}
      </Route>
      <Route path="/accounting/inventory/stock-summary">
        {() => <ProtectedRoute component={InventoryAccounting} />}
      </Route>
      <Route path="/accounting/inventory/stock-ledger">
        {() => <ProtectedRoute component={InventoryAccounting} />}
      </Route>
      <Route path="/accounting/inventory/valuation">
        {() => <ProtectedRoute component={InventoryAccounting} />}
      </Route>
      <Route path="/accounting/inventory/mappings">
        {() => <ProtectedRoute component={InventoryMappings} />}
      </Route>
      <Route path="/accounting/inventory/receipts">
        {() => <ProtectedRoute component={InventoryAccounting} />}
      </Route>
      <Route path="/accounting/inventory/issues">
        {() => <ProtectedRoute component={InventoryAccounting} />}
      </Route>
      <Route path="/accounting/inventory/adjustments">
        {() => <ProtectedRoute component={InventoryAccounting} />}
      </Route>
      <Route path="/accounting/inventory/opening-stock">
        {() => <ProtectedRoute component={InventoryAccounting} />}
      </Route>
      <Route path="/accounting/inventory/transfers">
        {() => <ProtectedRoute component={InventoryAccounting} />}
      </Route>
      <Route path="/accounting/inventory/reconciliation">
        {() => <ProtectedRoute component={InventoryAccounting} />}
      </Route>
      <Route path="/accounting/inventory/reports/purchase-receipts">
        {() => (
          <ProtectedRoute
            component={() => <InventoryReports type="purchase_receipt" />}
          />
        )}
      </Route>
      <Route path="/accounting/inventory/reports/sales-issues">
        {() => (
          <ProtectedRoute
            component={() => <InventoryReports type="sales_issue" />}
          />
        )}
      </Route>
      <Route path="/accounting/inventory/reports/purchase-returns">
        {() => (
          <ProtectedRoute
            component={() => <InventoryReports type="purchase_return" />}
          />
        )}
      </Route>
      <Route path="/accounting/inventory/reports/sales-returns">
        {() => (
          <ProtectedRoute
            component={() => <InventoryReports type="sales_return" />}
          />
        )}
      </Route>
      <Route path="/accounting/inventory/reports/adjustments">
        {() => (
          <ProtectedRoute
            component={() => <InventoryReports type="stock_adjustment" />}
          />
        )}
      </Route>
      <Route path="/accounting/inventory/reports/transfers">
        {() => (
          <ProtectedRoute
            component={() => <InventoryReports type="stock_transfer" />}
          />
        )}
      </Route>
      <Route path="/accounting/inventory/purchase-returns">
        {() => (
          <ProtectedRoute
            component={() => <InventoryReturns kind="purchase" />}
          />
        )}
      </Route>
      <Route path="/accounting/inventory/sales-returns">
        {() => (
          <ProtectedRoute component={() => <InventoryReturns kind="sales" />} />
        )}
      </Route>
      <Route path="/accounting/reports">
        {() => <ProtectedRoute component={FinancialReports} />}
      </Route>
    </Switch>
  );
}

function AppLayout() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const pathname = location.split("?")[0];
  if (
    isLoading ||
    pathname === "/select-shop" ||
    pathname === "/select-role" ||
    pathname === "/login" ||
    pathname === "/forgot-password"
  ) {
    return <Router />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-3 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60 sm:gap-4 sm:px-6">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
              {user?.permissions?.accounting?.includes("read") && (
                <AccountingContextSelector />
              )}
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/profile")}
                  data-testid="button-profile"
                  className="max-w-[10rem] gap-2 sm:max-w-none"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {user.name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                  <span className="hidden sm:inline">{user.name}</span>
                </Button>
              )}
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1680px] p-3 sm:p-6 lg:p-8">
              <Router />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppLayout />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
