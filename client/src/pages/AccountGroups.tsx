import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FolderTree, RefreshCw, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, EmptyState, TableSkeleton } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const blank = {
  name: "",
  code: "",
  parentGroupId: "",
  rootCategory: "assets",
  normalBalance: "debit",
  description: "",
  status: "active",
};
const categoryLabels: Record<string, string> = {
  assets: "Assets",
  liabilities: "Liabilities",
  equity: "Equity",
  income: "Income",
  expenses: "Expenses",
};

export default function AccountGroups() {
  const { toast } = useToast();
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: context } = useQuery<any>({
    queryKey: ["/api/accounting/context"],
  });
  const companyId = context?.company?._id;
  const {
    data: groups = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ["/api/accounting/account-groups", companyId],
    queryFn: async () =>
      companyId
        ? (
            await fetch(
              `/api/accounting/account-groups?companyId=${companyId}`,
              { credentials: "include" },
            )
          ).json()
        : [],
    enabled: Boolean(companyId),
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["/api/accounting/account-groups"],
    });
  const saveMutation = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          editingId ? "PATCH" : "POST",
          editingId
            ? `/api/accounting/account-groups/${editingId}`
            : "/api/accounting/account-groups",
          editingId
            ? form
            : { ...form, companyId, parentGroupId: form.parentGroupId || null },
        )
      ).json(),
    onSuccess: () => {
      setForm(blank);
      setEditingId(null);
      refresh();
      toast({
        title: editingId ? "Account group updated" : "Account group created",
      });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to save group",
        description: error.message,
        variant: "destructive",
      }),
  });
  const defaultsMutation = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/accounting/account-groups/defaults", {
          companyId,
        })
      ).json(),
    onSuccess: (data) => {
      refresh();
      toast({
        title: "Default groups ready",
        description: `${data.createdCount} groups created.`,
      });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to initialize groups",
        description: error.message,
        variant: "destructive",
      }),
  });
  const roots = useMemo(
    () => groups.filter((group) => !group.parentGroupId),
    [groups],
  );
  const children = (parentId: string) =>
    groups.filter((group) => String(group.parentGroupId) === parentId);
  const renderGroup = (group: any, depth = 0): React.ReactNode => (
    <div key={group._id}>
      <div
        className="flex items-center justify-between gap-3 border-b px-3 py-3"
        style={{ paddingLeft: `${12 + depth * 24}px` }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            {group.code}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{group.name}</p>
            <p className="text-xs text-muted-foreground">
              {categoryLabels[group.rootCategory]} · {group.normalBalance}{" "}
              balance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={group.status === "active" ? "default" : "secondary"}>
            {group.status}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditingId(group._id);
              setForm({
                name: group.name,
                code: group.code,
                parentGroupId: group.parentGroupId || "",
                rootCategory: group.rootCategory,
                normalBalance: group.normalBalance,
                description: group.description || "",
                status: group.status,
              });
            }}
          >
            Edit
          </Button>
        </div>
      </div>
      {children(group._id).map((child) => renderGroup(child, depth + 1))}
    </div>
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Account groups"
        description="Build the company-scoped Chart of Accounts hierarchy."
        icon={FolderTree}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => defaultsMutation.mutate()}
              disabled={!companyId || defaultsMutation.isPending}
            >
              <Sparkles className="h-4 w-4" /> Default groups
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,430px)]">
        <Card>
          <CardHeader>
            <CardTitle>Hierarchy</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-5">
                <TableSkeleton rows={8} />
              </div>
            ) : isError ? (
              <EmptyState
                title="Unable to load account groups"
                action={<Button onClick={() => refetch()}>Try again</Button>}
              />
            ) : groups.length === 0 ? (
              <EmptyState
                icon={FolderTree}
                title="No account groups"
                description="Initialize the practical Indian business defaults or create a group."
              />
            ) : (
              <div>{roots.map((group) => renderGroup(group))}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? "Edit account group" : "Create account group"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Code *</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Parent group</Label>
                <Select
                  value={form.parentGroupId || "none"}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      parentGroupId: value === "none" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Top-level group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Top-level group</SelectItem>
                    {groups
                      .filter((group) => group._id !== editingId)
                      .map((group) => (
                        <SelectItem key={group._id} value={group._id}>
                          {group.code} — {group.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Classification</Label>
                  <Select
                    value={form.rootCategory}
                    onValueChange={(value) =>
                      setForm({ ...form, rootCategory: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Normal balance</Label>
                  <Select
                    value={form.normalBalance}
                    onValueChange={(value) =>
                      setForm({ ...form, normalBalance: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={!companyId || saveMutation.isPending}
                >
                  {saveMutation.isPending
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Create group"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setForm(blank);
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
