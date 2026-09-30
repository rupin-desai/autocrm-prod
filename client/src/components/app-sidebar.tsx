import {
  LayoutDashboard,
  Package,
  Warehouse,
  Users,
  UserCircle,
  ClipboardList,
  ShoppingCart,
  BarChart3,
  Settings,
  Calendar,
  LockKeyhole,
  User,
  LogOut,
  Shield,
  Building2,
  FileText,
  CheckSquare,
  CalendarOff,
  MessageSquare,
  UserPlus,
  ListChecks,
  Receipt,
  TrendingUp,
  Headset,
  Car,
  Wallet,
  ShieldCheck,
  Globe,
  FileSpreadsheet,
} from "lucide-react";
import logoImage from "@assets/image_1760164042662.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: { resource: string; action: string };
  disabled?: boolean;
  group?: string;
}

const mainMenuItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, group: "dashboard" },
  { title: "Register Customer", url: "/register-customer", icon: UserPlus, permission: { resource: "customers", action: "create" }, group: "customer" },
  { title: "Registration Dashboard", url: "/registration-dashboard", icon: ListChecks, permission: { resource: "customers", action: "create" }, group: "customer" },
  { title: "Car Master", url: "/car-master", icon: Car, permission: { resource: "customers", action: "update" }, group: "customer" },
  { title: "Service Visits", url: "/visits", icon: ClipboardList, permission: { resource: "orders", action: "read" }, group: "service" },
  { title: "Support & Feedback", url: "/support", icon: Headset, permission: { resource: "supportTickets", action: "read" }, group: "support" },
  { title: "Customer Inquiries", url: "/inquiries", icon: ClipboardList, permission: { resource: "inquiries", action: "read" }, group: "customer" },
  { title: "Quotations", url: "/quotations", icon: FileSpreadsheet, permission: { resource: "quotations", action: "read" }, group: "invoice" },
  { title: "Invoices", url: "/invoices", icon: Receipt, permission: { resource: "invoices", action: "read" }, group: "invoice" },
  { title: "Advance Payments", url: "/advance-payments", icon: Wallet, permission: { resource: "advancePayments", action: "read" }, group: "invoice" },
  { title: "Warranty Management", url: "/warranty-claims", icon: ShieldCheck, permission: { resource: "warrantyClaims", action: "read" }, group: "service" },
  { title: "Products", url: "/products", icon: Package, permission: { resource: "products", action: "read" }, group: "inventory" },
  { title: "Inventory", url: "/inventory", icon: Warehouse, permission: { resource: "inventory", action: "read" }, group: "inventory" },
  { title: "Orders", url: "/orders", icon: ShoppingCart, permission: { resource: "orders", action: "read" }, group: "inventory" },
  { title: "Website Products", url: "/website-products", icon: Globe, permission: { resource: "website", action: "read" }, group: "inventory" },
];

const managementItems: MenuItem[] = [
  { title: "Employees", url: "/employees", icon: UserCircle, permission: { resource: "employees", action: "read" }, group: "hr" },
  { title: "Attendance", url: "/attendance", icon: Calendar, permission: { resource: "attendance", action: "read" }, group: "attendance" },
  { title: "Tasks", url: "/tasks", icon: CheckSquare, permission: { resource: "tasks", action: "read" }, group: "tasks" },
  { title: "Leaves", url: "/leaves", icon: CalendarOff, permission: { resource: "leaves", action: "read" }, group: "attendance" },
  { title: "Reports", url: "/reports", icon: BarChart3, permission: { resource: "reports", action: "read" }, group: "reports" },
  { title: "Analytics", url: "/analytics", icon: TrendingUp, permission: { resource: "reports", action: "read" }, group: "reports" },
  { title: "User Management", url: "/users", icon: Shield, permission: { resource: "users", action: "read" }, group: "admin" },
];

const systemItems: MenuItem[] = [
  { title: "Profile", url: "/profile", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  // Helper function to check if user has permission
  const hasPermission = (item: MenuItem) => {
    if (!item.permission) return true; // No permission required
    const { resource, action } = item.permission;
    return user?.permissions?.[resource]?.includes(action) || false;
  };

  // Navigation stays neutral so the active item is the only thing that draws
  // the eye. Group identity is carried by a small icon tint, not a full-width
  // background colour.
  const getGroupIconColor = (group?: string) => {
    const groupColors: Record<string, string> = {
      dashboard: "text-sky-600 dark:text-sky-400",
      customer: "text-emerald-600 dark:text-emerald-400",
      service: "text-violet-600 dark:text-violet-400",
      invoice: "text-amber-600 dark:text-amber-400",
      inventory: "text-cyan-600 dark:text-cyan-400",
      hr: "text-indigo-600 dark:text-indigo-400",
      attendance: "text-teal-600 dark:text-teal-400",
      tasks: "text-pink-600 dark:text-pink-400",
      communication: "text-teal-600 dark:text-teal-400",
      reports: "text-orange-600 dark:text-orange-400",
      admin: "text-rose-600 dark:text-rose-400",
      support: "text-rose-600 dark:text-rose-400",
    };
    return group ? groupColors[group] || "text-muted-foreground" : "text-muted-foreground";
  };

  // One shared shape for every nav row: flat by default, a tinted surface plus
  // a left accent rail when active.
  const navItemClass = (active: boolean) =>
    cn(
      "relative rounded-md transition-colors duration-150",
      "before:absolute before:left-0 before:top-1/2 before:h-0 before:w-[3px] before:-translate-y-1/2",
      "before:rounded-r-full before:bg-sidebar-primary before:transition-all before:duration-200",
      active
        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:h-5"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
    );

  // Filter menu items based on permissions
  const visibleMainMenuItems = mainMenuItems.filter(hasPermission);
  const visibleManagementItems = managementItems.filter(hasPermission);
  const visibleSystemItems = systemItems.filter(hasPermission);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="px-3 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background ring-1 ring-sidebar-border">
            <img src={logoImage} alt="Mauli Car World" className="h-7 w-auto object-contain" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-tight">Mauli Car World</h2>
            <p className="text-[11px] leading-tight text-muted-foreground">Manager v1.0</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {visibleMainMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Main Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleMainMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`link-${item.title.toLowerCase().replace(" ", "-")}`}
                      className={navItemClass(location === item.url)}
                    >
                      <Link href={item.url}>
                        <item.icon className={cn("h-4 w-4 shrink-0", getGroupIconColor(item.group))} />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleManagementItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleManagementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild={!item.disabled}
                      isActive={location === item.url}
                      disabled={item.disabled}
                      data-testid={`link-${item.title.toLowerCase().replace(" ", "-")}`}
                      className={navItemClass(location === item.url)}
                    >
                      {item.disabled ? (
                        <div className="flex items-center gap-2 opacity-50">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
                          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">
                            Soon
                          </Badge>
                        </div>
                      ) : (
                        <Link href={item.url}>
                          <item.icon className={cn("h-4 w-4 shrink-0", getGroupIconColor(item.group))} />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleSystemItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleSystemItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`link-${item.title.toLowerCase()}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start p-2 h-auto" data-testid="button-user-menu">
              <div className="flex items-center gap-3 w-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {user?.name ? getInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.role || 'Role'}</p>
                </div>
                <LockKeyhole className="h-4 w-4 text-muted-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <User className="h-4 w-4 mr-2" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive" data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
