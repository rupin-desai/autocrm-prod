import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ServiceWorkflowCard } from "@/components/ServiceWorkflowCard";
import { InvoiceGenerationDialog } from "@/components/InvoiceGenerationDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Wrench, Edit, X, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth, hasPermission } from "@/lib/auth";

export default function ServiceVisits() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedHandlers, setSelectedHandlers] = useState<string[]>([]);
  const [beforeImages, setBeforeImages] = useState<string[]>([]);
  const [afterImages, setAfterImages] = useState<string[]>([]);
  const [customerVehicles, setCustomerVehicles] = useState<any[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    customerId: "",
    vehicleReg: "",
    handlerIds: [] as string[],
    notes: "",
    status: "inquired",
  });

  const canDelete = hasPermission(user, 'orders', 'delete');

  const { data: serviceVisits = [], isLoading, error, refetch } = useQuery<any[]>({
    queryKey: ["/api/service-visits"],
  });

  const { data: customers = [], isLoading: isLoadingCustomers, error: customersError } = useQuery<any[]>({
    queryKey: ["/api/registration/customers"],
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/service-handlers"],
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/service-visits', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-visits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      setIsServiceDialogOpen(false);
      setServiceForm({ customerId: "", vehicleReg: "", handlerIds: [] as string[], notes: "", status: "inquired" });
      toast({
        title: "Success",
        description: "Service visit created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create service visit",
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, status, beforeImages, afterImages, handlerIds }: { id: string; status: string; beforeImages?: string[]; afterImages?: string[]; handlerIds?: string[] }) => {
      console.log('🚀 [FRONTEND] Sending update request:', { id, status, beforeImages: beforeImages?.length, afterImages: afterImages?.length, handlerIds });
      const response = await apiRequest('PATCH', `/api/service-visits/${id}`, { status, beforeImages, afterImages, handlerIds });
      const data = await response.json();
      console.log('✅ [FRONTEND] Update response received:', data);
      console.log('🔍 [DEBUG] Handler IDs in response:', data.handlerIds);
      return data;
    },
    onSuccess: async (updatedVisit) => {
      console.log('🎉 [FRONTEND] Update successful:', updatedVisit);
      console.log('🔍 [DEBUG] Updated visit handlerIds:', updatedVisit.handlerIds);
      
      await queryClient.invalidateQueries({ queryKey: ['/api/service-visits'] });
      await queryClient.refetchQueries({ queryKey: ['/api/service-visits'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      
      setSelectedService(updatedVisit);
      setSelectedStatus(updatedVisit.status);
      setSelectedHandlers(updatedVisit.handlerIds?.map((h: any) => h._id || h) || []);
      setBeforeImages(updatedVisit.beforeImages || []);
      setAfterImages(updatedVisit.afterImages || []);
      
      setIsEditDialogOpen(false);
      
      toast({
        title: "Success",
        description: "Service status updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('❌ [FRONTEND] Update failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update service status",
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/service-visits/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-visits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
      setIsEditDialogOpen(false);
      setSelectedService(null);
      setSelectedStatus("");
      toast({
        title: "Success",
        description: "Service visit deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete service visit",
        variant: "destructive",
      });
    },
  });

  const handleCustomerChange = async (customerId: string) => {
    setServiceForm({ ...serviceForm, customerId, vehicleReg: "" });
    setCustomerVehicles([]);
    
    if (!customerId) return;
    
    setIsLoadingVehicles(true);
    try {
      const response = await fetch(`/api/registration/customers/${customerId}/vehicles`);
      if (response.ok) {
        const vehicles = await response.json();
        setCustomerVehicles(vehicles);
        if (vehicles.length === 1) {
          setServiceForm(prev => ({ ...prev, vehicleReg: vehicles[0].vehicleNumber || vehicles[0].vehicleId }));
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to load customer vehicles",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load customer vehicles",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serviceForm.customerId || !serviceForm.vehicleReg) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    if (serviceForm.status !== 'inquired' && serviceForm.handlerIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one service handler",
        variant: "destructive",
      });
      return;
    }
    
    createServiceMutation.mutate(serviceForm);
  };

  const handleViewService = (service: any) => {
    setSelectedService(service);
    setIsViewDialogOpen(true);
  };

  const handleEditService = (service: any) => {
    setSelectedService(service);
    setSelectedStatus(service.status);
    setSelectedHandlers(service.handlerIds?.map((h: any) => h._id || h) || []);
    setBeforeImages(service.beforeImages || []);
    setAfterImages(service.afterImages || []);
    setIsEditDialogOpen(true);
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setIsImagePreviewOpen(true);
  };

  const handleStatusUpdate = () => {
    if (!selectedService || !selectedStatus) return;
    
    // Validate service handlers - only required for non-inquired statuses
    if (selectedStatus !== 'inquired' && selectedHandlers.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one service handler for this phase",
        variant: "destructive",
      });
      return;
    }
    
    // Validate mandatory image uploads based on phase
    if (selectedStatus === 'working' || selectedStatus === 'waiting') {
      if (beforeImages.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please upload at least one 'Before' image before moving to this phase",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (selectedStatus === 'completed') {
      if (afterImages.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please upload at least one 'After' image before marking as completed",
          variant: "destructive",
        });
        return;
      }
    }
    
    const originalHandlers = selectedService.handlerIds?.map((h: any) => h._id || h) || [];
    const handlersChanged = JSON.stringify(selectedHandlers.sort()) !== JSON.stringify(originalHandlers.sort());
    
    if (selectedStatus === selectedService.status && 
        JSON.stringify(beforeImages) === JSON.stringify(selectedService.beforeImages || []) &&
        JSON.stringify(afterImages) === JSON.stringify(selectedService.afterImages || []) &&
        !handlersChanged) {
      toast({
        title: "No Changes",
        description: "No changes detected",
        variant: "default",
      });
      return;
    }
    
    updateServiceMutation.mutate({
      id: selectedService._id,
      status: selectedStatus,
      beforeImages,
      afterImages,
      handlerIds: selectedHandlers,
    });
  };

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select a valid image file (PNG, JPEG, GIF, WebP)",
          variant: "destructive",
        });
        reject(new Error('Please select a valid image file'));
        return;
      }

      const fileSizeInMB = file.size / (1024 * 1024);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const maxDimension = fileSizeInMB > 5 ? 1280 : 1920;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            } else {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          let quality = 0.8;
          if (fileSizeInMB > 10) {
            quality = 0.5;
          } else if (fileSizeInMB > 5) {
            quality = 0.6;
          } else if (fileSizeInMB > 2) {
            quality = 0.7;
          }
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          const compressedSizeInMB = (compressedDataUrl.length * 0.75) / (1024 * 1024);
          
          if (compressedSizeInMB > 15) {
            toast({
              title: "Image still too large",
              description: "Image is too large even after maximum compression. Please use a smaller image",
              variant: "destructive",
            });
            reject(new Error('Image too large after compression'));
            return;
          }
          
          const savedSize = fileSizeInMB - compressedSizeInMB;
          if (savedSize > 1) {
            toast({
              title: "Image compressed",
              description: `Compressed from ${fileSizeInMB.toFixed(1)}MB to ${compressedSizeInMB.toFixed(1)}MB`,
            });
          }
          
          resolve(compressedDataUrl);
        };
        img.onerror = () => {
          toast({
            title: "Failed to load image",
            description: "Unable to process the image file",
            variant: "destructive",
          });
          reject(new Error('Failed to load image'));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        toast({
          title: "Failed to read file",
          description: "Unable to read the selected file",
          variant: "destructive",
        });
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleBeforeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedImage = await compressImage(file);
        setBeforeImages([...beforeImages, compressedImage]);
        toast({
          title: "Image added",
          description: "Before image uploaded successfully",
        });
      } catch (error) {
        console.error('Image upload error:', error);
      }
      e.target.value = '';
    }
  };

  const handleAfterImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedImage = await compressImage(file);
        setAfterImages([...afterImages, compressedImage]);
        toast({
          title: "Image added",
          description: "After image uploaded successfully",
        });
      } catch (error) {
        console.error('Image upload error:', error);
      }
      e.target.value = '';
    }
  };

  const handleDeleteService = () => {
    if (selectedService) {
      deleteServiceMutation.mutate(selectedService._id);
      setIsDeleteDialogOpen(false);
    }
  };

  const servicesByStage = {
    inquired: serviceVisits.filter((v: any) => v.status === 'inquired'),
    working: serviceVisits.filter((v: any) => v.status === 'working'),
    waiting: serviceVisits.filter((v: any) => v.status === 'waiting'),
    completed: serviceVisits.filter((v: any) => v.status === 'completed'),
  };

  const stages = [
    { id: "inquired", label: "Inquired", phase: "Phase 1", count: servicesByStage.inquired.length, color: "text-blue-700 dark:text-blue-400" },
    { id: "working", label: "Working", phase: "Phase 2", count: servicesByStage.working.length, color: "text-amber-700 dark:text-amber-400" },
    { id: "waiting", label: "Waiting", phase: "Phase 3", count: servicesByStage.waiting.length, color: "text-purple-700 dark:text-purple-400" },
    { id: "completed", label: "Completed", phase: "Phase 4", count: servicesByStage.completed.length, color: "text-green-700 dark:text-green-400" },
  ];
  
  const totalVisits = serviceVisits.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Service Workflow</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Wrench className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load service visits</h3>
              <p className="text-muted-foreground mb-4">
                {(error as Error)?.message || 'An error occurred while fetching service visits'}
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
        <h1 className="text-3xl font-bold">Service Workflow</h1>
        <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
          <DialogTrigger asChild className="hidden">
            <Button data-testid="button-new-service">
              <Plus className="h-4 w-4 mr-2" />
              New Service
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Service Visit</DialogTitle>
              <DialogDescription>
                Create a new service visit for a customer vehicle
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateService} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select 
                  value={serviceForm.customerId} 
                  onValueChange={handleCustomerChange}
                  required
                  disabled={isLoadingCustomers}
                >
                  <SelectTrigger id="customer" data-testid="select-customer">
                    <SelectValue placeholder={
                      isLoadingCustomers 
                        ? "Loading customers..." 
                        : customersError 
                        ? "Error loading customers" 
                        : customers.length === 0 
                        ? "No customers available" 
                        : "Select a customer"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer: any) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.fullName} ({customer.referenceCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {customersError && (
                  <p className="text-sm text-destructive">Failed to load customers. Please try again.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleReg">Vehicle *</Label>
                <Select 
                  value={serviceForm.vehicleReg} 
                  onValueChange={(value) => setServiceForm({ ...serviceForm, vehicleReg: value })}
                  required
                  disabled={!serviceForm.customerId || isLoadingVehicles}
                >
                  <SelectTrigger id="vehicleReg" data-testid="select-vehicle">
                    <SelectValue placeholder={
                      !serviceForm.customerId
                        ? "Select a customer first"
                        : isLoadingVehicles 
                        ? "Loading vehicles..." 
                        : customerVehicles.length === 0 
                        ? "No vehicles registered for this customer" 
                        : "Select a vehicle"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {customerVehicles.map((vehicle: any) => (
                      <SelectItem key={vehicle.id} value={vehicle.vehicleNumber || vehicle.vehicleId}>
                        {vehicle.vehicleNumber || vehicle.vehicleId} - {vehicle.vehicleBrand} {vehicle.vehicleModel} {vehicle.variant ? `(${vehicle.variant})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {serviceForm.customerId && customerVehicles.length === 0 && !isLoadingVehicles && (
                  <p className="text-sm text-muted-foreground">This customer has no registered vehicles.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Service Handlers * (Select one or more)</Label>
                <div className="border rounded-md p-4 space-y-3 max-h-48 overflow-y-auto">
                  {employees.length > 0 ? (
                    employees.map((employee: any) => (
                      <div key={employee._id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`handler-${employee._id}`}
                          checked={serviceForm.handlerIds.includes(employee._id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setServiceForm({ 
                                ...serviceForm, 
                                handlerIds: [...serviceForm.handlerIds, employee._id] 
                              });
                            } else {
                              setServiceForm({ 
                                ...serviceForm, 
                                handlerIds: serviceForm.handlerIds.filter(id => id !== employee._id) 
                              });
                            }
                          }}
                          data-testid={`checkbox-handler-${employee._id}`}
                        />
                        <label
                          htmlFor={`handler-${employee._id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {employee.name} - {employee.role}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No service handlers available</p>
                  )}
                </div>
                {serviceForm.handlerIds.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {serviceForm.handlerIds.length} handler{serviceForm.handlerIds.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Service Status *</Label>
                <Select 
                  value={serviceForm.status} 
                  onValueChange={(value) => setServiceForm({ ...serviceForm, status: value })}
                  required
                >
                  <SelectTrigger id="status" data-testid="select-status">
                    <SelectValue placeholder="Select initial status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="inquired" value="inquired">Inquired</SelectItem>
                    <SelectItem key="working" value="working">Working</SelectItem>
                    <SelectItem key="waiting" value="waiting">Waiting</SelectItem>
                    <SelectItem key="completed" value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={serviceForm.notes}
                  onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })}
                  placeholder="Add any additional notes"
                  rows={3}
                  data-testid="textarea-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsServiceDialogOpen(false)}
                  data-testid="button-cancel-service"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createServiceMutation.isPending}
                  data-testid="button-submit-service"
                >
                  {createServiceMutation.isPending ? 'Creating...' : 'Create Service'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap">
        {stages.map((stage) => (
          <Badge
            key={stage.id}
            variant="outline"
            className="text-sm py-1.5 px-3"
            data-testid={`badge-${stage.id}`}
          >
            {stage.label} ({stage.count})
          </Badge>
        ))}
      </div>

      <div className="space-y-6">
        {stages.map((stage) => (
          <Card key={stage.id} data-testid={`card-stage-${stage.id}`}>
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className={`text-sm font-bold uppercase tracking-wide ${stage.color}`}>
                    {stage.phase}
                  </div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    {stage.label}
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="text-base px-3 py-1">
                  {stage.count}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {servicesByStage[stage.id as keyof typeof servicesByStage].length > 0 ? (
                <div className="overflow-x-auto pb-2">
                  <div className="flex gap-4 min-w-max">
                    {servicesByStage[stage.id as keyof typeof servicesByStage].map((service: any) => (
                      <div key={service._id} className="w-80 flex-shrink-0">
                        <ServiceWorkflowCard
                          customerName={service.customerId?.fullName || 'Unknown'}
                          vehicleReg={service.vehicleReg}
                          status={service.status}
                          handlers={service.handlerIds?.map((h: any) => h?.name).filter((name: string | undefined) => name) || []}
                          startTime={formatDistance(new Date(service.createdAt), new Date(), { addSuffix: true })}
                          totalAmount={service.totalAmount}
                          partsCount={service.partsUsed?.length || 0}
                          notes={service.notes}
                          onView={() => handleViewService(service)}
                          onEdit={() => handleEditService(service)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8" data-testid={`empty-${stage.id}`}>
                  No services in {stage.label.toLowerCase()} stage
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {totalVisits === 0 && (
        <div className="text-center py-12">
          <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No service visits found. Create your first service visit to get started.</p>
        </div>
      )}

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Service Details</DialogTitle>
            <DialogDescription>
              Complete information about this service visit
            </DialogDescription>
          </DialogHeader>
          
          {selectedService && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="text-sm font-medium" data-testid="view-customer">
                    {selectedService.customerId?.fullName || 'Unknown'}
                  </p>
                  {selectedService.customerId?.referenceCode && (
                    <p className="text-xs text-muted-foreground">
                      {selectedService.customerId.referenceCode}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Vehicle Registration</Label>
                  <p className="text-sm font-medium font-mono" data-testid="view-vehicle">
                    {selectedService.vehicleReg}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant="outline" className="capitalize" data-testid="view-status">
                    {selectedService.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Service Handlers</Label>
                  {selectedService.handlerIds && selectedService.handlerIds.length > 0 ? (
                    <div className="space-y-2">
                      {selectedService.handlerIds.map((handler: any) => (
                        <div key={handler._id} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {handler.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{handler.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{handler.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No handlers assigned</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Service Timeline</Label>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Started:</span>
                      <span className="font-medium">{formatDistance(new Date(selectedService.createdAt), new Date(), { addSuffix: true })}</span>
                    </div>
                    {selectedService.totalAmount !== undefined && selectedService.totalAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Amount:</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(selectedService.totalAmount)}
                        </span>
                      </div>
                    )}
                    {selectedService.partsUsed && selectedService.partsUsed.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Parts Used:</span>
                        <span className="font-medium">{selectedService.partsUsed.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedService.status === 'completed' && (selectedService.invoiceNumber || selectedService.invoiceDate) && (
                <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <Label className="text-sm font-medium text-green-900 dark:text-green-100">Invoice Details</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {selectedService.invoiceNumber && (
                      <div>
                        <Label className="text-xs text-green-700 dark:text-green-300">Invoice Number</Label>
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">{selectedService.invoiceNumber}</p>
                      </div>
                    )}
                    {selectedService.invoiceDate && (
                      <div>
                        <Label className="text-xs text-green-700 dark:text-green-300">Invoice Date</Label>
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          {new Date(selectedService.invoiceDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedService.notes && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Notes</Label>
                  <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg whitespace-pre-wrap">
                    {selectedService.notes}
                  </p>
                </div>
              )}

              {(selectedService.beforeImages?.length > 0 || selectedService.afterImages?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Before Service Images</Label>
                    {selectedService.beforeImages && selectedService.beforeImages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {selectedService.beforeImages.map((img: string, idx: number) => (
                          <div key={idx} className="relative border-2 border-orange-300 dark:border-orange-700 rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => handleImageClick(img)}>
                            <img src={img} alt={`Before ${idx + 1}`} className="w-full h-32 object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No images uploaded</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">After Service Images</Label>
                    {selectedService.afterImages && selectedService.afterImages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {selectedService.afterImages.map((img: string, idx: number) => (
                          <div key={idx} className="relative border-2 border-green-300 dark:border-green-700 rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => handleImageClick(img)}>
                            <img src={img} alt={`After ${idx + 1}`} className="w-full h-32 object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No images uploaded</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row justify-between gap-2 pt-4 border-t">
                <div className="flex gap-2 flex-wrap">
                  {selectedService?.status === 'completed' && hasPermission(user, 'invoices', 'create') && (
                    <Button
                      variant="default"
                      onClick={() => {
                        setIsViewDialogOpen(false);
                        setIsInvoiceDialogOpen(true);
                      }}
                      data-testid="button-generate-invoice"
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      Generate Invoice
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => setIsViewDialogOpen(false)}
                    data-testid="button-close-view"
                    className="flex-1 md:flex-none"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      handleEditService(selectedService);
                    }}
                    data-testid="button-edit-from-view"
                    className="flex-1 md:flex-none"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Service
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Service Status</DialogTitle>
            <DialogDescription>
              Update the status of the service visit to move it through the pipeline
            </DialogDescription>
          </DialogHeader>
          
          {selectedService && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Customer</Label>
                  <p className="text-sm text-muted-foreground" data-testid="text-edit-customer">
                    {selectedService.customerId?.fullName || 'Unknown'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Vehicle Registration</Label>
                  <p className="text-sm text-muted-foreground" data-testid="text-edit-vehicle">
                    {selectedService.vehicleReg}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current Status</Label>
                  <p className="text-sm text-muted-foreground capitalize" data-testid="text-edit-current-status">
                    {selectedService.status}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newStatus">New Status *</Label>
                  <Select 
                    value={selectedStatus}
                    onValueChange={setSelectedStatus}
                    disabled={updateServiceMutation.isPending || deleteServiceMutation.isPending}
                  >
                    <SelectTrigger id="newStatus" data-testid="select-new-status">
                      <SelectValue placeholder="Select new status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem key="inquired" value="inquired">Inquired</SelectItem>
                      <SelectItem key="working" value="working">Working</SelectItem>
                      <SelectItem key="waiting" value="waiting">Waiting</SelectItem>
                      <SelectItem key="completed" value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Service Handlers * (Select one or more)</Label>
                <div className="border rounded-md p-4 space-y-3 max-h-48 overflow-y-auto">
                  {employees.length > 0 ? (
                    employees.map((employee: any) => (
                      <div key={employee._id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-handler-${employee._id}`}
                          checked={selectedHandlers.includes(employee._id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedHandlers([...selectedHandlers, employee._id]);
                            } else {
                              setSelectedHandlers(selectedHandlers.filter(id => id !== employee._id));
                            }
                          }}
                          disabled={updateServiceMutation.isPending || deleteServiceMutation.isPending}
                          data-testid={`checkbox-edit-handler-${employee._id}`}
                        />
                        <label
                          htmlFor={`edit-handler-${employee._id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {employee.name} - {employee.role}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No service handlers available</p>
                  )}
                </div>
                {selectedHandlers.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {selectedHandlers.length} handler{selectedHandlers.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className={`grid ${selectedStatus === 'completed' ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
                <div className="space-y-2">
                  <Label>Before Service Images</Label>
                  <Input 
                    type="file" 
                    accept="image/*"
                    onChange={handleBeforeImageUpload}
                    data-testid="input-before-image"
                  />
                  {beforeImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {beforeImages.map((img, idx) => (
                        <div key={idx} className="relative border-2 border-orange-300 dark:border-orange-700 rounded p-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => handleImageClick(img)}>
                          <img src={img} alt={`Before ${idx + 1}`} className="w-full h-24 object-cover rounded" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBeforeImages(beforeImages.filter((_, i) => i !== idx));
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 z-10"
                            data-testid={`button-remove-before-${idx}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedStatus === 'completed' && (
                  <div className="space-y-2">
                    <Label>After Service Images</Label>
                    <Input 
                      type="file" 
                      accept="image/*"
                      onChange={handleAfterImageUpload}
                      data-testid="input-after-image"
                    />
                    {afterImages.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {afterImages.map((img, idx) => (
                          <div key={idx} className="relative border-2 border-orange-300 dark:border-orange-700 rounded p-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => handleImageClick(img)}>
                            <img src={img} alt={`After ${idx + 1}`} className="w-full h-24 object-cover rounded" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAfterImages(afterImages.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 z-10"
                              data-testid={`button-remove-after-${idx}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={`flex ${canDelete ? 'justify-between' : 'justify-end'} gap-2 pt-4`}>
                {canDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={updateServiceMutation.isPending || deleteServiceMutation.isPending}
                    data-testid="button-delete-service"
                  >
                    Delete Service
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                    disabled={updateServiceMutation.isPending || deleteServiceMutation.isPending}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleStatusUpdate}
                    disabled={updateServiceMutation.isPending || deleteServiceMutation.isPending || !selectedStatus}
                    data-testid="button-update-status"
                  >
                    {updateServiceMutation.isPending ? 'Updating...' : 'Update'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Visit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service visit? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteService}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteServiceMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="relative">
            <button
              onClick={() => setIsImagePreviewOpen(false)}
              className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              data-testid="button-close-image-preview"
            >
              <X className="h-5 w-5" />
            </button>
            <img 
              src={selectedImageUrl} 
              alt="Full size preview" 
              className="w-full h-auto max-h-[90vh] object-contain"
              data-testid="image-preview"
            />
          </div>
        </DialogContent>
      </Dialog>

      {selectedService && (
        <InvoiceGenerationDialog
          open={isInvoiceDialogOpen}
          onOpenChange={setIsInvoiceDialogOpen}
          serviceVisit={selectedService}
        />
      )}
    </div>
  );
}
