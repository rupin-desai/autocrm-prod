import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import SupportFeedback from "./SupportFeedback";
import WarrantyClaims from "./WarrantyClaims";

/**
 * Unified customer-care workspace. The underlying Support, Feedback and
 * Warranty APIs, URLs, permissions and collections remain unchanged.
 */
export default function CustomerCare() {
  const { user } = useAuth();
  const canReadWarranty = user?.permissions?.warrantyClaims?.includes("read");

  return (
    <div className="container mx-auto p-2 sm:p-4">
      <Tabs defaultValue="support" className="space-y-4">
        <TabsList>
          <TabsTrigger value="support">Support & Feedback</TabsTrigger>
          {canReadWarranty && (
            <TabsTrigger value="warranty">Warranty Management</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="support">
          <SupportFeedback />
        </TabsContent>
        {canReadWarranty && (
          <TabsContent value="warranty">
            <WarrantyClaims />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
