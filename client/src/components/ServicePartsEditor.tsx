import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Plus, Search, X, FileText, ClipboardList, Car, AlertTriangle } from "lucide-react";

export interface ServicePart {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  // null for parts outside the catalogue
  stockQty?: number | null;
}

export type PartsSource = "quotation" | "inquiry" | "vehicle" | "manual";

export interface PartsLink {
  partsSource: PartsSource | null;
  quotationId?: string | null;
  inquiryId?: string | null;
}

interface SourceOption {
  type: "quotation" | "inquiry" | "vehicle";
  id?: string;
  label: string;
  status?: string;
  invoiceId?: string;
  parts: ServicePart[];
}

interface PartsPlan {
  current: ServicePart[];
  currentSource: PartsSource | null;
  sources: SourceOption[];
}

interface ServicePartsEditorProps {
  visitId: string;
  parts: ServicePart[];
  link: PartsLink;
  onChange: (parts: ServicePart[], link: PartsLink) => void;
  disabled?: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const sourceIcon = {
  quotation: FileText,
  inquiry: ClipboardList,
  vehicle: Car,
};

const sourceLabel: Record<PartsSource, string> = {
  quotation: "quotation",
  inquiry: "inquiry",
  vehicle: "registration",
  manual: "manual entry",
};

/** Normalise a stored partsUsed entry (productId may be populated). */
export function toServicePart(part: any): ServicePart {
  const product = part?.productId && typeof part.productId === "object" ? part.productId : null;
  return {
    productId: product ? String(product._id) : part?.productId ? String(part.productId) : undefined,
    name: part?.name || product?.productName || "Part",
    quantity: Number(part?.quantity) || 1,
    price: Number(part?.price) || 0,
    stockQty: product ? Number(product.stockQty) || 0 : part?.stockQty ?? null,
  };
}

/** Comparable form of a parts list, ignoring display-only fields. */
export function partsSignature(parts: ServicePart[]) {
  return JSON.stringify(parts.map((p) => [p.productId || null, p.name, p.quantity, p.price]));
}

export function ServicePartsEditor({ visitId, parts, link, onChange, disabled }: ServicePartsEditorProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const autoLoadedFor = useRef<string | null>(null);

  const { data: plan, isLoading } = useQuery<PartsPlan>({
    queryKey: ["/api/service-visits", visitId, "parts-plan"],
    staleTime: 0,
  });

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data: searchResults = [], isFetching: isSearching } = useQuery<any[]>({
    queryKey: ["/api/service-visits/part-search", debouncedSearch],
    queryFn: () =>
      fetch(`/api/service-visits/part-search?q=${encodeURIComponent(debouncedSearch)}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : [])),
    enabled: debouncedSearch.length > 0,
  });

  const linkFor = (source: SourceOption): PartsLink => {
    if (source.type === "quotation") {
      return { partsSource: "quotation", quotationId: source.id, inquiryId: link.inquiryId };
    }
    if (source.type === "inquiry") {
      return { partsSource: "inquiry", inquiryId: source.id, quotationId: null };
    }
    return { partsSource: "vehicle", quotationId: null, inquiryId: null };
  };

  const loadSource = (source: SourceOption) => {
    onChange(source.parts.map((p) => ({ ...p })), linkFor(source));
  };

  // A fresh job card with nothing on it starts from the best record we have.
  useEffect(() => {
    if (!plan || autoLoadedFor.current === visitId) return;
    autoLoadedFor.current = visitId;

    // Refresh stock figures on the parts already on the job card.
    if (plan.current.length > 0) {
      if (partsSignature(plan.current) === partsSignature(parts)) {
        onChange(plan.current, link);
      }
      return;
    }
    if (!link.partsSource && parts.length === 0 && plan.sources.length > 0) {
      loadSource(plan.sources[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, visitId]);

  const manualLink = (): PartsLink => (link.partsSource ? link : { ...link, partsSource: "manual" });

  const updatePart = (index: number, patch: Partial<ServicePart>) => {
    onChange(parts.map((p, i) => (i === index ? { ...p, ...patch } : p)), link);
  };

  const removePart = (index: number) => {
    onChange(parts.filter((_, i) => i !== index), link);
  };

  const addProduct = (product: any) => {
    const existing = parts.findIndex((p) => p.productId === product.productId);
    if (existing >= 0) {
      onChange(parts.map((p, i) => (i === existing ? { ...p, quantity: p.quantity + 1 } : p)), manualLink());
    } else {
      onChange(
        [...parts, { productId: product.productId, name: product.name, quantity: 1, price: product.price, stockQty: product.stockQty }],
        manualLink(),
      );
    }
    setSearch("");
    setDebouncedSearch("");
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    onChange([...parts, { name, quantity: 1, price: 0, stockQty: null }], manualLink());
    setCustomName("");
    setIsAddingCustom(false);
  };

  const total = parts.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.price) || 0), 0);
  const shortParts = parts.filter((p) => p.stockQty != null && p.stockQty < p.quantity);
  const activeSource = plan?.sources.find(
    (s) =>
      (s.type === "quotation" && link.partsSource === "quotation" && s.id === link.quotationId) ||
      (s.type === "inquiry" && link.partsSource === "inquiry" && s.id === link.inquiryId) ||
      (s.type === "vehicle" && link.partsSource === "vehicle"),
  );

  return (
    <div className="space-y-3" data-testid="parts-editor">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Label className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Parts to fit
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            {link.partsSource
              ? `Loaded from ${activeSource?.label || sourceLabel[link.partsSource]}. Edit as the job changes.`
              : "Load from the customer's quotation or inquiry, or add parts from inventory."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : plan && plan.sources.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {plan.sources.map((source) => {
            const Icon = sourceIcon[source.type];
            const isActive = source === activeSource;
            return (
              <Button
                key={`${source.type}-${source.id || "vehicle"}`}
                type="button"
                size="sm"
                variant={isActive ? "secondary" : "outline"}
                onClick={() => loadSource(source)}
                disabled={disabled}
                data-testid={`button-load-parts-${source.type}`}
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />
                {isActive ? "Reload" : "Load"} {source.label}
                {source.status && (
                  <span className="ml-1.5 text-xs text-muted-foreground capitalize">({source.status})</span>
                )}
                <span className="ml-1.5 text-xs text-muted-foreground">· {source.parts.length}</span>
              </Button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No quotation, inquiry or registration parts found for this vehicle.
        </p>
      )}

      {activeSource?.type === "quotation" && activeSource.invoiceId && (
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          This quotation is already converted to an invoice, so this visit won't be billed again.
        </p>
      )}

      <div className="border rounded-md overflow-x-auto">
        {parts.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Part</th>
                <th className="text-left font-medium px-3 py-2 w-20">Qty</th>
                <th className="text-left font-medium px-3 py-2 w-28">Price</th>
                <th className="text-right font-medium px-3 py-2 w-24">Amount</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {parts.map((part, index) => {
                const isShort = part.stockQty != null && part.stockQty < part.quantity;
                return (
                  <tr key={`${part.productId || part.name}-${index}`} className="border-t" data-testid={`part-row-${index}`}>
                    <td className="px-3 py-2 min-w-[180px]">
                      <p className="font-medium">{part.name}</p>
                      <p className={`text-xs ${isShort ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                        {part.stockQty == null
                          ? "Not in inventory"
                          : isShort
                            ? `Only ${part.stockQty} in stock`
                            : `${part.stockQty} in stock`}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={1}
                        value={part.quantity}
                        onChange={(e) => updatePart(index, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                        disabled={disabled}
                        className="h-8 w-16"
                        aria-label={`Quantity for ${part.name}`}
                        data-testid={`input-part-qty-${index}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        value={part.price}
                        onChange={(e) => updatePart(index, { price: Math.max(0, Number(e.target.value) || 0) })}
                        disabled={disabled}
                        className="h-8 w-24"
                        aria-label={`Price for ${part.name}`}
                        data-testid={`input-part-price-${index}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(part.quantity * part.price)}
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removePart(index)}
                        disabled={disabled}
                        aria-label={`Remove ${part.name}`}
                        data-testid={`button-remove-part-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/20">
                <td colSpan={3} className="px-3 py-2 text-sm font-medium">
                  {parts.length} part{parts.length === 1 ? "" : "s"}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums" data-testid="text-parts-total">
                  {formatCurrency(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">No parts on this job yet</p>
        )}
      </div>

      {shortParts.length > 0 && (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          {shortParts.length} part{shortParts.length === 1 ? " is" : "s are"} short on stock. The invoice can't be
          created until stock is available.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Add part from inventory…"
            className="pl-9"
            disabled={disabled}
            data-testid="input-part-search"
          />
          {debouncedSearch && (
            <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
              {isSearching && searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-2">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-2">No matching products</p>
              ) : (
                searchResults.map((product: any) => (
                  <button
                    key={product.productId}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-3"
                    onClick={() => addProduct(product)}
                    data-testid={`option-part-${product.productId}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{product.name}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {[product.brand, product.model].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="text-right flex-shrink-0">
                      <span className="block text-sm tabular-nums">{formatCurrency(product.price)}</span>
                      <Badge variant={product.stockQty > 0 ? "secondary" : "destructive"} className="text-[10px]">
                        {product.stockQty > 0 ? `${product.stockQty} in stock` : "Out of stock"}
                      </Badge>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {isAddingCustom ? (
          <div className="flex gap-2 flex-1">
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="Item name"
              autoFocus
              disabled={disabled}
              data-testid="input-custom-part"
            />
            <Button type="button" onClick={addCustom} disabled={disabled || !customName.trim()}>
              Add
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsAddingCustom(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsAddingCustom(true)}
            disabled={disabled}
            data-testid="button-add-custom-part"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Item not in inventory
          </Button>
        )}
      </div>
    </div>
  );
}
