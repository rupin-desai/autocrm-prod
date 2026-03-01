import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, CheckCircle, XCircle, Car, User, MapPin, Phone, Mail, Edit, Trash2, CalendarIcon, SortAsc, Store } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getPartById } from "@shared/vehicleData";

// Vehicle Brands
const VEHICLE_BRANDS = [
  "Maruti Suzuki", "Hyundai", "Tata", "Mahindra", "Kia",
  "Honda", "Toyota", "Ford", "Renault", "Nissan",
  "Volkswagen", "Skoda", "MG", "Jeep", "Citroen"
];

// Referral sources
const REFERRAL_SOURCES = [
  "Facebook",
  "Instagram",
  "WhatsApp",
  "Google Search",
  "Friend/Family Referral",
  "Billboard/Hoarding",
  "Newspaper/Magazine",
  "Radio/TV",
  "Direct Visit",
  "Other"
];

interface Customer {
  id: string;
  referenceCode: string;
  fullName: string;
  mobileNumber: string;
  alternativeNumber: string | null;
  email: string;
  address: string;
  city: string;
  taluka: string;
  district: string;
  state: string;
  pinCode: string;
  referralSource?: string | null;
  isVerified: boolean;
  registeredBy?: string | null;
  registeredByRole?: string | null;
  createdAt: Date;
}

interface Vehicle {
  id: string;
  vehicleId: string;
  customerId: string;
  vehicleNumber: string;
  vehicleBrand: string;
  vehicleModel: string;
  customModel?: string | null;
  variant?: 'Top' | 'Base' | null;
  color?: string | null;
  yearOfPurchase: number | null;
  vehiclePhoto: string;
  isNewVehicle: boolean;
  chassisNumber?: string | null;
  selectedParts: Array<{ partId: string; quantity: number }>;
  warrantyCard?: string | null;
  warrantyCards?: Array<{
    partId: string;
    partName: string;
    fileData: string;
  }>;
  createdAt: Date;
}

const editCustomerSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  mobileNumber: z.string().min(10, "Mobile number must be at least 10 digits"),
  alternativeNumber: z.string().optional(),
  email: z.string().email("Invalid email address"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City/Village is required"),
  taluka: z.string().min(1, "Taluka is required"),
  district: z.string().min(1, "District is required"),
  state: z.string().min(1, "State is required"),
  pinCode: z.string().min(6, "Pin code must be 6 digits"),
  referralSource: z.string().optional(),
  isVerified: z.boolean(),
  vehicleNumber: z.string().optional(),
  vehicleBrand: z.string().optional(),
  vehicleModel: z.string().optional(),
  yearOfPurchase: z.string().optional(),
  vehiclePhoto: z.string().optional(),
  warrantyCard: z.string().optional(),
});

