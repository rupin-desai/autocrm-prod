import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type VehicleMasterBrand, type VehicleMasterResponse } from "@/lib/vehicleMaster";
import { Car, Pencil, Plus, Search, Trash2 } from "lucide-react";

type DeleteTarget =
  | { type: "brand"; id: string; name: string }
  | { type: "model"; id: string; name: string };

export default function CarMaster() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<VehicleMasterBrand | null>(null);
  const [editingModel, setEditingModel] = useState<{ id: string; name: string; active: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [brandForm, setBrandForm] = useState({ name: "", active: true });
  const [modelForm, setModelForm] = useState({ name: "", active: true });

  const { data, isLoading, error } = useQuery<VehicleMasterResponse>({
    queryKey: ["/api/vehicle-master", "includeInactive"],
    queryFn: async () => {
      const response = await fetch("/api/vehicle-master?includeInactive=true", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load car master");
      return response.json();
    },
  });

  const brands = data?.brands || [];

  const filteredBrands = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return brands;
    return brands.filter((brand) => {
      if (brand.name.toLowerCase().includes(term)) return true;
      return brand.models.some((model) => model.name.toLowerCase().includes(term));
    });
  }, [brands, searchTerm]);

  const selectedBrand =
    filteredBrands.find((brand) => brand.id === selectedBrandId) ||
    brands.find((brand) => brand.id === selectedBrandId) ||
    filteredBrands[0] ||
    null;

  useEffect(() => {
    if (!selectedBrandId && filteredBrands[0]?.id) {
      setSelectedBrandId(filteredBrands[0].id);
    }
  }, [filteredBrands, selectedBrandId]);

  const refreshVehicleMaster = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/vehicle-master"] });
    queryClient.invalidateQueries({ queryKey: ["/api/vehicle-master", "includeInactive"] });
  };

  const brandMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...brandForm, name: brandForm.name.trim() };
      if (!payload.name) throw new Error("Brand name is required");
      const response = editingBrand
        ? await apiRequest("PATCH", `/api/vehicle-master/brands/${editingBrand.id}`, payload)
        : await apiRequest("POST", "/api/vehicle-master/brands", payload);
      return response.json();
    },
    onSuccess: () => {
      refreshVehicleMaster();
      setBrandDialogOpen(false);
      setEditingBrand(null);
      setBrandForm({ name: "", active: true });
      toast({ title: "Success", description: editingBrand ? "Brand updated successfully" : "Brand created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save brand", variant: "destructive" });
    },
  });

  const modelMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...modelForm, name: modelForm.name.trim(), brandId: selectedBrand?.id };
      if (!selectedBrand?.id) throw new Error("Please select a brand first");
      if (!payload.name) throw new Error("Model name is required");
      const response = editingModel
        ? await apiRequest("PATCH", `/api/vehicle-master/models/${editingModel.id}`, payload)
        : await apiRequest("POST", "/api/vehicle-master/models", payload);
      return response.json();
    },
    onSuccess: () => {
      refreshVehicleMaster();
      setModelDialogOpen(false);
      setEditingModel(null);
      setModelForm({ name: "", active: true });
      toast({ title: "Success", description: editingModel ? "Model updated successfully" : "Model created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save model", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) throw new Error("Nothing selected");
      const url =
        deleteTarget.type === "brand"
          ? `/api/vehicle-master/brands/${deleteTarget.id}`
          : `/api/vehicle-master/models/${deleteTarget.id}`;
      const response = await apiRequest("DELETE", url);
      return response.json();
    },
    onSuccess: () => {
      refreshVehicleMaster();
      setDeleteTarget(null);
      toast({ title: "Success", description: "Deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Delete blocked", description: error.message || "Failed to delete", variant: "destructive" });
    },
  });

  const openCreateBrand = () => {
    setEditingBrand(null);
    setBrandForm({ name: "", active: true });
    setBrandDialogOpen(true);
  };

  const openEditBrand = (brand: VehicleMasterBrand) => {
    setEditingBrand(brand);
    setBrandForm({ name: brand.name, active: brand.active });
    setBrandDialogOpen(true);
  };

  const openCreateModel = () => {
    setEditingModel(null);
    setModelForm({ name: "", active: true });
    setModelDialogOpen(true);
  };

  const openEditModel = (model: { id: string; name: string; active: boolean }) => {
    setEditingModel(model);
    setModelForm({ name: model.name, active: model.active });
    setModelDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="text-center py-10 space-y-3">
            <Car className="mx-auto h-10 w-10 text-destructive" />
            <h2 className="text-xl font-semibold">Failed to load car master</h2>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Car Master</h1>
          <p className="text-muted-foreground">Manage vehicle brands and models used across registration and product compatibility.</p>
        </div>
        <Button onClick={openCreateBrand} data-testid="button-add-brand">
          <Plus className="mr-2 h-4 w-4" />
          Add Brand
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>Brands</CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search brands or models"
                className="pl-9"
                data-testid="input-car-master-search"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredBrands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => setSelectedBrandId(brand.id)}
                className={`w-full rounded-md border px-3 py-3 text-left transition ${selectedBrand?.id === brand.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                data-testid={`button-select-brand-${brand.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{brand.name}</p>
                    <p className="text-xs text-muted-foreground">{brand.models.length} model{brand.models.length === 1 ? "" : "s"}</p>
                  </div>
                  <Badge variant={brand.active ? "default" : "secondary"}>{brand.active ? "Active" : "Inactive"}</Badge>
                </div>
              </button>
            ))}
            {filteredBrands.length === 0 && (
              <p className="text-sm text-muted-foreground">No brands match this search.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>{selectedBrand ? selectedBrand.name : "Select a brand"}</CardTitle>
              <CardDescription>
                {selectedBrand ? "Add, rename, deactivate, or delete models under this brand." : "Choose a brand from the left to manage its models."}
              </CardDescription>
            </div>
            {selectedBrand && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => openEditBrand(selectedBrand)} data-testid="button-edit-brand">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Brand
                </Button>
                <Button variant="outline" onClick={openCreateModel} data-testid="button-add-model">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Model
                </Button>
                <Button variant="destructive" onClick={() => setDeleteTarget({ type: "brand", id: selectedBrand.id, name: selectedBrand.name })} data-testid="button-delete-brand">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Brand
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedBrand ? (
              <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
                Pick a brand to manage its models.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedBrand.models.map((model) => (
                  <div key={model.id} className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between" data-testid={`row-model-${model.id}`}>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{model.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedBrand.name}</p>
                      </div>
                      <Badge variant={model.active ? "default" : "secondary"}>{model.active ? "Active" : "Inactive"}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditModel(model)} data-testid={`button-edit-model-${model.id}`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteTarget({ type: "model", id: model.id, name: model.name })} data-testid={`button-delete-model-${model.id}`}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {selectedBrand.models.length === 0 && (
                  <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
                    No models yet for this brand.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBrand ? "Edit Brand" : "Add Brand"}</DialogTitle>
            <DialogDescription>Manage a brand name and whether it stays available in forms.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Brand Name</Label>
              <Input id="brand-name" value={brandForm.name} onChange={(e) => setBrandForm((current) => ({ ...current, name: e.target.value }))} data-testid="input-brand-name" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive brands stay in admin view but disappear from selection forms.</p>
              </div>
              <Switch checked={brandForm.active} onCheckedChange={(checked) => setBrandForm((current) => ({ ...current, active: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrandDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => brandMutation.mutate()} disabled={brandMutation.isPending}>
              {brandMutation.isPending ? "Saving..." : editingBrand ? "Save Brand" : "Create Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModel ? "Edit Model" : "Add Model"}</DialogTitle>
            <DialogDescription>{selectedBrand ? `Model under ${selectedBrand.name}` : "Select a brand first"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model-name">Model Name</Label>
              <Input id="model-name" value={modelForm.name} onChange={(e) => setModelForm((current) => ({ ...current, name: e.target.value }))} data-testid="input-model-name" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive models stay in admin view but disappear from selection forms.</p>
              </div>
              <Switch checked={modelForm.active} onCheckedChange={(checked) => setModelForm((current) => ({ ...current, active: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModelDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => modelMutation.mutate()} disabled={modelMutation.isPending || !selectedBrand}>
              {modelMutation.isPending ? "Saving..." : editingModel ? "Save Model" : "Create Model"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === "brand" ? "Brand" : "Model"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `This will permanently remove "${deleteTarget.name}" if it is not already in use.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
