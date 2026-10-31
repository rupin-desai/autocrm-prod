import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, CalendarRange } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type ContextResponse = {
  company: any;
  financialYear: any;
  companies: any[];
  financialYears: any[];
};

export default function AccountingContextSelector() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<ContextResponse>({
    queryKey: ["/api/accounting/context"],
    queryFn: async () =>
      (
        await fetch("/api/accounting/context", { credentials: "include" })
      ).json(),
  });

  const selectMutation = useMutation({
    mutationFn: async (payload: {
      companyId: string;
      financialYearId?: string;
    }) => (await apiRequest("POST", "/api/accounting/context", payload)).json(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/accounting/context"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/accounting/financial-years"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/accounting/settings"],
      });
      toast({ title: "Accounting context updated" });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to change accounting context",
        description: error.message,
        variant: "destructive",
      }),
  });

  if (isLoading || !data?.companies?.length) return null;

  const changeCompany = (companyId: string) => {
    selectMutation.mutate({ companyId });
  };

  const changeYear = (financialYearId: string) => {
    if (data.company?._id)
      selectMutation.mutate({ companyId: data.company._id, financialYearId });
  };

  return (
    <div
      className="hidden items-center gap-2 md:flex"
      data-testid="accounting-context-selector"
    >
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={data.company?._id || ""}
          onValueChange={changeCompany}
          disabled={selectMutation.isPending}
        >
          <SelectTrigger className="h-8 w-[170px] border-0 px-1 shadow-none">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent>
            {data.companies.map((company) => (
              <SelectItem key={company._id} value={company._id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2">
        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={data.financialYear?._id || ""}
          onValueChange={changeYear}
          disabled={selectMutation.isPending || !data.financialYears?.length}
        >
          <SelectTrigger className="h-8 w-[125px] border-0 px-1 shadow-none">
            <SelectValue placeholder="Financial year" />
          </SelectTrigger>
          <SelectContent>
            {data.financialYears.map((year) => (
              <SelectItem key={year._id} value={year._id}>
                {year.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
