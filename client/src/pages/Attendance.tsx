import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, Fingerprint } from "lucide-react";

export default function Attendance() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Attendance Management</h1>
        <p className="text-muted-foreground mt-1">Employee attendance tracking system</p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-5 w-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            The attendance management module is currently under development and will be available soon.
            This feature will include:
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-border">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Manual Attendance</h3>
                <p className="text-sm text-muted-foreground">
                  Track employee check-in and check-out times manually with leave management
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg border border-border">
              <Fingerprint className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Biometric Integration</h3>
                <p className="text-sm text-muted-foreground">
                  Connect with biometric devices for automated attendance tracking
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-info/10 border border-info/20">
            <p className="text-sm text-info">
              This module will be integrated in the next update. Stay tuned for more information.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
