import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Globe, Package, Pencil, Search } from "lucide-react";
import { EmptyState, PageHeader, StatTile, TableSkeleton } from "@/components/PageShell";

// Requirement 8: choose which products appear on the e-commerce website.

const money = (n?: number | null) =>
  n === null || n === undefined ? "-" : `₹${Number(n).toLocaleString("en-IN")}`;

export default function WebsiteProducts() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ websiteTitle: "", websiteDescription: "", websitePrice: "" });

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (search.trim()) params.set("search", search.trim());
    if (visibility !== "all") params.set("visibility", visibility);
    return params.toString();
  }, [search, visibility]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/website/products", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/website/products?${queryString}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/website/products"] });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, showOnWebsite }: { id: string; showOnWebsite: boolean }) => {
      const res = await apiRequest("PATCH", `/api/website/products/${id}`, { showOnWebsite });
      return res.json();
    },
    onSuccess: (p: any) => {
      refresh();
      toast({
        title: p.showOnWebsite ? "Published" : "Hidden",
        description: `"${p.productName}" is ${p.showOnWebsite ? "now visible" : "no longer visible"} on the website.`,
      });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: async (showOnWebsite: boolean) => {
      const res = await apiRequest("POST", "/api/website/products/bulk", {
        productIds: Array.from(selected),
        showOnWebsite,
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      refresh();
      setSelected(new Set());
      toast({ title: "Updated", description: `${result.modified} product(s) updated` });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" }),
  });

  const detailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/website/products/${editing._id}`, {
        showOnWebsite: editing.showOnWebsite,
        websiteTitle: editForm.websiteTitle,
        websiteDescription: editForm.websiteDescription,
        websitePrice: editForm.websitePrice === "" ? null : Number(editForm.websitePrice),
      });
      return res.json();
    },
    onSuccess: () => {
      refresh();
      setEditing(null);
      toast({ title: "Saved", description: "Website details updated" });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" }),
  });

  const items = data?.items || [];
  const allSelected = items.length > 0 && items.every((p: any) => selected.has(p._id));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Globe}
        title="Website Products"
        description="Choose which catalogue items are published to the e-commerce website. Unselected products stay hidden."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Published to website"
          value={data?.publishedCount ?? 0}
          icon={Globe}
          tone="positive"
          testId="text-published-count"
        />
        <StatTile label="Catalogue shown" value={data?.pagination?.total ?? 0} icon={Package} />
        <StatTile
          label="Selected"
          value={selected.size}
          tone={selected.size > 0 ? "accent" : "neutral"}
          sub={selected.size > 0 ? "use the bulk actions above" : undefined}
        />
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[170px]">
              <Label className="text-xs text-muted-foreground">Show</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger data-testid="select-visibility"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  <SelectItem value="shown">On website</SelectItem>
                  <SelectItem value="hidden">Not on website</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[240px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Product, brand, category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-website"
                />
              </div>
            </div>
            {selected.size > 0 && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => bulkMutation.mutate(true)} data-testid="button-bulk-publish">
                  Publish {selected.size}
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate(false)} data-testid="button-bulk-hide">
                  Hide {selected.size}
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products match this filter"
              description="Try a different search term, or switch the visibility filter."
            />
          ) : (
            <div className="table-scroll rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          setSelected(checked ? new Set(items.map((p: any) => p._id)) : new Set())
                        }
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Selling price</TableHead>
                    <TableHead className="text-right">Website price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>On website</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p: any) => (
                    <TableRow key={p._id} data-testid={`row-website-${p._id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(p._id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selected);
                            if (checked) next.add(p._id); else next.delete(p._id);
                            setSelected(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.websiteTitle || p.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.brand}{p.model ? ` · ${p.model}` : ""}
                          {p.websiteTitle && <> · listed as “{p.websiteTitle}”</>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{p.category}</TableCell>
                      <TableCell className="text-right text-sm">{money(p.sellingPrice)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {p.websitePrice ? (
                          <span className="font-medium">{money(p.websitePrice)}</span>
                        ) : (
                          <span className="text-muted-foreground">same</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.stockQty > 0 ? "secondary" : "outline"}>{p.stockQty}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!p.showOnWebsite}
                          onCheckedChange={(showOnWebsite) => toggleMutation.mutate({ id: p._id, showOnWebsite })}
                          data-testid={`switch-website-${p._id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(p);
                            setEditForm({
                              websiteTitle: p.websiteTitle || "",
                              websiteDescription: p.websiteDescription || "",
                              websitePrice: p.websitePrice ? String(p.websitePrice) : "",
                            });
                          }}
                          data-testid={`button-edit-website-${p._id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Website listing</DialogTitle>
            <DialogDescription>
              How "{editing?.productName}" appears on the storefront. Leave blank to use the catalogue values.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Website title</Label>
              <Input
                value={editForm.websiteTitle}
                onChange={(e) => setEditForm({ ...editForm, websiteTitle: e.target.value })}
                placeholder={editing?.productName}
                data-testid="input-website-title"
              />
            </div>
            <div>
              <Label>Website description</Label>
              <Textarea
                value={editForm.websiteDescription}
                onChange={(e) => setEditForm({ ...editForm, websiteDescription: e.target.value })}
                rows={3}
                data-testid="input-website-description"
              />
            </div>
            <div>
              <Label>Website price</Label>
              <Input
                type="number"
                min="0"
                value={editForm.websitePrice}
                onChange={(e) => setEditForm({ ...editForm, websitePrice: e.target.value })}
                placeholder={`Catalogue price: ${editing?.sellingPrice}`}
                data-testid="input-website-price"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to sell at the catalogue price.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label className="text-sm">Show on website</Label>
              <Switch
                checked={!!editing?.showOnWebsite}
                onCheckedChange={(showOnWebsite) => setEditing({ ...editing, showOnWebsite })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => detailMutation.mutate()} disabled={detailMutation.isPending} data-testid="button-save-website">
              {detailMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
