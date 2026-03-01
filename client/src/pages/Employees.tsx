import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, User, X, FileText, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { useAuth } from "@/lib/auth";

interface Employee {
  _id: string;
  employeeId?: string;
  name: string;
  role: string;
  contact: string;
  email?: string;
  salary?: number;
  joiningDate: string;
  isActive: boolean;
  panNumber?: string;
  aadharNumber?: string;
  photo?: string;
  documents?: string[];
  createdAt?: string;
  updatedAt?: string;
}

type SortOption = 'name-asc' | 'name-desc' | 'id-asc' | 'id-desc' | 'role-asc' | 'role-desc';

export default function Employees() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [editOtpSent, setEditOtpSent] = useState(false);
  const [editOtpVerified, setEditOtpVerified] = useState(false);
  const [editOtpCode, setEditOtpCode] = useState("");
  const { toast } = useToast();
  
  const isAdmin = user?.role === 'Admin';

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "",
    salary: "",
    joiningDate: "",
    panNumber: "",
    aadharNumber: "",
    photo: "",
    documents: [] as string[],
  });

  const validatePanNumber = (pan: string): boolean => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan.toUpperCase());
  };

  const validateAadharNumber = (aadhar: string): boolean => {
    const cleanedAadhar = aadhar.replace(/\s/g, '');
    return /^\d{12}$/.test(cleanedAadhar);
  };

  const formatAadharNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.slice(0, 12);
    const parts = limited.match(/.{1,4}/g);
    return parts ? parts.join(' ') : limited;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const filePromises = Array.from(files).map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    try {
      const base64Files = await Promise.all(filePromises);
      setFormData({ ...formData, documents: [...formData.documents, ...base64Files] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive",
      });
    }
  };

  const removeDocument = (index: number) => {
    setFormData({
      ...formData,
      documents: formData.documents.filter((_, i) => i !== index)
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setIsCropDialogOpen(true);
    };
    reader.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to upload photo",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedImage: string) => {
    setFormData({ ...formData, photo: croppedImage });
  };

  const { data: employees = [], isLoading, error, refetch } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/employees', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setIsCreateDialogOpen(false);
      resetCreateForm();
      toast({
        title: "Success",
        description: "Employee created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create employee",
        variant: "destructive",
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/employees/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setIsEditDialogOpen(false);
      setSelectedEmployee(null);
      toast({
        title: "Success",
        description: "Employee updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee",
        variant: "destructive",
      });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/employees/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: "Success",
        description: "Employee deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete employee",
        variant: "destructive",
      });
    },
  });

  const sendOtpMutation = useMutation({
    mutationFn: async ({ mobileNumber, purpose }: { mobileNumber: string; purpose: string }) => {
      const response = await apiRequest('POST', '/api/employees/send-otp', { mobileNumber, purpose });
      return response.json();
    },
    onSuccess: () => {
      setOtpSent(true);
      toast({
        title: "Success",
        description: "OTP sent to WhatsApp",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ mobileNumber, otp, purpose }: { mobileNumber: string; otp: string; purpose: string }) => {
      const response = await apiRequest('POST', '/api/employees/verify-otp', { mobileNumber, otp, purpose });
      return response.json();
    },
    onSuccess: () => {
      setOtpVerified(true);
      toast({
        title: "Success",
        description: "Phone number verified successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    },
  });

  const sendEditOtpMutation = useMutation({
    mutationFn: async ({ mobileNumber, purpose }: { mobileNumber: string; purpose: string }) => {
      const response = await apiRequest('POST', '/api/employees/send-otp', { mobileNumber, purpose });
      return response.json();
    },
    onSuccess: () => {
      setEditOtpSent(true);
      toast({
        title: "Success",
        description: "OTP sent to WhatsApp",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    },
  });

  const verifyEditOtpMutation = useMutation({
    mutationFn: async ({ mobileNumber, otp, purpose }: { mobileNumber: string; otp: string; purpose: string }) => {
      const response = await apiRequest('POST', '/api/employees/verify-otp', { mobileNumber, otp, purpose });
      return response.json();
    },
    onSuccess: () => {
      setEditOtpVerified(true);
      toast({
        title: "Success",
        description: "Phone number verified successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    },
  });

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpVerified) {
      toast({
        title: "Verification Required",
        description: "Please verify the phone number with OTP before creating the employee",
        variant: "destructive",
      });
      return;
    }

    if (!formData.photo) {
      toast({
        title: "Photo Required",
        description: "Please upload employee photo before creating the employee",
        variant: "destructive",
      });
      return;
    }
    
    const payload: any = {
      name: formData.name,
      email: formData.email,
      contact: formData.phone,
      password: formData.password,
      role: formData.role,
      photo: formData.photo,
      isActive: true,
    };
    
    if (formData.role !== 'Admin') {
      if (!formData.panNumber || !validatePanNumber(formData.panNumber)) {
        toast({
          title: "Invalid PAN",
          description: "Please enter a valid PAN number (e.g., ABCDE1234F)",
          variant: "destructive",
        });
        return;
      }

      if (!formData.aadharNumber || !validateAadharNumber(formData.aadharNumber)) {
        toast({
          title: "Invalid Aadhar",
          description: "Please enter a valid 12-digit Aadhar number",
          variant: "destructive",
        });
        return;
      }

      if (formData.documents.length === 0) {
        toast({
          title: "Documents Required",
          description: "Please upload at least one document (Aadhar or PAN card)",
          variant: "destructive",
        });
        return;
      }

      payload.panNumber = formData.panNumber.toUpperCase();
      payload.aadharNumber = formData.aadharNumber;
      payload.documents = formData.documents;
      payload.salary = parseFloat(formData.salary);
      payload.joiningDate = formData.joiningDate;
    }
    
    createEmployeeMutation.mutate(payload);
  };

  const handleEditEmployee = (employee: Employee) => {
    if (employee.role === 'Admin' && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only Admin users can edit Admin accounts",
        variant: "destructive",
      });
      return;
    }
    setSelectedEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email || "",
      phone: employee.contact,
      password: "",
      role: employee.role,
      salary: employee.salary ? employee.salary.toString() : "",
      joiningDate: employee.joiningDate ? employee.joiningDate.split('T')[0] : "",
      panNumber: employee.panNumber || "",
      aadharNumber: employee.aadharNumber || "",
      photo: employee.photo || "",
      documents: employee.documents || [],
    });
    setEditOtpSent(false);
    setEditOtpVerified(false);
    setEditOtpCode("");
    setIsEditDialogOpen(true);
  };

  const handleUpdateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    if (formData.phone !== selectedEmployee.contact && !editOtpVerified) {
      toast({
        title: "Verification Required",
        description: "Please verify the new phone number with OTP before updating",
        variant: "destructive",
      });
      return;
    }

    if (!formData.photo) {
      toast({
        title: "Photo Required",
        description: "Please upload employee photo before updating the employee",
        variant: "destructive",
      });
      return;
    }
    
    const updateData: any = {
      name: formData.name,
      email: formData.email,
      contact: formData.phone,
      role: formData.role,
      photo: formData.photo,
    };
    
    if (formData.role !== 'Admin') {
      if (!formData.panNumber || !validatePanNumber(formData.panNumber)) {
        toast({
          title: "Invalid PAN",
          description: "Please enter a valid PAN number (e.g., ABCDE1234F)",
          variant: "destructive",
        });
        return;
      }

      if (!formData.aadharNumber || !validateAadharNumber(formData.aadharNumber)) {
        toast({
          title: "Invalid Aadhar",
          description: "Please enter a valid 12-digit Aadhar number",
          variant: "destructive",
        });
        return;
      }

      if (formData.documents.length === 0) {
        toast({
          title: "Documents Required",
          description: "Please upload at least one document (Aadhar or PAN card)",
          variant: "destructive",
        });
        return;
      }

      updateData.panNumber = formData.panNumber.toUpperCase();
      updateData.aadharNumber = formData.aadharNumber;
      updateData.documents = formData.documents;
      updateData.salary = parseFloat(formData.salary);
      updateData.joiningDate = formData.joiningDate;
    }
    
    updateEmployeeMutation.mutate({
      id: selectedEmployee._id,
      data: updateData,
    });
  };

  const handleSendOtp = () => {
    if (!formData.phone) {
      toast({
        title: "Error",
        description: "Please enter a phone number first",
        variant: "destructive",
      });
      return;
    }
    sendOtpMutation.mutate({ mobileNumber: formData.phone, purpose: 'employee_verification' });
  };

  const handleVerifyOtp = () => {
    if (!otpCode) {
      toast({
        title: "Error",
        description: "Please enter the OTP code",
        variant: "destructive",
      });
      return;
    }
    verifyOtpMutation.mutate({ mobileNumber: formData.phone, otp: otpCode, purpose: 'employee_verification' });
  };

  const handleSendEditOtp = () => {
    if (!formData.phone) {
      toast({
        title: "Error",
        description: "Please enter a phone number first",
        variant: "destructive",
      });
      return;
    }
    if (selectedEmployee && formData.phone === selectedEmployee.contact) {
      setEditOtpVerified(true);
      return;
    }
    sendEditOtpMutation.mutate({ mobileNumber: formData.phone, purpose: 'phone_update' });
  };

  const handleVerifyEditOtp = () => {
    if (!editOtpCode) {
      toast({
        title: "Error",
        description: "Please enter the OTP code",
        variant: "destructive",
      });
      return;
    }
    verifyEditOtpMutation.mutate({ mobileNumber: formData.phone, otp: editOtpCode, purpose: 'phone_update' });
  };

  const resetCreateForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "",
      salary: "",
      joiningDate: "",
      panNumber: "",
      aadharNumber: "",
      photo: "",
      documents: [] as string[],
    });
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode("");
  };

  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsViewDialogOpen(true);
  };

  const handleDeleteEmployee = (employee: Employee) => {
    if (employee.role === 'Admin' && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only Admin users can delete Admin accounts",
        variant: "destructive",
      });
      return;
    }
    if (confirm('Are you sure you want to delete this employee?')) {
      deleteEmployeeMutation.mutate(employee._id);
    }
  };

  const handleToggleActive = (employee: Employee) => {
    updateEmployeeMutation.mutate({
      id: employee._id,
      data: {
        isActive: !employee.isActive
      }
    });
  };

  const filteredAndSortedEmployees = employees
    .filter((emp: Employee) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.email && emp.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.employeeId && emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'id-asc':
          return (a.employeeId || '').localeCompare(b.employeeId || '');
        case 'id-desc':
          return (b.employeeId || '').localeCompare(a.employeeId || '');
        case 'role-asc':
          return a.role.localeCompare(b.role);
        case 'role-desc':
          return b.role.localeCompare(a.role);
        default:
          return 0;
      }
    });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleCardColor = (role: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700/50';
      case 'Manager':
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50';
      case 'Inventory Manager':
        return 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700/50';
      case 'Sales Executive':
        return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700/50';
      case 'HR Manager':
        return 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700/50';
      case 'Service Staff':
        return 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-700/50';
      default:
        return 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700/50';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Employees</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <User className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load employees</h3>
              <p className="text-muted-foreground mb-4">
                {(error as Error)?.message || 'An error occurred while fetching employees'}
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
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground mt-1 text-sm">All employees have user accounts for system access</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-employee">
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>
                Add a new employee to your team
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-employee-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    data-testid="input-employee-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  placeholder="Enter login password"
                  data-testid="input-employee-password"
                />
                <p className="text-xs text-muted-foreground">This password will be used for employee login</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">Employee Photo *</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  required={!formData.photo}
                  data-testid="input-employee-photo"
                />
                <p className="text-xs text-muted-foreground">Required: Upload a photo of the employee</p>
                {formData.photo && (
                  <div className="flex items-center gap-4 mt-2">
                    <img 
                      src={formData.photo} 
                      alt="Employee preview" 
                      className="h-20 w-20 rounded-full object-cover border-2"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, photo: "" })}
                    >
                      Remove Photo
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value });
                        setOtpSent(false);
                        setOtpVerified(false);
                        setOtpCode("");
                      }}
                      required
                      data-testid="input-employee-phone"
                      disabled={otpVerified}
                    />
                    <Button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={!formData.phone || otpSent || otpVerified || sendOtpMutation.isPending}
                      data-testid="button-send-otp"
                    >
                      {sendOtpMutation.isPending ? "Sending..." : otpVerified ? "Verified" : otpSent ? "Sent" : "Send OTP"}
                    </Button>
                  </div>
                  {otpSent && !otpVerified && (
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Enter OTP"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        data-testid="input-otp-code"
                      />
                      <Button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={!otpCode || verifyOtpMutation.isPending}
                        data-testid="button-verify-otp"
                      >
                        {verifyOtpMutation.isPending ? "Verifying..." : "Verify"}
                      </Button>
                    </div>
                  )}
                  {otpVerified && (
                    <p className="text-sm text-green-600 dark:text-green-400">✓ Phone number verified</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    required
                  >
                    <SelectTrigger data-testid="select-employee-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {isAdmin && <SelectItem value="Admin">Admin</SelectItem>}
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Inventory Manager">Inventory Manager</SelectItem>
                      <SelectItem value="Sales Executive">Sales Executive</SelectItem>
                      <SelectItem value="HR Manager">HR Manager</SelectItem>
                      <SelectItem value="Service Staff">Service Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.role !== 'Admin' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="salary">Salary *</Label>
                    <Input
                      id="salary"
                      type="number"
                      step="0.01"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                      required
                      data-testid="input-employee-salary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="joiningDate">Joining Date *</Label>
                    <Input
                      id="joiningDate"
                      type="date"
                      value={formData.joiningDate}
                      onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                      required
                      data-testid="input-employee-joiningdate"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="panNumber">PAN Number *</Label>
                      <Input
                        id="panNumber"
                        value={formData.panNumber}
                        onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        required
                        data-testid="input-employee-pan"
                      />
                      <p className="text-xs text-muted-foreground">Format: 10 alphanumeric characters (e.g., ABCDE1234F)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="aadharNumber">Aadhar Number *</Label>
                      <Input
                        id="aadharNumber"
                        value={formData.aadharNumber}
                        onChange={(e) => setFormData({ ...formData, aadharNumber: formatAadharNumber(e.target.value) })}
                        placeholder="1234 5678 9012"
                        maxLength={14}
                        required
                        data-testid="input-employee-aadhar"
                      />
                      <p className="text-xs text-muted-foreground">Format: 12 digits with spaces (e.g., 1234 5678 9012)</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="documents">Upload Documents (PDF) *</Label>
                    <Input
                      id="documents"
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handleFileUpload}
                      data-testid="input-employee-documents"
                    />
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                      Note: Please upload at least one document - Aadhar card or PAN card (Required)
                    </p>
                    {formData.documents.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <p className="text-sm text-muted-foreground">Uploaded files ({formData.documents.length}):</p>
                        <div className="space-y-1">
                          {formData.documents.map((doc, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm flex-1">Document {index + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDocument(index)}
                                data-testid={`button-remove-document-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancel-employee"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEmployeeMutation.isPending || !otpVerified}
                  data-testid="button-submit-employee"
                >
                  {createEmployeeMutation.isPending ? 'Creating...' : 'Create Employee'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-sort">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="id-asc">Employee ID (Asc)</SelectItem>
              <SelectItem value="id-desc">Employee ID (Desc)</SelectItem>
              <SelectItem value="role-asc">Role (A-Z)</SelectItem>
              <SelectItem value="role-desc">Role (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredAndSortedEmployees.length > 0 ? (
        <div className="space-y-8">
          {/* Admin Section */}
          {filteredAndSortedEmployees.filter((emp: Employee) => emp.role === 'Admin').length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Admin</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredAndSortedEmployees
                  .filter((emp: Employee) => emp.role === 'Admin')
                  .map((employee: any) => (
                    <Card key={employee._id} className={`hover-elevate ${getRoleCardColor(employee.role)}`} data-testid={`card-employee-${employee._id}`}>
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-20 w-20">
                            {employee.photo ? (
                              <img 
                                src={employee.photo} 
                                alt={employee.name} 
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <AvatarFallback className="text-2xl">{getInitials(employee.name)}</AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{employee.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{employee.role}</p>
                            {employee.employeeId && (
                              <p className="text-xs text-muted-foreground mt-1" data-testid={`text-employeeid-${employee._id}`}>ID: {employee.employeeId}</p>
                            )}
                          </div>
                          {employee.isActive ? (
                            <Badge variant="default" data-testid={`status-active-${employee._id}`}>Active</Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`status-inactive-${employee._id}`}>Inactive</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <p className="text-sm">{employee.isActive ? 'Active' : 'Inactive'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`toggle-active-${employee._id}`} className="text-xs">
                              Mark as {employee.isActive ? 'Inactive' : 'Active'}
                            </Label>
                            <Switch
                              id={`toggle-active-${employee._id}`}
                              checked={employee.isActive}
                              onCheckedChange={() => handleToggleActive(employee)}
                              data-testid={`toggle-active-${employee._id}`}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Contact</p>
                          <p className="text-sm">{employee.contact}</p>
                        </div>
                        {employee.email && (
                          <div>
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-sm">{employee.email}</p>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1" 
                            onClick={() => handleEditEmployee(employee)} 
                            disabled={employee.role === 'Admin' && !isAdmin}
                            data-testid={`button-edit-${employee._id}`}
                          >
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewEmployee(employee)} data-testid={`button-view-${employee._id}`}>
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Employee Section */}
          {filteredAndSortedEmployees.filter((emp: Employee) => emp.role !== 'Admin').length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Employee</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredAndSortedEmployees
                  .filter((emp: Employee) => emp.role !== 'Admin')
                  .map((employee: any) => (
                    <Card key={employee._id} className={`hover-elevate ${getRoleCardColor(employee.role)}`} data-testid={`card-employee-${employee._id}`}>
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-20 w-20">
                            {employee.photo ? (
                              <img 
                                src={employee.photo} 
                                alt={employee.name} 
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <AvatarFallback className="text-2xl">{getInitials(employee.name)}</AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{employee.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{employee.role}</p>
                            {employee.employeeId && (
                              <p className="text-xs text-muted-foreground mt-1" data-testid={`text-employeeid-${employee._id}`}>ID: {employee.employeeId}</p>
                            )}
                          </div>
                          {employee.isActive ? (
                            <Badge variant="default" data-testid={`status-active-${employee._id}`}>Active</Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`status-inactive-${employee._id}`}>Inactive</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <p className="text-sm">{employee.isActive ? 'Active' : 'Inactive'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`toggle-active-${employee._id}`} className="text-xs">
                              Mark as {employee.isActive ? 'Inactive' : 'Active'}
                            </Label>
                            <Switch
                              id={`toggle-active-${employee._id}`}
                              checked={employee.isActive}
                              onCheckedChange={() => handleToggleActive(employee)}
                              data-testid={`toggle-active-${employee._id}`}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Contact</p>
                          <p className="text-sm">{employee.contact}</p>
                        </div>
                        {employee.email && (
                          <div>
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-sm">{employee.email}</p>
                          </div>
                        )}
                        {employee.role !== 'Admin' && (
                          <div>
                            <p className="text-xs text-muted-foreground">Joining Date</p>
                            <p className="text-sm">{format(new Date(employee.joiningDate), 'dd MMM, yyyy')}</p>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1" 
                            onClick={() => handleEditEmployee(employee)} 
                            disabled={employee.role === 'Admin' && !isAdmin}
                            data-testid={`button-edit-${employee._id}`}
                          >
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewEmployee(employee)} data-testid={`button-view-${employee._id}`}>
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : employees.length > 0 ? (
        <div className="text-center py-12">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No employees match your search criteria</p>
        </div>
      ) : (
        <div className="text-center py-12">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No employees found. Add your first employee to get started.</p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-photo">Employee Photo *</Label>
              <Input
                id="edit-photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                required={!formData.photo}
              />
              <p className="text-xs text-muted-foreground">Required: Upload a photo of the employee</p>
              {formData.photo && (
                <div className="flex items-center gap-4 mt-2">
                  <img 
                    src={formData.photo} 
                    alt="Employee preview" 
                    className="h-20 w-20 rounded-full object-cover border-2"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, photo: "" })}
                  >
                    Remove Photo
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone *</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-phone"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      setEditOtpSent(false);
                      setEditOtpVerified(false);
                      setEditOtpCode("");
                    }}
                    required
                    disabled={editOtpVerified}
                  />
                  <Button
                    type="button"
                    onClick={handleSendEditOtp}
                    disabled={!formData.phone || editOtpSent || (selectedEmployee && formData.phone === selectedEmployee.contact) || sendEditOtpMutation.isPending}
                    data-testid="button-send-edit-otp"
                  >
                    {sendEditOtpMutation.isPending ? "Sending..." : editOtpVerified || (selectedEmployee && formData.phone === selectedEmployee.contact) ? "Verified" : editOtpSent ? "Sent" : "Send OTP"}
                  </Button>
                </div>
                {editOtpSent && !editOtpVerified && selectedEmployee && formData.phone !== selectedEmployee.contact && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Enter OTP"
                      value={editOtpCode}
                      onChange={(e) => setEditOtpCode(e.target.value)}
                      data-testid="input-edit-otp-code"
                    />
                    <Button
                      type="button"
                      onClick={handleVerifyEditOtp}
                      disabled={!editOtpCode || verifyEditOtpMutation.isPending}
                      data-testid="button-verify-edit-otp"
                    >
                      {verifyEditOtpMutation.isPending ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                )}
                {(editOtpVerified || (selectedEmployee && formData.phone === selectedEmployee.contact)) && (
                  <p className="text-sm text-green-600 dark:text-green-400">✓ Phone number verified</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdmin && <SelectItem value="Admin">Admin</SelectItem>}
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Inventory Manager">Inventory Manager</SelectItem>
                    <SelectItem value="Sales Executive">Sales Executive</SelectItem>
                    <SelectItem value="HR Manager">HR Manager</SelectItem>
                    <SelectItem value="Service Staff">Service Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.role !== 'Admin' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-salary">Salary *</Label>
                  <Input
                    id="edit-salary"
                    type="number"
                    step="0.01"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-joiningDate">Joining Date *</Label>
                  <Input
                    id="edit-joiningDate"
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-panNumber">PAN Number *</Label>
                    <Input
                      id="edit-panNumber"
                      value={formData.panNumber}
                      onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Format: 10 alphanumeric characters (e.g., ABCDE1234F)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-aadharNumber">Aadhar Number *</Label>
                    <Input
                      id="edit-aadharNumber"
                      value={formData.aadharNumber}
                      onChange={(e) => setFormData({ ...formData, aadharNumber: formatAadharNumber(e.target.value) })}
                      placeholder="1234 5678 9012"
                      maxLength={14}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Format: 12 digits with spaces (e.g., 1234 5678 9012)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-documents">Upload Documents (PDF) *</Label>
                  <Input
                    id="edit-documents"
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileUpload}
                  />
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                    Note: Please upload at least one document - Aadhar card or PAN card (Required)
                  </p>
                  {formData.documents.length > 0 && (
                    <div className="space-y-2 mt-2">
                      <p className="text-sm text-muted-foreground">Uploaded files ({formData.documents.length}):</p>
                      <div className="space-y-1">
                        {formData.documents.map((doc, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm flex-1">Document {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDocument(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateEmployeeMutation.isPending || (!!selectedEmployee && formData.phone !== selectedEmployee.contact && !editOtpVerified)}
                data-testid="button-update-employee"
              >
                {updateEmployeeMutation.isPending ? 'Updating...' : 'Update Employee'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {selectedEmployee.photo ? (
                    <img 
                      src={selectedEmployee.photo} 
                      alt={selectedEmployee.name} 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <AvatarFallback className="text-2xl">{getInitials(selectedEmployee.name)}</AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedEmployee.name}</h3>
                  <p className="text-muted-foreground">{selectedEmployee.role}</p>
                  {selectedEmployee.employeeId && (
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-view-employeeid">ID: {selectedEmployee.employeeId}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p className="text-sm font-medium">{selectedEmployee.contact}</p>
                </div>
                {selectedEmployee.email && (
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{selectedEmployee.email}</p>
                  </div>
                )}
                {selectedEmployee.salary && (
                  <div>
                    <p className="text-xs text-muted-foreground">Salary</p>
                    <p className="text-sm font-medium">₹{selectedEmployee.salary.toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Joining Date</p>
                  <p className="text-sm font-medium">{format(new Date(selectedEmployee.joiningDate), 'dd MMM, yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  {selectedEmployee.isActive ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
                {selectedEmployee.role !== 'Admin' && selectedEmployee.panNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground">PAN Number</p>
                    <p className="text-sm font-medium">{selectedEmployee.panNumber}</p>
                  </div>
                )}
                {selectedEmployee.role !== 'Admin' && selectedEmployee.aadharNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground">Aadhar Number</p>
                    <p className="text-sm font-medium">{selectedEmployee.aadharNumber}</p>
                  </div>
                )}
              </div>
              {selectedEmployee.role !== 'Admin' && selectedEmployee.documents && selectedEmployee.documents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Documents</p>
                  <div className="space-y-1">
                    {selectedEmployee.documents.map((doc, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setViewingDocument(doc)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Document {index + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
                <Button variant="destructive" onClick={() => {
                  setIsViewDialogOpen(false);
                  handleDeleteEmployee(selectedEmployee);
                }}>
                  Delete Employee
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Viewer Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Document Viewer</DialogTitle>
          </DialogHeader>
          <div className="w-full h-[70vh] overflow-auto">
            {viewingDocument && (
              <iframe
                src={viewingDocument}
                className="w-full h-full border-0"
                title="Document Viewer"
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setViewingDocument(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Crop Dialog */}
      <ImageCropDialog
        open={isCropDialogOpen}
        onOpenChange={setIsCropDialogOpen}
        imageSrc={imageToCrop}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