// Customer-Vehicle Card Component (shows one card per vehicle)
function CustomerVehicleCard({ 
  customer, 
  vehicle,
  totalVehicles,
  isAdmin, 
  onEdit, 
  onDeleteVehicle,
  onViewDetails 
}: { 
  customer: Customer; 
  vehicle: Vehicle;
  totalVehicles: number;
  isAdmin: boolean; 
  onEdit: (customer: Customer) => void;
  onDeleteVehicle: (vehicleId: string, isLastVehicle: boolean) => void;
  onViewDetails: (customer: Customer) => void;
}) {
  const { data: productsData, isLoading: loadingProducts } = useQuery<{ 
    products: Array<{ 
      id: string; 
      name: string; 
      category: string; 
      price: number; 
      warranty?: string;
      source: string;
    }>;
    notFound: string[];
  }>({
    queryKey: ['/api/products/resolve-by-ids', JSON.stringify(vehicle.selectedParts?.map(p => p.partId) || [])],
    enabled: !!(vehicle.selectedParts && vehicle.selectedParts.length > 0),
    queryFn: async () => {
      const productIds = vehicle.selectedParts.map(p => p.partId);
      const response = await apiRequest('POST', '/api/products/resolve-by-ids', { productIds });
      return response.json();
    }
  });

  const productMap = new Map(
    productsData?.products.map((p: any) => [p.id, p]) || []
  );

  return (
    <Card className="overflow-hidden border-2 border-orange-300 dark:border-orange-700" data-testid={`card-customer-vehicle-${customer.id}-${vehicle.id}`}>
      <CardContent className="p-0">
        {/* Vehicle Image */}
        {vehicle.vehiclePhoto && (
          <div className="w-full h-48 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/30 dark:to-yellow-950/30 flex items-center justify-center border-2 border-orange-300 dark:border-orange-700">
            <img 
              src={vehicle.vehiclePhoto} 
              alt={`${vehicle.vehicleBrand} ${vehicle.vehicleModel}`} 
              className="h-full w-full object-contain p-2"
              data-testid={`img-vehicle-card-${vehicle.id}`}
            />
          </div>
        )}
        
        {/* Customer Details */}
        <div className="p-4 space-y-3">
          {/* Header with name and status */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg" data-testid={`text-name-${customer.id}-${vehicle.id}`}>
                {customer.fullName}
              </h3>
              <p className="text-xs text-muted-foreground font-mono" data-testid={`text-ref-${customer.id}-${vehicle.id}`}>
                {customer.referenceCode}
              </p>
            </div>
            {customer.isVerified ? (
              <Badge className="bg-green-600" data-testid={`badge-verified-${customer.id}-${vehicle.id}`}>
                <CheckCircle className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary" data-testid={`badge-pending-${customer.id}-${vehicle.id}`}>
                <XCircle className="w-3 h-3 mr-1" />
                Pending
              </Badge>
            )}
          </div>

          {/* Vehicle Info */}
          <div className="flex items-center gap-2 text-sm">
            <Car className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">
              {vehicle.vehicleBrand} {vehicle.vehicleModel}
            </span>
            <span className="text-muted-foreground">• {vehicle.vehicleNumber}</span>
            {totalVehicles > 1 && (
              <Badge variant="outline" className="ml-auto" data-testid={`badge-total-vehicles-${customer.id}-${vehicle.id}`}>
                {totalVehicles} vehicles
              </Badge>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="truncate" data-testid={`text-email-${customer.id}`}>{customer.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span data-testid={`text-location-${customer.id}`}>{customer.city}, {customer.state}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span data-testid={`text-registered-by-${customer.id}`}>
                {customer.registeredBy && customer.registeredByRole 
                  ? `Registered by: ${customer.registeredBy} (${customer.registeredByRole})`
                  : `Registered by: ${customer.fullName}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span data-testid={`text-enrollment-date-${customer.id}`}>
                Enrolled: {new Date(customer.createdAt).toLocaleDateString('en-IN', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                })}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onViewDetails(customer)}
              data-testid={`button-view-${customer.id}`}
            >
              View Details
            </Button>
            
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(customer)}
                  data-testid={`button-edit-${customer.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`button-delete-${customer.id}-${vehicle.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Vehicle?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {totalVehicles === 1 ? (
                          <>
                            This will permanently delete the vehicle <strong>{vehicle.vehicleNumber}</strong> ({vehicle.vehicleBrand} {vehicle.vehicleModel}).
                            <br /><br />
                            <strong className="text-destructive">Warning:</strong> This is the only vehicle for customer "{customer.fullName}". 
                            The customer record will remain in the system.
                          </>
                        ) : (
                          <>
                            This will permanently delete the vehicle <strong>{vehicle.vehicleNumber}</strong> ({vehicle.vehicleBrand} {vehicle.vehicleModel}).
                            <br /><br />
                            Customer "{customer.fullName}" has {totalVehicles - 1} other vehicle(s) that will not be affected.
                          </>
                        )}
                        <br /><br />
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDeleteVehicle(vehicle.id, totalVehicles === 1)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Vehicle
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerRegistrationDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [sortOption, setSortOption] = useState<"all" | "latest" | "last10" | "dateRange">("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  
  const isAdmin = user?.role === 'Admin' || user?.role === 'Manager';
  
  // Get selected shop from localStorage
  const selectedShopId = localStorage.getItem('selectedShop');
  const shopName = selectedShopId === 'beed' ? 'Shop A - Beed' : selectedShopId === 'ahilyanagar' ? 'Shop B - Chhatrapati Sambhaji Nagar' : 'Shop Not Selected';

  // Fetch all customers
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/registration/customers", cityFilter, districtFilter, stateFilter, verifiedFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityFilter && cityFilter !== "all") params.append("city", cityFilter);
      if (districtFilter && districtFilter !== "all") params.append("district", districtFilter);
      if (stateFilter && stateFilter !== "all") params.append("state", stateFilter);
      if (verifiedFilter && verifiedFilter !== "all") params.append("isVerified", verifiedFilter);
      
      const response = await fetch(`/api/registration/customers?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
  });

  // Fetch all vehicles for search functionality
  const { data: allVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/registration/vehicles"],
    queryFn: async () => {
      const response = await fetch(`/api/registration/vehicles`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch customer vehicles when selected
  const { data: customerVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/registration/customers", selectedCustomer?.id, "vehicles"],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      const response = await fetch(`/api/registration/customers/${selectedCustomer.id}/vehicles`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      return response.json();
    },
    enabled: !!selectedCustomer?.id,
  });

  // Fetch products for customer vehicles
  const allCustomerVehiclePartIds = customerVehicles.flatMap(v => 
    (v.selectedParts || []).map(part => part.partId)
  );
  const { data: customerVehicleProductsData, isLoading: loadingProducts } = useQuery<{
    products: Array<{
      id: string;
      name: string;
      category: string;
      price: number;
      warranty?: string;
      source: string;
    }>;
    notFound: string[];
  }>({
    queryKey: ['/api/products/resolve-by-ids', JSON.stringify(allCustomerVehiclePartIds)],
    enabled: allCustomerVehiclePartIds.length > 0,
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/products/resolve-by-ids', { productIds: allCustomerVehiclePartIds });
      return response.json();
    }
  });

  const productMap = new Map(
    customerVehicleProductsData?.products.map((p: any) => [p.id, p]) || []
  );
  
  // Fetch editing customer vehicles
  const { data: editingVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/registration/customers", editingCustomer?.id, "vehicles"],
    queryFn: async () => {
      if (!editingCustomer?.id) return [];
      const response = await fetch(`/api/registration/customers/${editingCustomer.id}/vehicles`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!editingCustomer?.id,
  });

  // Edit form
  const editForm = useForm<z.infer<typeof editCustomerSchema>>({
    resolver: zodResolver(editCustomerSchema),
    defaultValues: {
      fullName: "",
      mobileNumber: "",
      alternativeNumber: "",
      email: "",
      address: "",
      city: "",
      taluka: "",
      district: "",
      state: "",
      pinCode: "",
      referralSource: "",
      isVerified: false,
      vehicleNumber: "",
      vehicleBrand: "",
      vehicleModel: "",
      yearOfPurchase: "",
      vehiclePhoto: "",
      warrantyCard: "",
    },
  });

  // Update form when editing customer or vehicles change
  useEffect(() => {
    if (editingCustomer) {
      const primaryVehicle = editingVehicles[0];
      editForm.reset({
        fullName: editingCustomer.fullName,
        mobileNumber: editingCustomer.mobileNumber,
        alternativeNumber: editingCustomer.alternativeNumber || "",
        email: editingCustomer.email,
        address: editingCustomer.address,
        city: editingCustomer.city,
        taluka: editingCustomer.taluka,
        district: editingCustomer.district,
        state: editingCustomer.state,
        pinCode: editingCustomer.pinCode,
        referralSource: editingCustomer.referralSource || "",
        isVerified: editingCustomer.isVerified,
        vehicleNumber: primaryVehicle?.vehicleNumber || "",
        vehicleBrand: primaryVehicle?.vehicleBrand || "",
        vehicleModel: primaryVehicle?.vehicleModel || "",
        yearOfPurchase: primaryVehicle?.yearOfPurchase?.toString() || "",
        vehiclePhoto: primaryVehicle?.vehiclePhoto || "",
        warrantyCard: primaryVehicle?.warrantyCard || "",
      });
      setEditingVehicle(primaryVehicle || null);
    }
  }, [editingCustomer, editingVehicles, editForm]);

  // Edit customer mutation
  const editMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editCustomerSchema>) => {
      if (!editingCustomer) throw new Error("No customer selected");
      
      const customerData = {
        fullName: data.fullName,
        mobileNumber: data.mobileNumber,
        alternativeNumber: data.alternativeNumber,
        email: data.email,
        address: data.address,
        city: data.city,
        taluka: data.taluka,
        district: data.district,
        state: data.state,
        pinCode: data.pinCode,
        referralSource: data.referralSource,
        isVerified: data.isVerified,
      };
      
      await apiRequest("PATCH", `/api/registration/customers/${editingCustomer.id}`, customerData);
      
      if (editingVehicle && data.vehicleNumber) {
        const vehicleData = {
          vehicleNumber: data.vehicleNumber,
          vehicleBrand: data.vehicleBrand,
          vehicleModel: data.vehicleModel,
          yearOfPurchase: data.yearOfPurchase ? parseInt(data.yearOfPurchase) : null,
          vehiclePhoto: data.vehiclePhoto,
          warrantyCard: data.warrantyCard,
        };
        
        await apiRequest("PATCH", `/api/registration/vehicles/${editingVehicle.id}`, vehicleData);
      }
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registration/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/registration/vehicles"] });
      setEditDialogOpen(false);
      setEditingCustomer(null);
      setEditingVehicle(null);
      editForm.reset();
      toast({
        title: "Success",
        description: "Customer and vehicle updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      });
    },
  });

  // Delete customer mutation
  const deleteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return apiRequest("DELETE", `/api/registration/customers/${customerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registration/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/registration/vehicles"] });
      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    },
  });

  // Delete vehicle mutation
  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      return apiRequest("DELETE", `/api/registration/vehicles/${vehicleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/registration/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/registration/vehicles"] });
      toast({
        title: "Success",
        description: "Vehicle deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete vehicle",
        variant: "destructive",
      });
    },
  });

  // Filter customers by search term (including vehicle registration number and chassis number)
  let filteredCustomers = customers.filter(customer => {
    const searchLower = searchTerm.toLowerCase();
    
    // Search in customer fields
    const customerMatch = (
      customer.fullName.toLowerCase().includes(searchLower) ||
      customer.mobileNumber.includes(searchTerm) ||
      customer.email.toLowerCase().includes(searchLower) ||
      customer.referenceCode.toLowerCase().includes(searchLower)
    );
    
    // Search in vehicle fields (registration number and chassis number)
    const customerVehicles = allVehicles.filter(v => v.customerId === customer.id);
    const vehicleMatch = customerVehicles.some(vehicle => 
      (vehicle.vehicleNumber && vehicle.vehicleNumber.toLowerCase().includes(searchLower)) ||
      (vehicle.chassisNumber && vehicle.chassisNumber.toLowerCase().includes(searchLower))
    );
    
    return customerMatch || vehicleMatch;
  });

  // Apply sorting and date filtering
  if (sortOption === "latest") {
    // Sort by latest added (newest first)
    filteredCustomers = [...filteredCustomers].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } else if (sortOption === "last10") {
    // Get last 10 customers (latest added)
    filteredCustomers = [...filteredCustomers]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  } else if (sortOption === "dateRange" && dateFrom && dateTo) {
    // Filter by date range
    filteredCustomers = filteredCustomers.filter(customer => {
      const customerDate = new Date(customer.createdAt);
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      // Set time to start and end of day for accurate comparison
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
      return customerDate >= fromDate && customerDate <= toDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Get unique values for filters
  const cities = Array.from(new Set(customers.map(c => c.city))).filter(Boolean);
  const districts = Array.from(new Set(customers.map(c => c.district))).filter(Boolean);
  const states = Array.from(new Set(customers.map(c => c.state))).filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customer Registration Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              View and manage all registered customers and their vehicles
            </p>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 px-4 py-2 rounded-lg border border-primary/20">
            <Store className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Current Shop</p>
              <p className="font-semibold text-sm" data-testid="text-current-shop">{shopName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter customers by various criteria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, mobile, email, reference code, vehicle number, or chassis number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search"
              className="flex-1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger data-testid="select-filter-city">
                <SelectValue placeholder="Filter by City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-city-all">All Cities</SelectItem>
                {cities.map(city => (
                  <SelectItem key={city} value={city} data-testid={`option-city-${city.toLowerCase().replace(/\s+/g, '-')}`}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={districtFilter} onValueChange={setDistrictFilter}>
              <SelectTrigger data-testid="select-filter-district">
                <SelectValue placeholder="Filter by District" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-district-all">All Districts</SelectItem>
                {districts.map(district => (
                  <SelectItem key={district} value={district} data-testid={`option-district-${district.toLowerCase().replace(/\s+/g, '-')}`}>{district}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger data-testid="select-filter-state">
                <SelectValue placeholder="Filter by State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-state-all">All States</SelectItem>
                {states.map(state => (
                  <SelectItem key={state} value={state} data-testid={`option-state-${state.toLowerCase().replace(/\s+/g, '-')}`}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
              <SelectTrigger data-testid="select-filter-verified">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-verified-all">All Status</SelectItem>
                <SelectItem value="true" data-testid="option-verified-true">Verified</SelectItem>
                <SelectItem value="false" data-testid="option-verified-false">Unverified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort and Date Range Filters */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <SortAsc className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-medium text-sm">Sort & Date Filters</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={sortOption} onValueChange={(value: any) => {
                setSortOption(value);
                if (value !== "dateRange") {
                  setDateFrom(undefined);
                  setDateTo(undefined);
                }
              }}>
                <SelectTrigger data-testid="select-sort-option">
                  <SelectValue placeholder="Sort Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-sort-all">All Customers</SelectItem>
                  <SelectItem value="latest" data-testid="option-sort-latest">Latest Added</SelectItem>
                  <SelectItem value="last10" data-testid="option-sort-last10">Last 10 Customers</SelectItem>
                  <SelectItem value="dateRange" data-testid="option-sort-daterange">Date Range</SelectItem>
                </SelectContent>
              </Select>

              {sortOption === "dateRange" && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start text-left font-normal"
                        data-testid="button-date-from"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PPP") : "From Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        data-testid="calendar-from"
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start text-left font-normal"
                        data-testid="button-date-to"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PPP") : "To Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        data-testid="calendar-to"
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>
          </div>

          {(cityFilter && cityFilter !== "all" || districtFilter && districtFilter !== "all" || stateFilter && stateFilter !== "all" || verifiedFilter && verifiedFilter !== "all" || searchTerm || sortOption !== "all" || dateFrom || dateTo) && (
            <Button 
              variant="outline" 
              onClick={() => {
                setCityFilter("all");
                setDistrictFilter("all");
                setStateFilter("all");
                setVerifiedFilter("all");
                setSearchTerm("");
                setSortOption("all");
                setDateFrom(undefined);
                setDateTo(undefined);
              }}
              data-testid="button-clear-filters"
            >
              Clear All Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-customers">{customers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-verified-customers">
              {customers.filter(c => c.isVerified).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-pending-customers">
              {customers.filter(c => !c.isVerified).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customers Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Registered Customers</h2>
            <p className="text-muted-foreground">
              {filteredCustomers.length} customers • {
                filteredCustomers.reduce((total, customer) => {
                  const customerVehicles = allVehicles.filter(v => v.customerId === customer.id);
                  return total + customerVehicles.length;
                }, 0)
              } vehicles
            </p>
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-8">Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              No customers found matching your criteria
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.flatMap((customer) => {
              const customerVehicles = allVehicles.filter(v => v.customerId === customer.id);
              
              // Show all customers, even those without vehicles
              if (customerVehicles.length === 0) {
                // Create a placeholder card for customers without vehicles
                return [(
                  <Card key={customer.id} className="border-orange-200 dark:border-orange-800">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-5 h-5" />
                          <CardTitle className="text-lg">{customer.fullName}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          {customer.isVerified ? (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription className="uppercase tracking-wide">
                        {customer.referenceCode}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{customer.mobileNumber}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{customer.city}, {customer.state}</span>
                      </div>
                      <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <p className="text-sm text-orange-700 dark:text-orange-400 font-medium">
                          ⚠️ No vehicles registered
                        </p>
                        <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                          This customer has no vehicles. You can delete this record if it's a duplicate.
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCustomer(customer)}
                            className="flex-1"
                            data-testid={`button-view-${customer.id}`}
                          >
                            View Details
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                data-testid={`button-delete-${customer.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {customer.fullName}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(customer.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )];
              }
              
              return customerVehicles.map((vehicle) => (
                <CustomerVehicleCard
                  key={`${customer.id}-${vehicle.id}`}
                  customer={customer}
                  vehicle={vehicle}
                  totalVehicles={customerVehicles.length}
                  isAdmin={isAdmin}
                  onEdit={(customer) => {
                    setEditingCustomer(customer);
                    setEditDialogOpen(true);
                  }}
                  onDeleteVehicle={(vehicleId) => deleteVehicleMutation.mutate(vehicleId)}
                  onViewDetails={(customer) => setSelectedCustomer(customer)}
                />
              ));
            })}
          </div>
        )}

        {/* Customer Details Dialog */}
        <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Customer Details</DialogTitle>
              <DialogDescription>
                Reference ID: {selectedCustomer?.referenceCode}
              </DialogDescription>
            </DialogHeader>

            {selectedCustomer && (
              <div className="space-y-6">
                {/* Customer Information */}
                <div>
                  <h3 className="flex items-center gap-2 font-semibold mb-3">
                    <User className="w-4 h-4" />
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-medium">{selectedCustomer.fullName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{selectedCustomer.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Referral Source:</span>
                      <p className="font-medium">{selectedCustomer.referralSource || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Verification Status:</span>
                      <div className="mt-1">
                        {selectedCustomer.isVerified ? (
                          <Badge className="bg-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="w-3 h-3 mr-1" />
                            Pending Verification
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Registered By:</span>
                      <p className="font-medium">
                        {selectedCustomer.registeredBy && selectedCustomer.registeredByRole 
                          ? `${selectedCustomer.registeredBy} (${selectedCustomer.registeredByRole})`
                          : selectedCustomer.fullName}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Enrollment Date:</span>
                      <p className="font-medium">
                        {new Date(selectedCustomer.createdAt).toLocaleDateString('en-IN', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div>
                  <h3 className="flex items-center gap-2 font-semibold mb-3">
                    <MapPin className="w-4 h-4" />
                    Address Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Address:</span>
                      <p className="font-medium">{selectedCustomer.address}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">City/Village:</span>
                      <p className="font-medium">{selectedCustomer.city}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Taluka:</span>
                      <p className="font-medium">{selectedCustomer.taluka}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">District:</span>
                      <p className="font-medium">{selectedCustomer.district}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">State:</span>
                      <p className="font-medium">{selectedCustomer.state}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pin Code:</span>
                      <p className="font-medium">{selectedCustomer.pinCode}</p>
                    </div>
                  </div>
                </div>

                {/* Vehicle Information */}
                <div>
                  <h3 className="flex items-center gap-2 font-semibold mb-3">
                    <Car className="w-4 h-4" />
                    Registered Vehicles ({customerVehicles.length})
                  </h3>
                  {customerVehicles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No vehicles registered yet</p>
                  ) : (
                    <div className="space-y-3">
                      {customerVehicles.map((vehicle) => (
                        <div key={vehicle.id} className="p-3 border rounded-lg">
                          <div className="flex gap-4">
                            {vehicle.vehiclePhoto && (
                              <div className="flex-shrink-0">
                                <img 
                                  src={vehicle.vehiclePhoto} 
                                  alt={`${vehicle.vehicleBrand} ${vehicle.vehicleModel}`} 
                                  className="w-24 h-24 object-contain rounded-md border-2 border-orange-300 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/30 dark:to-yellow-950/30 p-1"
                                  data-testid={`img-vehicle-${vehicle.id}`}
                                />
                              </div>
                            )}
                            <div className="flex-1 space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Vehicle ID:</span>
                                  <p className="font-medium text-orange-600 dark:text-orange-400" data-testid={`text-vehicle-id-${vehicle.id}`}>{vehicle.vehicleId || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Vehicle Type:</span>
                                  <div className="mt-1">
                                    <Badge variant={vehicle.isNewVehicle ? "default" : "secondary"}>
                                      {vehicle.isNewVehicle ? "New Vehicle" : "Used Vehicle"}
                                    </Badge>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Registration Number:</span>
                                  <p className="font-medium">{vehicle.vehicleNumber || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Brand:</span>
                                  <p className="font-medium">{vehicle.vehicleBrand}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Model:</span>
                                  <p className="font-medium">{vehicle.vehicleModel}{vehicle.customModel ? ` (${vehicle.customModel})` : ''}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Variant:</span>
                                  <p className="font-medium" data-testid={`text-variant-${vehicle.id}`}>{vehicle.variant || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Color:</span>
                                  <p className="font-medium" data-testid={`text-color-${vehicle.id}`}>{vehicle.color || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Year of Purchase:</span>
                                  <p className="font-medium">{vehicle.yearOfPurchase || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Chassis Number:</span>
                                  <p className="font-medium">{vehicle.chassisNumber || 'N/A'}</p>
                                </div>
                              </div>
                              {vehicle.selectedParts && vehicle.selectedParts.length > 0 && (
                                <div>
                                  <span className="text-muted-foreground text-sm font-medium">Selected Parts & Warranty Status:</span>
                                  {loadingProducts ? (
                                    <div className="space-y-2 mt-2">
                                      <div className="text-xs text-muted-foreground">Loading product details...</div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2 mt-2">
                                      {vehicle.selectedParts.map((part, index) => {
                                        const warrantyCard = vehicle.warrantyCards?.find(wc => wc.partId === part.partId);
                                        const productInfo = productMap.get(part.partId);
                                        const partName = warrantyCard?.partName || productInfo?.name || part.partId;
                                        const hasWarranty = !!warrantyCard;
                                        
                                        return (
                                        <div 
                                          key={index}
                                          className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
                                          data-testid={`part-item-${vehicle.id}-${index}`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{partName}</span>
                                            <Badge variant="outline" className="text-xs">
                                              Qty: {part.quantity}
                                            </Badge>
                                            <Badge 
                                              variant={hasWarranty ? "default" : "secondary"}
                                              className={hasWarranty ? "bg-green-600 dark:bg-green-700" : ""}
                                            >
                                              {hasWarranty ? "Warranty card uploaded" : "Not uploaded"}
                                            </Badge>
                                          </div>
                                          {hasWarranty && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => {
                                                // Convert data URL to blob URL for safe viewing
                                                const byteString = atob(warrantyCard.fileData.split(',')[1]);
                                                const mimeString = warrantyCard.fileData.split(',')[0].split(':')[1].split(';')[0];
                                                const ab = new ArrayBuffer(byteString.length);
                                                const ia = new Uint8Array(ab);
                                                for (let i = 0; i < byteString.length; i++) {
                                                  ia[i] = byteString.charCodeAt(i);
                                                }
                                                const blob = new Blob([ab], { type: mimeString });
                                                const blobUrl = URL.createObjectURL(blob);
                                                window.open(blobUrl, '_blank');
                                                // Clean up the blob URL after a delay
                                                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                                              }}
                                              data-testid={`button-view-warranty-${vehicle.id}-${index}`}
                                              className="text-xs"
                                            >
                                              View
                                            </Button>
                                          )}
                                        </div>
                                      );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {vehicle.warrantyCard && (
                            <div className="mt-3 pt-3 border-t">
                              <span className="text-muted-foreground text-sm">Warranty Card:</span>
                              <div className="mt-2">
                                <img 
                                  src={vehicle.warrantyCard} 
                                  alt="Warranty Card" 
                                  className="max-w-xs w-full h-auto rounded-md border-2 border-green-300 dark:border-green-700 cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => {
                                    if (vehicle.warrantyCard) {
                                      // Convert data URL to blob URL for safe viewing
                                      const byteString = atob(vehicle.warrantyCard.split(',')[1]);
                                      const mimeString = vehicle.warrantyCard.split(',')[0].split(':')[1].split(';')[0];
                                      const ab = new ArrayBuffer(byteString.length);
                                      const ia = new Uint8Array(ab);
                                      for (let i = 0; i < byteString.length; i++) {
                                        ia[i] = byteString.charCodeAt(i);
                                      }
                                      const blob = new Blob([ab], { type: mimeString });
                                      const blobUrl = URL.createObjectURL(blob);
                                      window.open(blobUrl, '_blank');
                                      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                                    }
                                  }}
                                  data-testid={`img-warranty-card-${vehicle.id}`}
                                />
                                <p className="text-xs text-muted-foreground mt-1">Click to view full size</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer information
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editMutation.mutate(data))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-fullName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={editForm.control}
                  name="alternativeNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alternative Number (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="10-digit mobile number (Optional)" data-testid="input-edit-alternativeNumber" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-edit-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="referralSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How did you hear about us?</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-referral-source">
                          <SelectValue placeholder="Select referral source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REFERRAL_SOURCES.map((source) => (
                          <SelectItem key={source} value={source}>
                            {source}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City/Village</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="taluka"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taluka</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-taluka" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-district" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-state" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="pinCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pin Code</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-pinCode" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editingVehicle && (
                <>
                  <div className="border-t pt-4">
                    <h3 className="flex items-center gap-2 font-semibold mb-4">
                      <Car className="w-4 h-4" />
                      Vehicle Information
                    </h3>
                  </div>

                  <FormField
                    control={editForm.control}
                    name="vehicleNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="MH12AB1234" className="uppercase" data-testid="input-edit-vehicleNumber" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="vehicleBrand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Brand</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-vehicleBrand">
                                <SelectValue placeholder="Select brand" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {VEHICLE_BRANDS.map((brand) => (
                                <SelectItem key={brand} value={brand}>
                                  {brand}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="vehicleModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Model</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-edit-vehicleModel" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={editForm.control}
                    name="yearOfPurchase"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year of Purchase</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="2024" data-testid="input-edit-yearOfPurchase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="vehiclePhoto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Photo</FormLabel>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <FormControl>
                              <Input {...field} placeholder="https://... or upload below" data-testid="input-edit-vehiclePhoto" />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById('vehicle-photo-upload-edit')?.click()}
                              data-testid="button-upload-vehicle-photo"
                            >
                              Upload
                            </Button>
                          </div>
                          <input
                            id="vehicle-photo-upload-edit"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  field.onChange(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          {field.value && (
                            <div className="relative w-full h-32 border-2 border-orange-300 dark:border-orange-700 rounded-md overflow-hidden bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/30 dark:to-yellow-950/30">
                              <img
                                src={field.value}
                                alt="Vehicle preview"
                                className="w-full h-full object-contain p-2"
                              />
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="warrantyCard"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Card (Optional)</FormLabel>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <FormControl>
                              <Input {...field} placeholder="https://... or upload below" data-testid="input-edit-warrantyCard" />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById('warranty-card-upload-edit')?.click()}
                              data-testid="button-upload-warranty-card"
                            >
                              Upload
                            </Button>
                          </div>
                          <input
                            id="warranty-card-upload-edit"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  field.onChange(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          {field.value && (
                            <div className="relative w-full h-32 border-2 border-green-300 dark:border-green-700 rounded-md overflow-hidden bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                              <img
                                src={field.value}
                                alt="Warranty card preview"
                                className="w-full h-full object-contain p-2"
                              />
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={editForm.control}
                name="isVerified"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Verification Status</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Mark this customer as verified
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-isVerified"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingCustomer(null);
                    editForm.reset();
                  }}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {editMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
