import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calculator, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const defaults = {
  journal: { prefix: "JV", padding: 4, includeFinancialYear: true },
  payment: { prefix: "PV", padding: 4, includeFinancialYear: true },
  receipt: { prefix: "RV", padding: 4, includeFinancialYear: true },
  contra: { prefix: "CV", padding: 4, includeFinancialYear: true },
};

export default function AccountingSettings() {
  const { toast } = useToast();
  const { data: context } = useQuery<any>({
    queryKey: ["/api/accounting/context"],
  });
  const companyId = context?.company?._id;
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/accounting/settings", companyId],
    queryFn: async () =>
      (
        await fetch(`/api/accounting/settings?companyId=${companyId}`, {
          credentials: "include",
        })
      ).json(),
    enabled: Boolean(companyId),
  });
  const [numbering, setNumbering] = useState(defaults);
  useEffect(() => {
    if (data?.voucherNumbering) setNumbering(data.voucherNumbering);
  }, [data]);
  const saveMutation = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "PATCH",
          `/api/accounting/settings?companyId=${companyId}`,
          { voucherNumbering: numbering },
        )
      ).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/settings"] });
      toast({ title: "Accounting settings saved" });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to save settings",
        description: error.message,
        variant: "destructive",
      }),
  });
  const update = (
    type: keyof typeof numbering,
    key: "prefix" | "padding",
    value: string,
  ) =>
    setNumbering((current) => ({
      ...current,
      [type]: {
        ...current[type],
        [key]: key === "padding" ? Number(value) : value,
      },
    }));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting settings"
        description="Configure the Phase 1 accounting foundation."
        icon={Calculator}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company accounting configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Country</Label>
                <Input value="India" readOnly />
              </div>
              <div>
                <Label>Currency</Label>
                <Input value="INR (₹)" readOnly />
              </div>
              <div>
                <Label>Minor unit</Label>
                <Input value="Paise (2 decimals)" readOnly />
              </div>
              <div>
                <Label>Financial year</Label>
                <Input value="April 1 – March 31" readOnly />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              These foundation settings are fixed by the approved business
              decisions. GST and taxation calculations remain in the existing
              CRM flows.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="h-4 w-4" /> Voucher numbering
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading settings...
              </p>
            ) : (
              <div className="space-y-4">
                {(Object.keys(numbering) as Array<keyof typeof numbering>).map(
                  (type) => (
                    <div
                      key={type}
                      className="grid grid-cols-[1fr_120px] gap-3"
                    >
                      <div>
                        <Label className="capitalize">{type} prefix</Label>
                        <Input
                          value={numbering[type].prefix}
                          onChange={(e) =>
                            update(type, "prefix", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>Padding</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={numbering[type].padding}
                          onChange={(e) =>
                            update(type, "padding", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  ),
                )}
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!companyId || saveMutation.isPending}
                >
                  {saveMutation.isPending
                    ? "Saving..."
                    : "Save numbering settings"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
