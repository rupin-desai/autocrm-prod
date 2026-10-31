import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Edit, Plus, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, EmptyState, TableSkeleton } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const initialForm = {
  name: "",
  legalName: "",
  address: "",
  city: "",
  state: "",
  pinCode: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  gstin: "",
  pan: "",
};

export default function AccountingCompanies() {
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const {
    data: companies = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({ queryKey: ["/api/accounting/companies"] });
  const createMutation = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/accounting/companies", form)).json(),
    onSuccess: async () => {
      setForm(initialForm);
      await queryClient.invalidateQueries({
        queryKey: ["/api/accounting/companies"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/accounting/context"],
      });
      toast({ title: "Company created" });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to create company",
        description: error.message,
        variant: "destructive",
      }),
  });
  const updateMutation = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "PATCH",
          `/api/accounting/companies/${editingId}`,
          form,
        )
      ).json(),
    onSuccess: async () => {
      setForm(initialForm);
      setEditingId(null);
      await queryClient.invalidateQueries({
        queryKey: ["/api/accounting/companies"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/accounting/context"],
      });
      toast({ title: "Company updated" });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to update company",
        description: error.message,
        variant: "destructive",
      }),
  });
  const update = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Manage legal entities used by accounting."
        icon={Building2}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]">
        <Card>
          <CardHeader>
            <CardTitle>Companies</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={4} />
            ) : isError ? (
              <EmptyState
                title="Unable to load companies"
                action={<Button onClick={() => refetch()}>Try again</Button>}
              />
            ) : companies.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No companies yet"
                description="Create the first accounting company to begin."
              />
            ) : (
              <div className="space-y-3">
                {companies.map((company) => (
                  <div key={company._id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {company.legalName}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {[
                            company.address,
                            company.city,
                            company.state,
                            company.pinCode,
                          ]
                            .filter(Boolean)
                            .join(", ") || "Address not provided"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            company.status === "active"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {company.status}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(company._id);
                            setForm({ ...initialForm, ...company });
                          }}
                          aria-label={`Edit ${company.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {company.contactEmail ||
                        company.contactPhone ||
                        "No contact details"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />{" "}
              {editingId ? "Edit company" : "Add company"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                editingId ? updateMutation.mutate() : createMutation.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Display name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Legal name *</Label>
                  <Input
                    value={form.legalName}
                    onChange={(e) => update("legalName", e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Textarea
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input
                    value={form.state}
                    onChange={(e) => update("state", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>PIN code</Label>
                  <Input
                    value={form.pinCode}
                    onChange={(e) => update("pinCode", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact phone</Label>
                  <Input
                    value={form.contactPhone}
                    onChange={(e) => update("contactPhone", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Contact name</Label>
                  <Input
                    value={form.contactName}
                    onChange={(e) => update("contactName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact email</Label>
                  <Input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => update("contactEmail", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>GSTIN (optional)</Label>
                  <Input
                    value={form.gstin}
                    onChange={(e) => update("gstin", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>PAN (optional)</Label>
                  <Input
                    value={form.pan}
                    onChange={(e) => update("pan", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Create company"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setForm(initialForm);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
