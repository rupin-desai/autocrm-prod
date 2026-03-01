import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Calendar, Edit, Eye, Trash2, Check, X as XIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

interface Leave {
  _id: string;
  employeeId: any;
  leaveType: 'casual' | 'sick' | 'annual' | 'unpaid';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: any;
  approvalDate?: string;
  notes?: string;
}

export default function Leaves() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    employeeId: "",
    leaveType: "casual",
    startDate: "",
    endDate: "",
    reason: "",
    notes: "",
  });

  const { data: leaves = [], isLoading, error, refetch } = useQuery<Leave[]>({
    queryKey: ["/api/leaves"],
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  const createLeaveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/leaves', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leaves'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Leave request created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create leave request",
        variant: "destructive",
      });
    },
  });

  const updateLeaveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/leaves/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leaves'] });
      setIsEditDialogOpen(false);
      setSelectedLeave(null);
      toast({
        title: "Success",
        description: "Leave request updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update leave request",
        variant: "destructive",
      });
    },
  });

  const approveLeaveMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const response = await apiRequest('PATCH', `/api/leaves/${id}`, {
        status: approved ? 'approved' : 'rejected',
        approvedBy: user?.id,
        approvalDate: new Date().toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leaves'] });
      toast({
        title: "Success",
        description: "Leave request processed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process leave request",
        variant: "destructive",
      });
    },
  });

  const deleteLeaveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/leaves/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leaves'] });
      setIsViewDialogOpen(false);
      toast({
        title: "Success",
        description: "Leave request deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete leave request",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      employeeId: "",
      leaveType: "casual",
      startDate: "",
      endDate: "",
      reason: "",
      notes: "",
    });
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    return differenceInDays(new Date(end), new Date(start)) + 1;
  };

  const handleCreateLeave = (e: React.FormEvent) => {
    e.preventDefault();
    createLeaveMutation.mutate(formData);
  };

  const handleEditLeave = (leave: Leave) => {
    setSelectedLeave(leave);
    setFormData({
      employeeId: leave.employeeId?._id || leave.employeeId || "",
      leaveType: leave.leaveType,
      startDate: leave.startDate ? leave.startDate.split('T')[0] : "",
      endDate: leave.endDate ? leave.endDate.split('T')[0] : "",
      reason: leave.reason || "",
      notes: leave.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeave) return;
    updateLeaveMutation.mutate({
      id: selectedLeave._id,
      data: formData,
    });
  };

  const handleViewLeave = (leave: Leave) => {
    setSelectedLeave(leave);
    setIsViewDialogOpen(true);
  };

  const handleApproveLeave = (id: string, approved: boolean) => {
    approveLeaveMutation.mutate({ id, approved });
  };

  const handleDeleteLeave = (id: string) => {
    if (confirm('Are you sure you want to delete this leave request?')) {
      deleteLeaveMutation.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return <Badge className={colors[status]} data-testid={`status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>;
  };

  const getLeaveTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      casual: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      sick: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      annual: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      unpaid: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    };
    return <Badge className={colors[type]}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </Badge>;
  };

  const filteredLeaves = leaves.filter((leave: Leave) => {
    return leave.employeeId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.leaveType?.toLowerCase().includes(searchTerm.toLowerCase());
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
        <h1 className="text-3xl font-bold">Leave Management</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load leave requests</h3>
              <p className="text-muted-foreground mb-4">
                {(error as Error)?.message || 'An error occurred while fetching leave requests'}
              </p>
              <Button onClick={() => refetch()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Leave Management</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-leave">
              <Plus className="h-4 w-4 mr-2" />
              Request Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Request Leave</DialogTitle>
              <DialogDescription>
                Submit a new leave request for an employee
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateLeave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee *</Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                  required
                >
                  <SelectTrigger data-testid="select-leave-employee">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp: any) => (
                      <SelectItem key={emp._id} value={emp._id}>
                        {emp.name} - {emp.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type *</Label>
                <Select
                  value={formData.leaveType}
                  onValueChange={(value) => setFormData({ ...formData, leaveType: value })}
                  required
                >
                  <SelectTrigger data-testid="select-leave-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="annual">Annual Leave</SelectItem>
                    <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    data-testid="input-leave-startdate"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    data-testid="input-leave-enddate"
                  />
                </div>
              </div>

              {formData.startDate && formData.endDate && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm font-medium">
                    Total Days: {calculateDays(formData.startDate, formData.endDate)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  required
                  rows={3}
                  data-testid="textarea-leave-reason"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  data-testid="textarea-leave-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    resetForm();
                  }}
                  data-testid="button-cancel-leave"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createLeaveMutation.isPending}
                  data-testid="button-submit-leave"
                >
                  {createLeaveMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search leave requests..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

      {filteredLeaves.length > 0 ? (
        <div className="grid gap-3">
          {filteredLeaves.map((leave: Leave) => (
            <Card key={leave._id} className="hover-elevate" data-testid={`card-leave-${leave._id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{leave.employeeId?.name || 'N/A'}</CardTitle>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {getLeaveTypeBadge(leave.leaveType)}
                      {getStatusBadge(leave.status)}
                    </div>
                  </div>
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-center">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="text-sm font-medium">{format(new Date(leave.startDate), 'dd MMM yyyy')}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <p className="text-sm font-medium">{format(new Date(leave.endDate), 'dd MMM yyyy')}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Days</p>
                    <p className="text-sm font-medium">{calculateDays(leave.startDate, leave.endDate)} day(s)</p>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEditLeave(leave)}
                      disabled={leave.status !== 'pending'}
                      data-testid={`button-edit-${leave._id}`}
                      className="h-8 px-2"
                      aria-label="Edit leave request"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewLeave(leave)}
                      data-testid={`button-view-${leave._id}`}
                      className="h-8 px-2"
                      aria-label="View leave details"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex gap-1 justify-end">
                    {leave.status === 'pending' && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-green-600 hover:text-green-700 h-8 px-2"
                          onClick={() => handleApproveLeave(leave._id, true)}
                          data-testid={`button-approve-${leave._id}`}
                          aria-label="Approve leave request"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 hover:text-red-700 h-8 px-2"
                          onClick={() => handleApproveLeave(leave._id, false)}
                          data-testid={`button-reject-${leave._id}`}
                          aria-label="Reject leave request"
                        >
                          <XIcon className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteLeave(leave._id)}
                      data-testid={`button-delete-${leave._id}`}
                      className="h-8 px-2"
                      aria-label="Delete leave request"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {leave.reason && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground">Reason</p>
                    <p className="text-sm mt-1 line-clamp-2">{leave.reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : leaves.length > 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No leave requests match your search criteria</p>
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No leave requests found.</p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
            <DialogDescription>
              Update leave request information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateLeave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-employeeId">Employee *</Label>
              <Select
                value={formData.employeeId}
                onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                required
              >
                <SelectTrigger data-testid="select-edit-leave-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {emp.name} - {emp.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-leaveType">Leave Type *</Label>
              <Select
                value={formData.leaveType}
                onValueChange={(value) => setFormData({ ...formData, leaveType: value })}
                required
              >
                <SelectTrigger data-testid="select-edit-leave-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="annual">Annual Leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-startDate">Start Date *</Label>
                <Input
                  id="edit-startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                  data-testid="input-edit-leave-startdate"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-endDate">End Date *</Label>
                <Input
                  id="edit-endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                  data-testid="input-edit-leave-enddate"
                />
              </div>
            </div>

            {formData.startDate && formData.endDate && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium">
                  Total Days: {calculateDays(formData.startDate, formData.endDate)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-reason">Reason *</Label>
              <Textarea
                id="edit-reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
                rows={3}
                data-testid="textarea-edit-leave-reason"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Additional Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                data-testid="textarea-edit-leave-notes"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                data-testid="button-cancel-edit-leave"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateLeaveMutation.isPending} data-testid="button-submit-edit-leave">
                {updateLeaveMutation.isPending ? 'Updating...' : 'Update Request'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{selectedLeave.employeeId?.name || 'N/A'}</h3>
                <div className="flex gap-2 mt-2">
                  {getLeaveTypeBadge(selectedLeave.leaveType)}
                  {getStatusBadge(selectedLeave.status)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-sm font-medium">{format(new Date(selectedLeave.startDate), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="text-sm font-medium">{format(new Date(selectedLeave.endDate), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Days</p>
                  <p className="text-sm font-medium">{calculateDays(selectedLeave.startDate, selectedLeave.endDate)} day(s)</p>
                </div>
                {selectedLeave.approvedBy && (
                  <div>
                    <p className="text-xs text-muted-foreground">Approved By</p>
                    <p className="text-sm font-medium">{selectedLeave.approvedBy?.name || 'N/A'}</p>
                  </div>
                )}
                {selectedLeave.approvalDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">Approval Date</p>
                    <p className="text-sm font-medium">{format(new Date(selectedLeave.approvalDate), 'dd MMM yyyy')}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reason</p>
                <p className="text-sm mt-1">{selectedLeave.reason}</p>
              </div>
              {selectedLeave.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Additional Notes</p>
                  <p className="text-sm mt-1">{selectedLeave.notes}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} data-testid="button-close-view-leave">
                  Close
                </Button>
                <Button variant="destructive" onClick={() => handleDeleteLeave(selectedLeave._id)} data-testid="button-delete-view-leave">
                  Delete Request
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
