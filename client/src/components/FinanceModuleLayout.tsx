import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ChartNoAxesCombined,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Link2,
  Package,
  Receipt,
  Settings,
  Wallet,
  Warehouse,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { ComponentType, ReactNode } from "react";

export interface FinanceNavItem {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
}

export interface FinanceNavSection {
  slug: string;
  title: string;
  items: FinanceNavItem[];
}

export const financeSections: FinanceNavSection[] = [
  {
    slug: "core-finance",
    title: "Core Finance",
    items: [
      { title: "Companies", url: "/accounting/companies", icon: Building2 },
      {
        title: "Financial Years",
        url: "/accounting/financial-years",
        icon: Calendar,
      },
      {
        title: "Account Groups",
        url: "/accounting/account-groups",
        icon: FileText,
      },
      { title: "Ledgers", url: "/accounting/ledgers", icon: BookOpen },
      {
        title: "Opening Balances",
        url: "/accounting/opening-balances",
        icon: ClipboardList,
      },
      {
        title: "Accounting Settings",
        url: "/accounting/settings",
        icon: Settings,
      },
      { title: "Vouchers", url: "/accounting/vouchers", icon: Receipt },
      {
        title: "Sales Mappings",
        url: "/accounting/sales-mappings",
        icon: Link2,
      },
      {
        title: "Sales Accounting",
        url: "/accounting/sales",
        icon: FileText,
      },
      {
        title: "Customer Ledger",
        url: "/accounting/customer-ledger",
        icon: BookOpen,
      },
      {
        title: "Reconciliation",
        url: "/accounting/reconciliation",
        icon: ClipboardList,
      },
    ],
  },
  {
    slug: "purchasing",
    title: "Purchasing",
    items: [
      {
        title: "Suppliers",
        url: "/accounting/purchase/suppliers",
        icon: Building2,
      },
      {
        title: "Purchase Bills",
        url: "/accounting/purchase/bills",
        icon: FileText,
      },
      {
        title: "Purchase Mappings",
        url: "/accounting/purchase/mappings",
        icon: Link2,
      },
      {
        title: "Supplier Payments",
        url: "/accounting/purchase/payments",
        icon: Wallet,
      },
      {
        title: "Supplier Advances",
        url: "/accounting/purchase/advances",
        icon: Wallet,
      },
      {
        title: "Purchase Returns",
        url: "/accounting/purchase/returns",
        icon: ClipboardList,
      },
      {
        title: "Supplier Ledger",
        url: "/accounting/purchase/supplier-ledger",
        icon: BookOpen,
      },
      {
        title: "Purchase Reconciliation",
        url: "/accounting/purchase/reconciliation",
        icon: ClipboardList,
      },
    ],
  },
  {
    slug: "inventory-accounting",
    title: "Inventory Accounting",
    items: [
      {
        title: "Warehouses",
        url: "/accounting/inventory/warehouses",
        icon: Warehouse,
      },
      {
        title: "Stock Summary",
        url: "/accounting/inventory/stock-summary",
        icon: Package,
      },
      {
        title: "Stock Ledger",
        url: "/accounting/inventory/stock-ledger",
        icon: BookOpen,
      },
      {
        title: "Inventory Valuation",
        url: "/accounting/inventory/valuation",
        icon: BarChart3,
      },
      {
        title: "Inventory Mappings",
        url: "/accounting/inventory/mappings",
        icon: Link2,
      },
      {
        title: "Purchase Receipts",
        url: "/accounting/inventory/receipts",
        icon: ClipboardList,
      },
      {
        title: "Sales Issues",
        url: "/accounting/inventory/issues",
        icon: Package,
      },
      {
        title: "Stock Adjustments",
        url: "/accounting/inventory/adjustments",
        icon: ClipboardList,
      },
      {
        title: "Opening Stock",
        url: "/accounting/inventory/opening-stock",
        icon: FileText,
      },
      {
        title: "Stock Transfers",
        url: "/accounting/inventory/transfers",
        icon: ArrowLeftRight,
      },
      {
        title: "Inventory Reconciliation",
        url: "/accounting/inventory/reconciliation",
        icon: ClipboardList,
      },
      {
        title: "Purchase Returns",
        url: "/accounting/inventory/purchase-returns",
        icon: Receipt,
      },
      {
        title: "Sales Returns",
        url: "/accounting/inventory/sales-returns",
        icon: Receipt,
      },
    ],
  },
  {
    slug: "reports",
    title: "Reports",
    items: [
      {
        title: "Financial Reports",
        url: "/accounting/reports",
        icon: ChartNoAxesCombined,
      },
      {
        title: "Purchase Receipt Report",
        url: "/accounting/inventory/reports/purchase-receipts",
        icon: FileSpreadsheet,
      },
      {
        title: "Sales Issue Report",
        url: "/accounting/inventory/reports/sales-issues",
        icon: FileSpreadsheet,
      },
      {
        title: "Purchase Return Report",
        url: "/accounting/inventory/reports/purchase-returns",
        icon: FileSpreadsheet,
      },
      {
        title: "Sales Return Report",
        url: "/accounting/inventory/reports/sales-returns",
        icon: FileSpreadsheet,
      },
      {
        title: "Stock Adjustment Report",
        url: "/accounting/inventory/reports/adjustments",
        icon: FileSpreadsheet,
      },
      {
        title: "Stock Transfer Report",
        url: "/accounting/inventory/reports/transfers",
        icon: FileSpreadsheet,
      },
    ],
  },
];

export function FinanceModuleLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const pathname = location.split("?")[0];
  const selectedSectionSlug =
    new URLSearchParams(location.split("?")[1] || "").get("section") ||
    financeSections[0].slug;
  const activeItem = financeSections
    .flatMap((section) => section.items)
    .find((item) => item.url === pathname);
  const activeSection = financeSections.find(
    (section) =>
      section.slug === selectedSectionSlug ||
      section.items.some((item) => item.url === pathname),
  );
  const section = activeSection || financeSections[0];
  const sectionHref = `/accounting?section=${section.slug}`;

  return (
    <div className="min-h-[calc(100vh-7rem)]">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/accounting?section=core-finance">Finance</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {activeItem ? (
              <BreadcrumbLink asChild>
                <Link href={sectionHref}>{section.title}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{section.title}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {activeItem && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{activeItem.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      {children}
    </div>
  );
}
