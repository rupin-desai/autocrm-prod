import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Search, MessageSquare, Send, Star, Check, ChevronsUpDown, User, Phone, Mail, MapPin, Eye, Edit, Trash2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function SupportFeedback() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [ticketSearchQuery, setTicketSearchQuery] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [newTicketForm, setNewTicketForm] = useState({
    customerId: "",
    subject: "",
    description: "",
    category: "general",
    priority: "medium"
  });
  const [newNote, setNewNote] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTicketForm, setEditTicketForm] = useState<any>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);

  const { data: tickets = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/support-tickets"],
    queryFn: () => fetch('/api/support-tickets').then(res => res.json()),
  });

  const { data: ticketSearchResults, isLoading: isSearchingTickets } = useQuery({
    queryKey: ["/api/support-tickets/search", ticketSearchQuery],
    queryFn: () => fetch(`/api/support-tickets/search?query=${ticketSearchQuery}`).then(res => res.json()),
    enabled: ticketSearchQuery.length > 2
  });

  const displayedTickets = ticketSearchQuery.length > 2 && ticketSearchResults?.tickets 
    ? ticketSearchResults.tickets 
    : tickets;

  const isLoadingTickets = ticketSearchQuery.length > 2 ? isSearchingTickets : isLoading;

  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery<any[]>({
    queryKey: ["/api/registration/customers"],
    queryFn: () => fetch('/api/registration/customers').then(res => res.json()),
  });

  const filteredCustomers = customerSearchQuery
    ? customers.filter((c: any) => 
        c.fullName?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        c.referenceCode?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(customerSearchQuery.toLowerCase())
      )
    : customers;

  const { data: feedbackAnalytics } = useQuery<any>({
    queryKey: ["/api/feedbacks/analytics/ratings"],
  });

  const ticketsByStatus = {
    pending: displayedTickets.filter((t: any) => t.status === 'pending'),
    in_progress: displayedTickets.filter((t: any) => t.status === 'in_progress'),
    resolved: displayedTickets.filter((t: any) => t.status === 'resolved'),
    closed: displayedTickets.filter((t: any) => t.status === 'closed'),
  };

  const statuses = [
    { id: "pending", label: "Pending", count: ticketsByStatus.pending.length, color: "text-yellow-700 dark:text-yellow-400", bgColor: "bg-yellow-50 dark:bg-yellow-950/20", borderColor: "border-yellow-300 dark:border-yellow-700" },
    { id: "in_progress", label: "In Progress", count: ticketsByStatus.in_progress.length, color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/20", borderColor: "border-blue-300 dark:border-blue-700" },
    { id: "resolved", label: "Resolved", count: ticketsByStatus.resolved.length, color: "text-green-700 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950/20", borderColor: "border-green-300 dark:border-green-700" },
    { id: "closed", label: "Closed", count: ticketsByStatus.closed.length, color: "text-gray-700 dark:text-gray-400", bgColor: "bg-gray-50 dark:bg-gray-950/20", borderColor: "border-gray-300 dark:border-gray-700" },
  ];

  const createTicketMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/support-tickets', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/support-tickets/search'] });
      setIsCreateDialogOpen(false);
      setCustomerSearchQuery("");
      setSelectedCustomer(null);
      setNewTicketForm({
        customerId: "",
        subject: "",
        description: "",
        category: "general",
        priority: "medium"
      });
      toast({
        title: "Success",
        description: "Support ticket created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create ticket",
        variant: "destructive",
      });
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await apiRequest('PATCH', `/api/support-tickets/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/support-tickets/search'] });
      refetch();
      toast({
        title: "Success",
        description: "Ticket updated successfully",
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const response = await apiRequest('POST', `/api/support-tickets/${id}/notes`, { note });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/support-tickets/search'] });
      setSelectedTicket(data);
      setNewNote("");
      toast({
        title: "Success",
        description: "Note added successfully",
      });
    },
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/support-tickets/${id}/send-whatsapp`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "WhatsApp follow-up marked as sent (dummy)",
      });
    },
  });

  const sendFeedbackMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/support-tickets/${id}/send-feedback`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Feedback form link sent (dummy)",
      });
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/support-tickets/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/support-tickets/search'] });
      setIsViewDialogOpen(false);
      setSelectedTicket(null);
      toast({
        title: "Success",
        description: "Support ticket deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete ticket",
        variant: "destructive",
      });
    },
  });

  const editTicketMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await apiRequest('PATCH', `/api/support-tickets/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/support-tickets/search'] });
      setIsEditDialogOpen(false);
      setEditTicketForm(null);
      toast({
        title: "Success",
        description: "Ticket updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update ticket",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
      in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
      resolved: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
      closed: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20"
    };
    return <Badge className={styles[status as keyof typeof styles] || ""}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      low: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
      medium: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
      high: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
      urgent: "bg-red-500/10 text-red-700 dark:text-red-400"
    };
    return <Badge variant="outline" className={styles[priority as keyof typeof styles] || ""}>{priority}</Badge>;
  };

  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer);
    setNewTicketForm({
      ...newTicketForm,
      customerId: customer.id || customer._id
    });
    setOpenCustomerCombobox(false);
  };

  const handleEditClick = (ticket: any) => {
    setEditTicketForm({
      id: ticket._id,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status
    });
    setIsViewDialogOpen(false);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setTicketToDelete(id);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = () => {
    if (ticketToDelete) {
      deleteTicketMutation.mutate(ticketToDelete);
      setIsDeleteAlertOpen(false);
      setTicketToDelete(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Support & Feedback</h1>
          <p className="text-muted-foreground">Manage customer support tickets and feedback</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-ticket">
              <Plus className="h-4 w-4 mr-2" />
              Create Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
              <DialogDescription>Log a new customer support ticket</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Customer *</Label>
                <Popover open={openCustomerCombobox} onOpenChange={setOpenCustomerCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCustomerCombobox}
                      className="w-full justify-between"
                      data-testid="button-select-customer"
                    >
                      {selectedCustomer ? (
                        <span className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {selectedCustomer.fullName} ({selectedCustomer.referenceCode})
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Search and select customer...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[600px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search by name, ID, or email..." 
                        value={customerSearchQuery}
                        onValueChange={setCustomerSearchQuery}
                        data-testid="input-customer-search"
                      />
                      <CommandList>
                        <CommandEmpty>
                          {isLoadingCustomers ? "Loading customers..." : "No customers found."}
                        </CommandEmpty>
                        <CommandGroup heading="Recent Customers (Latest First)">
                          {filteredCustomers.slice(0, 50).map((customer: any) => (
                            <CommandItem
                              key={customer.id || customer._id}
                              value={`${customer.fullName} ${customer.referenceCode} ${customer.mobileNumber} ${customer.email}`}
                              onSelect={() => handleCustomerSelect(customer)}
                              data-testid={`customer-option-${customer.referenceCode}`}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCustomer?.id === customer.id || selectedCustomer?._id === customer._id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{customer.fullName}</span>
                                  <Badge variant="outline" className="text-xs">{customer.referenceCode}</Badge>
                                  {customer.isVerified && <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">Verified</Badge>}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {customer.email}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {customer.city}
                                  </span>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedCustomer && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Customer ID</Label>
                        <p className="font-medium">{selectedCustomer.referenceCode}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Email</Label>
                        <p className="font-medium">{selectedCustomer.email}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Location</Label>
                        <p className="font-medium">{selectedCustomer.city}, {selectedCustomer.district}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Address</Label>
                        <p className="font-medium">{selectedCustomer.address}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input
                  data-testid="input-subject"
                  placeholder="Brief description of the issue"
                  value={newTicketForm.subject}
                  onChange={(e) => setNewTicketForm({...newTicketForm, subject: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  data-testid="input-description"
                  placeholder="Detailed description of the issue"
                  value={newTicketForm.description}
                  onChange={(e) => setNewTicketForm({...newTicketForm, description: e.target.value})}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newTicketForm.category} onValueChange={(val) => setNewTicketForm({...newTicketForm, category: val})}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service_quality">Service Quality</SelectItem>
                      <SelectItem value="product_issue">Product Issue</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="parts_warranty">Parts/Warranty</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={newTicketForm.priority} onValueChange={(val) => setNewTicketForm({...newTicketForm, priority: val})}>
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={() => createTicketMutation.mutate(newTicketForm)}
                disabled={!newTicketForm.customerId || !newTicketForm.subject || !newTicketForm.description || createTicketMutation.isPending}
                className="w-full"
                data-testid="button-submit-ticket"
              >
                {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tickets">Support Tickets</TabsTrigger>
          <TabsTrigger value="analytics">Feedback Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Quick Search
              </CardTitle>
              <CardDescription>Search by Customer ID, Vehicle Number, or Ticket Number</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                data-testid="input-search-tickets"
                placeholder="Enter Customer ID, Vehicle Number, or Ticket Number..."
                value={ticketSearchQuery}
                onChange={(e) => setTicketSearchQuery(e.target.value)}
              />
            </CardContent>
          </Card>

          <div className="flex gap-2 flex-wrap">
            {statuses.map((status) => (
              <Badge
                key={status.id}
                variant="outline"
                className="text-sm py-1.5 px-3"
                data-testid={`badge-${status.id}`}
              >
                {status.label} ({status.count})
              </Badge>
            ))}
          </div>

          {isLoadingTickets ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {statuses.map((status) => (
                <Card key={status.id} className={`border-2 ${status.borderColor}`} data-testid={`card-status-${status.id}`}>
                  <CardHeader className={`pb-4 border-b ${status.bgColor}`}>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <div className={`flex items-center gap-2 ${status.color}`}>
                        <MessageSquare className="h-5 w-5" />
                        {status.label}
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {status.count}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {ticketsByStatus[status.id as keyof typeof ticketsByStatus].length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {ticketsByStatus[status.id as keyof typeof ticketsByStatus].map((ticket: any) => (
                          <Card key={ticket._id} className={`border ${status.borderColor} ${status.bgColor} hover:shadow-md transition-shadow`} data-testid={`card-ticket-${ticket.ticketNumber}`}>
                            <CardContent className="p-4 space-y-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="font-mono text-xs">{ticket.ticketNumber}</Badge>
                                  {getPriorityBadge(ticket.priority)}
                                </div>
                                <h3 className="font-semibold text-sm line-clamp-1">{ticket.subject}</h3>
                                <p className="text-xs text-muted-foreground line-clamp-2">{ticket.description}</p>
                              </div>

                              <div className="space-y-1 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{ticket.customerId?.fullName || 'Unknown'}</span>
                                  {ticket.customerId?.referenceCode && (
                                    <span className="text-xs opacity-70">({ticket.customerId.referenceCode})</span>
                                  )}
                                </div>
                                <div>
                                  {formatDistance(new Date(ticket.createdAt), new Date(), { addSuffix: true })}
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => { setSelectedTicket(ticket); setIsViewDialogOpen(true); }}
                                  data-testid={`button-view-${ticket.ticketNumber}`}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-8" data-testid={`empty-${status.id}`}>
                        No tickets in {status.label.toLowerCase()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Star className="h-8 w-8 fill-yellow-400 text-yellow-400" />
                  <div className="text-2xl font-bold">
                    {feedbackAnalytics?.overallStats?.averageRating?.toFixed(1) || 'N/A'}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Feedbacks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{feedbackAnalytics?.overallStats?.totalFeedbacks || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">5-Star Ratings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{feedbackAnalytics?.overallStats?.rating5 || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">1-Star Ratings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{feedbackAnalytics?.overallStats?.rating1 || 0}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket Details - {selectedTicket?.ticketNumber}</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedTicket.customerId?.fullName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Select 
                      value={selectedTicket.status} 
                      onValueChange={(val) => updateTicketMutation.mutate({ id: selectedTicket._id, updates: { status: val } })}
                    >
                      <SelectTrigger data-testid="select-ticket-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Subject</Label>
                <p className="font-medium">{selectedTicket.subject}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p>{selectedTicket.description}</p>
              </div>

              <div>
                <Label className="mb-2 block">Notes</Label>
                <div className="space-y-2 mb-4">
                  {selectedTicket.notes?.map((note: any, idx: number) => (
                    <div key={idx} className="bg-muted p-3 rounded-md">
                      <p className="text-sm">{note.note}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {note.addedBy?.name || 'Unknown'} - {formatDistance(new Date(note.addedAt), new Date(), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    data-testid="input-new-note"
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                  />
                  <Button 
                    onClick={() => addNoteMutation.mutate({ id: selectedTicket._id, note: newNote })}
                    disabled={!newNote || addNoteMutation.isPending}
                    data-testid="button-add-note"
                  >
                    Add Note
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  onClick={() => handleEditClick(selectedTicket)}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-edit-ticket"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Ticket
                </Button>
                <Button 
                  onClick={() => handleDeleteClick(selectedTicket._id)}
                  disabled={deleteTicketMutation.isPending}
                  variant="destructive"
                  data-testid="button-delete-ticket"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Ticket</DialogTitle>
            <DialogDescription>Update the ticket details</DialogDescription>
          </DialogHeader>
          {editTicketForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input
                  data-testid="input-edit-subject"
                  placeholder="Brief description of the issue"
                  value={editTicketForm.subject}
                  onChange={(e) => setEditTicketForm({...editTicketForm, subject: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  data-testid="input-edit-description"
                  placeholder="Detailed description of the issue"
                  value={editTicketForm.description}
                  onChange={(e) => setEditTicketForm({...editTicketForm, description: e.target.value})}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={editTicketForm.category} onValueChange={(val) => setEditTicketForm({...editTicketForm, category: val})}>
                    <SelectTrigger data-testid="select-edit-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service_quality">Service Quality</SelectItem>
                      <SelectItem value="product_issue">Product Issue</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="parts_warranty">Parts/Warranty</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={editTicketForm.priority} onValueChange={(val) => setEditTicketForm({...editTicketForm, priority: val})}>
                    <SelectTrigger data-testid="select-edit-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editTicketForm.status} onValueChange={(val) => setEditTicketForm({...editTicketForm, status: val})}>
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    editTicketMutation.mutate({ 
                      id: editTicketForm.id, 
                      updates: {
                        subject: editTicketForm.subject,
                        description: editTicketForm.description,
                        category: editTicketForm.category,
                        priority: editTicketForm.priority,
                        status: editTicketForm.status
                      }
                    });
                  }}
                  disabled={!editTicketForm.subject || !editTicketForm.description || editTicketMutation.isPending}
                  className="flex-1"
                  data-testid="button-submit-edit"
                >
                  {editTicketMutation.isPending ? "Updating..." : "Update Ticket"}
                </Button>
                <Button 
                  onClick={() => setIsEditDialogOpen(false)}
                  variant="outline"
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent data-testid="alert-delete-ticket">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Support Ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this support ticket? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteTicketMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteTicketMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
