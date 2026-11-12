import { ArrowRight, WalletCards } from "lucide-react";
import { Link, useLocation } from "wouter";
import { financeSections } from "@/components/FinanceModuleLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FinanceSectionLanding() {
  const [location] = useLocation();
  const sectionSlug =
    new URLSearchParams(location.split("?")[1] || "").get("section") ||
    financeSections[0].slug;
  const selectedSection =
    financeSections.find((section) => section.slug === sectionSlug) ||
    financeSections[0];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <WalletCards className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Finance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {selectedSection.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a page to continue.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {selectedSection.items.map((item) => (
          <Link key={item.url} href={item.url}>
            <Card className="group cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3 pb-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <item.icon className="h-3.5 w-3.5" />
                </div>
                <CardTitle className="truncate text-[13px] font-medium">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between px-3 pb-3 pt-0 text-[11px] text-muted-foreground">
                <span>Open</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
