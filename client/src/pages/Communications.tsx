import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Communications() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: communications = [], isLoading: commLoading, error: commError } = useQuery<any[]>({
    queryKey: ["/api/communication-logs"],
  });

  const { data: feedbacks = [], isLoading: feedbackLoading, error: feedbackError } = useQuery<any[]>({
    queryKey: ["/api/feedbacks"],
  });

  const isLoading = commLoading || feedbackLoading;
  const error = commError || feedbackError;

  const getCommunicationTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      call: "default",
      email: "secondary",
      meeting: "outline",
      message: "outline",
    };
    return <Badge variant={variants[type] || "outline"} data-testid={`type-${type}`}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </Badge>;
  };

  const filteredComms = communications.filter((comm: any) => {
    return comm.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comm.subject?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredFeedbacks = feedbacks.filter((feedback: any) => {
    return feedback.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feedback.subject?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Communications & Feedback</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load communications</h3>
              <p className="text-muted-foreground mb-4">
                {(error as Error)?.message || 'An error occurred while fetching data'}
              </p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Communications & Feedback</h1>
        <Button data-testid="button-create-communication">
          <Plus className="h-4 w-4 mr-2" />
          New Communication
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search communications..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

      {filteredComms.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Communication Logs</h2>
          <div className="grid gap-4">
            {filteredComms.map((comm: any) => (
              <Card key={comm._id} className="hover-elevate" data-testid={`card-comm-${comm._id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{comm.subject}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{comm.customerName}</p>
                    </div>
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-medium">{format(new Date(comm.date), 'dd MMM yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <div className="mt-1">{getCommunicationTypeBadge(comm.type)}</div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-sm mt-1 truncate">{comm.notes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {filteredFeedbacks.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Customer Feedback</h2>
          <div className="grid gap-4">
            {filteredFeedbacks.map((feedback: any) => (
              <Card key={feedback._id} className="hover-elevate" data-testid={`card-feedback-${feedback._id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{feedback.subject}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{feedback.customerName}</p>
                    </div>
                    <Badge variant={feedback.rating >= 4 ? "default" : feedback.rating >= 3 ? "secondary" : "destructive"}>
                      {feedback.rating}/5
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-medium">{format(new Date(feedback.date), 'dd MMM yyyy')}</p>
                    </div>
                    {feedback.comments && (
                      <div>
                        <p className="text-xs text-muted-foreground">Comments</p>
                        <p className="text-sm mt-1">{feedback.comments}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {filteredComms.length === 0 && filteredFeedbacks.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No communications or feedback found.</p>
        </div>
      )}
    </div>
  );
}
