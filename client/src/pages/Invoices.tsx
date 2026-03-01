import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { FileText, DollarSign, CheckCircle, XCircle, Clock, Filter, Eye, CreditCard, Download, Trash2, Upload } from "lucide-react";
import { format } from "date-fns";
import { PaymentRecordingDialog } from "@/components/PaymentRecordingDialog";
import { InvoiceGenerationDialog } from "@/components/InvoiceGenerationDialog";

interface Invoice {
  _id: string;
  invoiceNumber: string;
  customerName?: string;
  customerId: { fullName: string; mobileNumber: string; email: string };
  customerDetails?: {
    fullName: string;
    mobileNumber: string;
    email?: string;
    referenceCode?: string;
    address?: string;
  };
  vehicleDetails?: Array<{
    vehicleId?: string;
    vehicleNumber?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    customModel?: string;
    variant?: string;
    color?: string;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod?: 'UPI' | 'Cash' | 'Card' | 'Net Banking' | 'Cheque';
  createdAt: string;
  createdBy: { name: string };
  approvalStatus?: {
    approvedBy?: { name: string };
    rejectedBy?: { name: string };
    rejectionReason?: string;
  };
}

export default function Invoices() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showWarrantyDialog, setShowWarrantyDialog] = useState(false);
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'UPI' | 'Cash' | 'Card' | 'Net Banking' | 'Cheque'>('Cash');
  const [showManualInvoiceDialog, setShowManualInvoiceDialog] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showInvoiceGenerationDialog, setShowInvoiceGenerationDialog] = useState(false);
  const [selectedServiceForInvoice, setSelectedServiceForInvoice] = useState<any>(null);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices', statusFilter, paymentFilter, searchQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (paymentFilter !== 'all') params.append('paymentStatus', paymentFilter);
      if (searchQuery) params.append('search', searchQuery);
      return fetch(`/api/invoices?${params}`).then(res => res.json());
    },
  });

  const { data: completedServices = [] } = useQuery<any[]>({
    queryKey: ['/api/service-visits/completed'],
    queryFn: async () => {
      const response = await fetch(`/api/service-visits/completed`, { credentials: 'include' });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const handleOpenInvoiceGeneration = (customerId: string) => {
    // Find the completed service for this customer
    const completedService = completedServices.find(service => service.customerId?._id === customerId);
    
    if (!completedService) {
      toast({ title: "No completed service found for this customer", variant: "destructive" });
      return;
    }
    
    setSelectedServiceForInvoice(completedService);
    setShowManualInvoiceDialog(false);
    setShowInvoiceGenerationDialog(true);
  };

  const approveMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      console.log('🚀 [FRONTEND] Starting invoice approval process');
      console.log('   Invoice ID:', invoiceId);
      console.log('   Timestamp:', new Date().toISOString());
      
      const response = await apiRequest('POST', `/api/invoices/${invoiceId}/approve`, {});
      const data = await response.json();
      
      console.log('✅ [FRONTEND] Approval API request completed');
      console.log('   Response data:', data);
      
      return data;
    },
    onSuccess: (data: any, invoiceId) => {
      console.log('🎉 [FRONTEND] Invoice approval successful!');
      console.log('   Invoice ID:', invoiceId);
      console.log('   Response data:', data);
      console.log('   Notifications sent:', {
        email: data?.notificationsSent?.email,
        emailSentAt: data?.notificationsSent?.emailSentAt,
        whatsapp: data?.notificationsSent?.whatsapp,
        whatsappSentAt: data?.notificationsSent?.whatsappSentAt,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ title: "Invoice approved successfully" });
      setShowApprovalDialog(false);
      setSelectedInvoice(null);
    },
    onError: (error: any, invoiceId) => {
      console.error('❌ [FRONTEND] Invoice approval failed');
      console.error('   Invoice ID:', invoiceId);
      console.error('   Error:', error);
      console.error('   Error message:', error?.message);
      console.error('   Error details:', error?.response?.data);
      
      toast({ title: "Failed to approve invoice", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason: string }) =>
      apiRequest('POST', `/api/invoices/${invoiceId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ title: "Invoice rejected" });
      setShowRejectDialog(false);
      setSelectedInvoice(null);
      setRejectionReason('');
    },
    onError: () => {
      toast({ title: "Failed to reject invoice", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (invoiceId: string) => apiRequest('DELETE', `/api/invoices/${invoiceId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ title: "Invoice deleted successfully" });
      setShowDeleteDialog(false);
      setSelectedInvoice(null);
    },
    onError: () => {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    },
  });

  const togglePaidStatusMutation = useMutation({
    mutationFn: ({ invoiceId, currentStatus, paymentMethod }: { invoiceId: string; currentStatus: string; paymentMethod?: string }) => {
      const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
      return apiRequest('PATCH', `/api/invoices/${invoiceId}/payment-status`, { 
        paymentStatus: newStatus,
        paymentMethod: newStatus === 'paid' ? paymentMethod : undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ title: "Payment status updated" });
      setShowPaymentMethodDialog(false);
    },
    onError: () => {
      toast({ title: "Failed to update payment status", variant: "destructive" });
    },
  });

  const handleMarkPaid = (invoice: Invoice) => {
    if (invoice.paymentStatus === 'paid') {
      togglePaidStatusMutation.mutate({ 
        invoiceId: invoice._id, 
        currentStatus: invoice.paymentStatus 
      });
    } else {
      setSelectedInvoice(invoice);
      setShowPaymentDialog(true);
    }
  };

  const confirmMarkPaid = () => {
    if (selectedInvoice) {
      togglePaidStatusMutation.mutate({
        invoiceId: selectedInvoice._id,
        currentStatus: selectedInvoice.paymentStatus,
        paymentMethod: selectedPaymentMethod,
      });
    }
  };

  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "PDF downloaded successfully" });
    } catch (error) {
      toast({ title: "Failed to download PDF", variant: "destructive" });
    }
  };

  const handleViewPDF = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to load PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      toast({ title: "Invoice opened in new tab" });
    } catch (error) {
      toast({ title: "Failed to view PDF", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      pending_approval: { variant: "outline", label: "Pending Approval" },
      approved: { variant: "default", label: "Approved" },
      rejected: { variant: "destructive", label: "Rejected" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant} data-testid={`badge-status-${status}`}>{config.label}</Badge>;
  };

  const getPaymentBadge = (paymentStatus: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      unpaid: { variant: "destructive", label: "Unpaid" },
      partial: { variant: "outline", label: "Partial" },
      paid: { variant: "default", label: "Paid" },
    };
    const config = variants[paymentStatus] || { variant: "outline" as const, label: paymentStatus };
    return <Badge variant={config.variant} data-testid={`badge-payment-${paymentStatus}`}>{config.label}</Badge>;
  };

  // Search is now handled by the backend, so we just use the invoices directly
  const filteredInvoices = invoices;

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="heading-invoices">Invoices & Billing</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage invoices, payments, and billing</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <div>
                <CardTitle>All Invoices</CardTitle>
                <CardDescription>View and manage invoices</CardDescription>
              </div>
            </div>
            {(user?.role === 'Admin' || user?.role === 'Manager') && (
              <Button 
                onClick={() => setShowManualInvoiceDialog(true)}
                data-testid="button-create-manual-invoice"
              >
                <FileText className="h-4 w-4 mr-2" />
                Create Manual Invoice
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Input
              placeholder="Search by invoice number or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
              data-testid="input-search-invoice"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-payment-filter">
                <SelectValue placeholder="Filter by payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {isLoading ? (
              <div className="text-center py-8">Loading invoices...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No invoices found</div>
            ) : (
              filteredInvoices.map((invoice) => (
                <Card key={invoice._id} className="p-4" data-testid={`card-invoice-${invoice._id}`}>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-lg" data-testid={`text-invoice-number-${invoice._id}`}>
                          {invoice.invoiceNumber}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {invoice.customerId?.fullName || invoice.customerName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(invoice.createdAt), 'dd MMM yyyy')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">₹{invoice.totalAmount.toLocaleString()}</div>
                        {invoice.dueAmount > 0 && (
                          <div className="text-sm text-destructive">Due: ₹{invoice.dueAmount.toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap items-center">
                      {getStatusBadge(invoice.status)}
                      <div className="flex flex-col gap-1">
                        {getPaymentBadge(invoice.paymentStatus)}
                        {invoice.paymentStatus === 'paid' && invoice.paymentMethod && (
                          <span className="text-xs text-muted-foreground" data-testid={`text-payment-method-mobile-${invoice._id}`}>
                            via {invoice.paymentMethod}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {(user?.role === 'Admin' || user?.role === 'Manager') && invoice.status === 'pending_approval' && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowApprovalDialog(true);
                            }}
                            data-testid={`button-approve-${invoice._id}`}
                            className="flex-1"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowRejectDialog(true);
                            }}
                            data-testid={`button-reject-${invoice._id}`}
                            className="flex-1"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewPDF(invoice._id)}
                        data-testid={`button-view-${invoice._id}`}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {invoice.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadPDF(invoice._id)}
                          data-testid={`button-download-${invoice._id}`}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      )}
                      {user?.role === 'Admin' && invoice.status === 'approved' && (
                        <Button
                          size="sm"
                          variant={invoice.paymentStatus === 'paid' ? 'secondary' : 'default'}
                          onClick={() => handleMarkPaid(invoice)}
                          disabled={togglePaidStatusMutation.isPending}
                          data-testid={`button-toggle-paid-${invoice._id}`}
                          className="flex-1"
                        >
                          {invoice.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                        </Button>
                      )}
                      {invoice.paymentStatus === 'paid' && invoice.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowWarrantyDialog(true);
                          }}
                          data-testid={`button-warranty-${invoice._id}`}
                          className="flex-1"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Warranty
                        </Button>
                      )}
                      {user?.role === 'Admin' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowDeleteDialog(true);
                          }}
                          data-testid={`button-delete-${invoice._id}`}
                          className="flex-1"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-sky-100 dark:bg-sky-900 hover:bg-sky-100 dark:hover:bg-sky-900">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading invoices...
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice._id} data-testid={`row-invoice-${invoice._id}`}>
                      <TableCell className="font-medium" data-testid={`text-invoice-number-${invoice._id}`}>
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        {invoice.customerId?.fullName || invoice.customerName}
                      </TableCell>
                      <TableCell>₹{invoice.totalAmount.toLocaleString()}</TableCell>
                      <TableCell>₹{invoice.paidAmount.toLocaleString()}</TableCell>
                      <TableCell>₹{invoice.dueAmount.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getPaymentBadge(invoice.paymentStatus)}
                          {invoice.paymentStatus === 'paid' && invoice.paymentMethod && (
                            <span className="text-xs text-muted-foreground" data-testid={`text-payment-method-${invoice._id}`}>
                              via {invoice.paymentMethod}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(invoice.createdAt), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {(user?.role === 'Admin' || user?.role === 'Manager') && invoice.status === 'pending_approval' && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowApprovalDialog(true);
                              }}
                              data-testid={`button-approve-${invoice._id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowRejectDialog(true);
                              }}
                              data-testid={`button-reject-${invoice._id}`}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewPDF(invoice._id)}
                          data-testid={`button-view-${invoice._id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {invoice.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPDF(invoice._id)}
                            data-testid={`button-download-${invoice._id}`}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        )}
                        {user?.role === 'Admin' && invoice.status === 'approved' && (
                          <Button
                            size="sm"
                            variant={invoice.paymentStatus === 'paid' ? 'secondary' : 'default'}
                            onClick={() => handleMarkPaid(invoice)}
                            disabled={togglePaidStatusMutation.isPending}
                            data-testid={`button-toggle-paid-${invoice._id}`}
                          >
                            {invoice.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                          </Button>
                        )}
                        {invoice.paymentStatus === 'paid' && invoice.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowWarrantyDialog(true);
                            }}
                            data-testid={`button-warranty-${invoice._id}`}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Warranty Cards
                          </Button>
                        )}
                        {user?.role === 'Admin' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowDeleteDialog(true);
                            }}
                            data-testid={`button-delete-${invoice._id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent data-testid="dialog-approve-invoice">
          <DialogHeader>
            <DialogTitle>Approve Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve invoice {selectedInvoice?.invoiceNumber}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)} data-testid="button-cancel-approve">
              Cancel
            </Button>
            <Button
              onClick={() => selectedInvoice && approveMutation.mutate(selectedInvoice._id)}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Approving..." : "Approve Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent data-testid="dialog-reject-invoice">
          <DialogHeader>
            <DialogTitle>Reject Invoice</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting invoice {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            data-testid="textarea-rejection-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedInvoice && rejectMutation.mutate({ invoiceId: selectedInvoice._id, reason: rejectionReason })}
              disabled={rejectMutation.isPending || !rejectionReason}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      {selectedInvoice && (
        <PaymentRecordingDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          invoice={selectedInvoice}
        />
      )}

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent data-testid="dialog-delete-invoice">
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete invoice {selectedInvoice?.invoiceNumber}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedInvoice && deleteMutation.mutate(selectedInvoice._id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method Selection Dialog */}
      <Dialog open={showPaymentMethodDialog} onOpenChange={setShowPaymentMethodDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-payment-method">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Select Payment Method
            </DialogTitle>
            <DialogDescription>
              Choose how the payment was received for invoice {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={selectedPaymentMethod} onValueChange={(value: any) => setSelectedPaymentMethod(value)}>
                <SelectTrigger data-testid="select-payment-method-dialog">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      UPI
                    </div>
                  </SelectItem>
                  <SelectItem value="Cash">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Cash
                    </div>
                  </SelectItem>
                  <SelectItem value="Card">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-purple-600" />
                      Debit/Credit Card
                    </div>
                  </SelectItem>
                  <SelectItem value="Net Banking">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-orange-600" />
                      Net Banking
                    </div>
                  </SelectItem>
                  <SelectItem value="Cheque">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-600" />
                      Cheque
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPaymentMethodDialog(false)}
              data-testid="button-cancel-payment-method"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmMarkPaid}
              disabled={togglePaidStatusMutation.isPending}
              data-testid="button-confirm-payment-method"
              className="w-full sm:w-auto"
            >
              {togglePaidStatusMutation.isPending ? "Processing..." : "Mark as Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Generation Dialog */}
      {selectedServiceForInvoice && (
        <InvoiceGenerationDialog
          open={showInvoiceGenerationDialog}
          onOpenChange={setShowInvoiceGenerationDialog}
          serviceVisit={selectedServiceForInvoice}
        />
      )}

      {/* Warranty Cards Dialog */}
      {selectedInvoice && (
        <WarrantyCardDialog
          open={showWarrantyDialog}
          onOpenChange={setShowWarrantyDialog}
          invoiceId={selectedInvoice._id}
          invoiceNumber={selectedInvoice.invoiceNumber}
        />
      )}

      {/* Manual Invoice Creation Dialog */}
      <Dialog open={showManualInvoiceDialog} onOpenChange={setShowManualInvoiceDialog}>
        <DialogContent data-testid="dialog-create-manual-invoice">
          <DialogHeader>
            <DialogTitle>Create Manual Invoice</DialogTitle>
            <DialogDescription>
              Select a customer whose service is completed to create an invoice
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger data-testid="select-customer-for-invoice">
                <SelectValue placeholder="Select a customer..." />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(completedServices) && completedServices.length > 0 ? (
                  completedServices.map((service: any) => (
                    <SelectItem key={service.customerId?._id} value={service.customerId?._id || ''}>
                      {service.customerId?.fullName || 'Unknown'} - {service.vehicleReg || 'N/A'}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="empty" disabled>No completed services available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowManualInvoiceDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => handleOpenInvoiceGeneration(selectedCustomerId)}
              disabled={!selectedCustomerId}
              data-testid="button-confirm-manual-invoice"
            >
              Generate Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface Product {
  itemIndex: number;
  productId: string;
  name: string;
  description?: string;
  quantity: number;
  hasWarranty: boolean;
  warrantyCards: Array<{ url: string; filename: string; uploadedAt: string }>;
}

interface WarrantyCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
}

function WarrantyCardDialog({ open, onOpenChange, invoiceId, invoiceNumber }: WarrantyCardDialogProps) {
  const { toast } = useToast();
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['/api/invoices', invoiceId, 'products'],
    queryFn: () => fetch(`/api/invoices/${invoiceId}/products`, { credentials: 'include' }).then(res => res.json()),
    enabled: open,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ itemIndex, file }: { itemIndex: number; file: File }) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            const response = await apiRequest('POST', `/api/invoices/${invoiceId}/warranty-cards`, {
              itemIndex,
              warrantyCardData: base64Data,
              filename: file.name,
            });
            resolve(response);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId, 'products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/registration/customers'] });
      toast({ title: "Warranty card uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to upload warranty card", variant: "destructive" });
    },
  });

  const handleFileSelect = (itemIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(jpeg|jpg|png|gif|webp)|application\/pdf/)) {
      toast({ title: "Please select an image or PDF file", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File size must be less than 5MB", variant: "destructive" });
      return;
    }

    uploadMutation.mutate({ itemIndex, file });
  };

  const handleViewWarrantyCard = (url: string, filename: string) => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${filename}</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
              img, embed { max-width: 100%; max-height: 100vh; }
            </style>
          </head>
          <body>
            ${url.startsWith('data:application/pdf') 
              ? `<embed src="${url}" type="application/pdf" width="100%" height="100%" />`
              : `<img src="${url}" alt="${filename}" />`
            }
          </body>
        </html>
      `);
    }
  };

  const products: Product[] = productsData?.products || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-warranty-cards">
        <DialogHeader>
          <DialogTitle>Upload Warranty Cards</DialogTitle>
          <DialogDescription>
            Upload warranty cards for products in invoice {invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No products found in this invoice.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload warranty card documents for each product. The warranty cards will be synced to the customer's vehicle records.
            </p>
            
            <div className="space-y-3">
              {products.map((product) => (
                <Card key={product.itemIndex} className="p-4" data-testid={`card-product-${product.itemIndex}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm" data-testid={`text-product-name-${product.itemIndex}`}>
                        {product.name}
                      </h4>
                      {product.description && (
                        <p className="text-xs text-muted-foreground mt-1">{product.description}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          Qty: {product.quantity}
                        </Badge>
                        {product.hasWarranty && (
                          <Badge variant="default" className="text-xs">
                            Has Warranty
                          </Badge>
                        )}
                      </div>
                      
                      {product.warrantyCards.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium">Uploaded Cards:</p>
                          {product.warrantyCards.map((card, idx) => (
                            <Button
                              key={idx}
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 text-xs justify-start"
                              onClick={() => handleViewWarrantyCard(card.url, card.filename)}
                              data-testid={`button-view-warranty-${product.itemIndex}-${idx}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {card.filename} ({format(new Date(card.uploadedAt), 'PP')})
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <input
                        type="file"
                        ref={(el) => (fileInputRefs.current[product.itemIndex] = el)}
                        onChange={(e) => handleFileSelect(product.itemIndex, e)}
                        accept="image/*,.pdf"
                        className="hidden"
                        data-testid={`input-file-${product.itemIndex}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRefs.current[product.itemIndex]?.click()}
                        disabled={uploadMutation.isPending}
                        data-testid={`button-upload-${product.itemIndex}`}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadMutation.isPending ? "Uploading..." : "Upload Card"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-warranty">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
