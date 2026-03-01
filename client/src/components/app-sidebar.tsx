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
  { title: "Service Visits", url: "/visits", icon: ClipboardList, permission: { resource: "orders", action: "read" }, group: "service" },
  { title: "Support & Feedback", url: "/support", icon: Headset, permission: { resource: "supportTickets", action: "read" }, group: "support" },
  { title: "Invoices", url: "/invoices", icon: Receipt, permission: { resource: "invoices", action: "read" }, group: "invoice" },
  { title: "Products", url: "/products", icon: Package, permission: { resource: "products", action: "read" }, group: "inventory" },
  { title: "Inventory", url: "/inventory", icon: Warehouse, permission: { resource: "inventory", action: "read" }, group: "inventory" },
  { title: "Orders", url: "/orders", icon: ShoppingCart, permission: { resource: "orders", action: "read" }, group: "inventory" },
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

  // Helper function to get group background color
  const getGroupBgColor = (group?: string) => {
    const groupColors: Record<string, string> = {
      dashboard: "bg-blue-50 dark:bg-blue-900/50 data-[active=true]:bg-blue-100 dark:data-[active=true]:bg-blue-800/70",
      customer: "bg-green-50 dark:bg-green-900/50 data-[active=true]:bg-green-100 dark:data-[active=true]:bg-green-800/70",
      service: "bg-purple-50 dark:bg-purple-900/50 data-[active=true]:bg-purple-100 dark:data-[active=true]:bg-purple-800/70",
      invoice: "bg-orange-50 dark:bg-orange-900/50 data-[active=true]:bg-orange-100 dark:data-[active=true]:bg-orange-800/70",
      inventory: "bg-cyan-50 dark:bg-cyan-900/50 data-[active=true]:bg-cyan-100 dark:data-[active=true]:bg-cyan-800/70",
      hr: "bg-indigo-50 dark:bg-indigo-900/50 data-[active=true]:bg-indigo-100 dark:data-[active=true]:bg-indigo-800/70",
      attendance: "bg-yellow-50 dark:bg-yellow-900/50 data-[active=true]:bg-yellow-100 dark:data-[active=true]:bg-yellow-800/70",
      tasks: "bg-pink-50 dark:bg-pink-900/50 data-[active=true]:bg-pink-100 dark:data-[active=true]:bg-pink-800/70",
      communication: "bg-teal-50 dark:bg-teal-900/50 data-[active=true]:bg-teal-100 dark:data-[active=true]:bg-teal-800/70",
      reports: "bg-amber-50 dark:bg-amber-900/50 data-[active=true]:bg-amber-100 dark:data-[active=true]:bg-amber-800/70",
      admin: "bg-red-50 dark:bg-red-900/50 data-[active=true]:bg-red-100 dark:data-[active=true]:bg-red-800/70",
      support: "bg-rose-50 dark:bg-rose-900/50 data-[active=true]:bg-rose-100 dark:data-[active=true]:bg-rose-800/70",
    };
    return group ? groupColors[group] || "" : "";
  };

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
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Mauli Car World Logo" className="h-10 w-auto" />
          <div>
            <h2 className="text-lg font-semibold">Mauli Car World</h2>
            <p className="text-xs text-muted-foreground">Manager v1.0</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {visibleMainMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleMainMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`link-${item.title.toLowerCase().replace(" ", "-")}`}
                      className={getGroupBgColor(item.group)}
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

        {visibleManagementItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleManagementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild={!item.disabled}
                      isActive={location === item.url}
                      disabled={item.disabled}
                      data-testid={`link-${item.title.toLowerCase().replace(" ", "-")}`}
                      className={getGroupBgColor(item.group)}
                    >
                      {item.disabled ? (
                        <div className="flex items-center gap-2 opacity-50">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          <Badge variant="secondary" className="ml-auto text-xs">
                            Soon
                          </Badge>
                        </div>
                      ) : (
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
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
            <SidebarGroupLabel>System</SidebarGroupLabel>
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
