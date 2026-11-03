import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

export interface PartSearchResult {
  productId: string;
  name: string;
  brand?: string;
  model?: string;
  category?: string;
  // Left out by the server for roles that must not see prices.
  price?: number;
  stockQty: number;
}

interface PartSearchInputProps {
  onPick: (product: PartSearchResult) => void;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  // Offer the typed text as a pick when nothing in the catalogue matches.
  onPickCustom?: (name: string) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

/** Search box over the whole parts catalogue (/api/service-visits/part-search). */
export function PartSearchInput({ onPick, placeholder = "Search parts…", disabled, testId = "input-part-search", onPickCustom }: PartSearchInputProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data: searchResults = [], isFetching: isSearching } = useQuery<PartSearchResult[]>({
    queryKey: ["/api/service-visits/part-search", debouncedSearch],
    queryFn: () =>
      fetch(`/api/service-visits/part-search?q=${encodeURIComponent(debouncedSearch)}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : [])),
    enabled: debouncedSearch.length > 0,
  });

  const clear = () => {
    setSearch("");
    setDebouncedSearch("");
  };

  return (
    <div className="relative flex-1">
      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        disabled={disabled}
        data-testid={testId}
      />
      {debouncedSearch && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
          {isSearching && searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-2">Searching…</p>
          ) : searchResults.length === 0 ? (
            onPickCustom ? (
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                onClick={() => {
                  onPickCustom(debouncedSearch);
                  clear();
                }}
                data-testid={`${testId}-use-custom`}
              >
                No matching products. Use “{debouncedSearch}”
              </button>
            ) : (
              <p className="text-sm text-muted-foreground px-3 py-2">No matching products</p>
            )
          ) : (
            searchResults.map((product) => (
              <button
                key={product.productId}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-3"
                onClick={() => {
                  onPick(product);
                  clear();
                }}
                data-testid={`option-part-${product.productId}`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{product.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {[product.brand, product.model].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-right flex-shrink-0">
                  {product.price !== undefined && (
                    <span className="block text-sm tabular-nums">{formatCurrency(product.price)}</span>
                  )}
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
  );
}
