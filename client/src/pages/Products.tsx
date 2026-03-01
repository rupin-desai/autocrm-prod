import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Package, X, ImagePlus, Barcode, Trash2, ImageIcon, Download, Upload, Copy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import { VEHICLE_DATA } from "@shared/vehicleData";

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("brand-asc");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [stockFormData, setStockFormData] = useState({
    quantity: "",
    type: "IN",
    reason: "",
  });
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    productName: "",
    productId: "",
    hsnNumber: "",
    barcode: "",
    barcodeImage: "",
    mrp: "",
    sellingPrice: "",
    discount: "",
    stockQty: "",
    minStockLevel: "",
    warranty: "",
    warrantyCustom: "",
    images: [] as string[],
    category: "",
    categoryCustom: "",
    modelCompatibility: [""],
    variants: [{ size: "", color: "", colorCustom: "" }],
  });

  const { data: products = [], isLoading, error, refetch } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/products', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Product created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create product",
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/products/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsEditDialogOpen(false);
      setSelectedProduct(null);
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/inventory-transactions', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory-transactions'] });
      setIsStockDialogOpen(false);
      setSelectedProduct(null);
      setStockFormData({ quantity: "", type: "IN", reason: "" });
      toast({
        title: "Success",
        description: "Stock updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stock",
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/products/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  const deleteDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/products/delete-duplicates', {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Success",
        description: `Deleted ${data.deletedCount} duplicate products from ${data.duplicateGroups} groups`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete duplicates",
        variant: "destructive",
      });
    },
  });

  const importProductsMutation = useMutation({
    mutationFn: async (productsData: any[]) => {
      const response = await apiRequest('POST', '/api/products/import', { products: productsData });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Success",
        description: `Imported ${data.imported} products. ${data.errors > 0 ? `${data.errors} errors occurred.` : ''}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to import products",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      brand: "",
      model: "",
      productName: "",
      productId: "",
      hsnNumber: "",
      barcode: "",
      barcodeImage: "",
      mrp: "",
      sellingPrice: "",
      discount: "",
      stockQty: "",
      minStockLevel: "",
      warranty: "",
      warrantyCustom: "",
      images: [],
      category: "",
      categoryCustom: "",
      modelCompatibility: [""],
      variants: [{ size: "", color: "", colorCustom: "" }],
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 5MB limit`,
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData(prev => ({ ...prev, images: [...prev.images, base64String] }));
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };

  const handleBarcodeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `${file.name} exceeds 5MB limit`,
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFormData(prev => ({ ...prev, barcodeImage: base64String }));
    };
    reader.readAsDataURL(file);
    
    e.target.value = '';
  };

  const removeBarcodeImage = () => {
    setFormData({ ...formData, barcodeImage: "" });
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages });
  };

  const addModelCompat = () => {
    setFormData({ ...formData, modelCompatibility: [...formData.modelCompatibility, ""] });
  };

  const removeModelCompat = (index: number) => {
    const newModels = formData.modelCompatibility.filter((_, i) => i !== index);
    setFormData({ ...formData, modelCompatibility: newModels.length > 0 ? newModels : [""] });
  };

  const updateModelCompat = (index: number, value: string) => {
    const newModels = [...formData.modelCompatibility];
    newModels[index] = value;
    setFormData({ ...formData, modelCompatibility: newModels });
  };

  const addVariant = () => {
    setFormData({ ...formData, variants: [...formData.variants, { size: "", color: "", colorCustom: "" }] });
  };

  const removeVariant = (index: number) => {
    const newVariants = formData.variants.filter((_, i) => i !== index);
    setFormData({ ...formData, variants: newVariants.length > 0 ? newVariants : [{ size: "", color: "", colorCustom: "" }] });
  };

  const updateVariant = (index: number, field: 'size' | 'color' | 'colorCustom', value: string) => {
    const newVariants = [...formData.variants];
    newVariants[index][field] = value;
    setFormData({ ...formData, variants: newVariants });
  };

  const handleExportProducts = () => {
    const exportData = products.map(product => ({
      brand: product.brand,
      model: product.model || "",
      productId: product.productId || "",
      productName: product.productName || "",
      category: product.category || "",
      hsnNumber: product.hsnNumber || "",
      barcode: product.barcode || "",
      mrp: product.mrp,
      sellingPrice: product.sellingPrice,
      discount: product.discount,
      stockQty: product.stockQty,
      minStockLevel: product.minStockLevel,
      warranty: product.warranty || "",
      status: product.status,
      modelCompatibility: Array.isArray(product.modelCompatibility) ? product.modelCompatibility.join(", ") : "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    
    const fileName = `products_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Success",
      description: `Exported ${products.length} products to ${fileName}`,
    });
  };

  const handleImportProducts = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const productsData = jsonData.map((row: any) => ({
          brand: row.brand || row.Brand,
          model: row.model || row.Model || "",
          productId: row.productId || row.ProductId || row.product_id || "",
          productName: row.productName || row.ProductName || row.product_name || "",
          category: row.category || row.Category || "",
          hsnNumber: row.hsnNumber || row.HSNNumber || row.hsn_number || "",
          barcode: row.barcode || row.Barcode || "",
          mrp: row.mrp || row.MRP || 0,
          sellingPrice: row.sellingPrice || row.SellingPrice || row.selling_price || 0,
          discount: row.discount || row.Discount || 0,
          stockQty: row.stockQty || row.StockQty || row.stock_qty || 0,
          minStockLevel: row.minStockLevel || row.MinStockLevel || row.min_stock_level || 10,
          warranty: row.warranty || row.Warranty || "",
          modelCompatibility: row.modelCompatibility 
            ? (typeof row.modelCompatibility === 'string' ? row.modelCompatibility.split(",").map((s: string) => s.trim()) : [])
            : [],
        }));

        importProductsMutation.mutate(productsData);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to parse Excel file. Please check the format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    
    const mrp = parseFloat(formData.mrp);
    const sellingPrice = parseFloat(formData.sellingPrice);
    const discount = parseFloat(formData.discount) || 0;
    const stockQty = parseInt(formData.stockQty);
    const minStockLevel = formData.minStockLevel ? parseInt(formData.minStockLevel) : 10;

    const finalWarranty = formData.warranty === 'Other' ? formData.warrantyCustom : formData.warranty;
    const finalCategory = formData.category === 'Other' ? formData.categoryCustom : formData.category;

    if (!formData.brand) {
      toast({
        title: "Validation Error",
        description: "Please enter the brand",
        variant: "destructive",
      });
      return;
    }

    if (!finalCategory) {
      toast({
        title: "Validation Error",
        description: "Please select or enter a category",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(mrp) || mrp <= 0 || isNaN(sellingPrice) || sellingPrice <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter valid prices greater than 0",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(stockQty) || stockQty < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter valid stock quantity",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.productName) {
      toast({
        title: "Validation Error",
        description: "Please enter the product name",
        variant: "destructive",
      });
      return;
    }

    const productData = {
      brand: formData.brand,
      model: formData.model,
      productName: formData.productName,
      productId: formData.productId || undefined,
      hsnNumber: formData.hsnNumber || undefined,
      barcode: formData.barcode,
      barcodeImage: formData.barcodeImage,
      category: finalCategory,
      mrp,
      sellingPrice,
      discount,
      stockQty,
      minStockLevel,
      warranty: finalWarranty,
      images: formData.images.filter(img => img.trim() !== ""),
      modelCompatibility: formData.modelCompatibility.filter(m => m.trim() !== ""),
      variants: formData.variants.map(v => ({
        size: v.size,
        color: v.color === 'Other' ? v.colorCustom : v.color
      })).filter(v => v.size || v.color),
    };
    
    createProductMutation.mutate(productData);
  };

  const handleEditProduct = (product: any) => {
    setSelectedProduct(product);
    const warrantyOptions = ['2YR', '1 Yr', '6 month', '1 month', 'NA'];
    const isStandardWarranty = warrantyOptions.includes(product.warranty || '');
    
    setFormData({
      brand: product.brand || "",
      model: product.model || "",
      productName: product.productName || "",
      productId: product.productId || "",
      hsnNumber: product.hsnNumber || "",
      barcode: product.barcode || "",
      barcodeImage: product.barcodeImage || "",
      mrp: product.mrp?.toString() || "",
      sellingPrice: product.sellingPrice?.toString() || "",
      discount: product.discount?.toString() || "0",
      stockQty: product.stockQty?.toString() || "",
      minStockLevel: product.minStockLevel?.toString() || "",
      warranty: isStandardWarranty ? product.warranty : 'Other',
      warrantyCustom: isStandardWarranty ? '' : (product.warranty || ''),
      category: product.category || "",
      categoryCustom: "",
      images: (product.images && product.images.length > 0) ? product.images : [],
      modelCompatibility: (product.modelCompatibility && product.modelCompatibility.length > 0) ? product.modelCompatibility : [""],
      variants: (product.variants && product.variants.length > 0) ? product.variants.map((v: any) => {
        const colorOptions = ['Red', 'Blue', 'Black', 'White', 'Silver', 'Gray', 'Green', 'Yellow'];
        const isStandardColor = colorOptions.includes(v.color || '');
        return {
          size: v.size || "",
          color: isStandardColor ? v.color : 'Other',
          colorCustom: isStandardColor ? '' : (v.color || '')
        };
      }) : [{ size: "", color: "", colorCustom: "" }],
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    
    const mrp = parseFloat(formData.mrp);
    const sellingPrice = parseFloat(formData.sellingPrice);
    const discount = parseFloat(formData.discount) || 0;
    const stockQty = parseInt(formData.stockQty);
    const minStockLevel = formData.minStockLevel ? parseInt(formData.minStockLevel) : 10;
    
    if (!formData.brand) {
      toast({
        title: "Validation Error",
        description: "Please enter the brand",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(mrp) || mrp <= 0 || isNaN(sellingPrice) || sellingPrice <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter valid prices greater than 0",
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(stockQty) || stockQty < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter valid stock quantity",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.productName) {
      toast({
        title: "Validation Error",
        description: "Please enter the product name",
        variant: "destructive",
      });
      return;
    }

    if (selectedProduct) {
      const finalWarranty = formData.warranty === 'Other' ? formData.warrantyCustom : formData.warranty;
      const finalCategory = formData.category === 'Other' ? formData.categoryCustom : formData.category;
      
      const productData = {
        brand: formData.brand,
        model: formData.model,
        productName: formData.productName,
        productId: formData.productId || undefined,
        hsnNumber: formData.hsnNumber || undefined,
        barcode: formData.barcode,
        barcodeImage: formData.barcodeImage,
        category: finalCategory,
        mrp,
        sellingPrice,
        discount,
        stockQty,
        minStockLevel,
        warranty: finalWarranty,
        images: formData.images.filter(img => img.trim() !== ""),
        modelCompatibility: formData.modelCompatibility.filter(m => m.trim() !== ""),
        variants: formData.variants.map(v => ({
          size: v.size,
          color: v.color === 'Other' ? v.colorCustom : v.color
        })).filter(v => v.size || v.color),
      };
      
      updateProductMutation.mutate({
        id: selectedProduct._id,
        data: productData,
      });
    }
  };

  const handleManageStock = (product: any) => {
    setSelectedProduct(product);
    setStockFormData({ quantity: "", type: "IN", reason: "" });
    setIsStockDialogOpen(true);
  };

  const handleUpdateStock = (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantity = parseInt(stockFormData.quantity);
    
    if (isNaN(quantity) || quantity <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid quantity greater than 0",
        variant: "destructive",
      });
      return;
    }
    
    if (!stockFormData.reason) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for the stock change",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedProduct) {
      updateStockMutation.mutate({
        productId: selectedProduct._id,
        type: stockFormData.type,
        quantity,
        reason: stockFormData.reason,
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateDiscountPercentage = (mrp: number, sellingPrice: number) => {
    if (mrp > sellingPrice) {
      return Math.round(((mrp - sellingPrice) / mrp) * 100);
    }
    return 0;
  };

  const filteredProducts = products.filter((product: any) => {
    const matchesSearch = product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.model && product.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.barcode && product.barcode.includes(searchTerm));
    return matchesSearch;
  }).sort((a: any, b: any) => {
    switch (sortBy) {
      case "brand-asc":
        return a.brand.localeCompare(b.brand);
      case "brand-desc":
        return b.brand.localeCompare(a.brand);
      case "stock-high":
        return (b.stockQty || 0) - (a.stockQty || 0);
      case "stock-low":
        return (a.stockQty || 0) - (b.stockQty || 0);
      case "price-high":
        return (b.sellingPrice || 0) - (a.sellingPrice || 0);
      case "price-low":
        return (a.sellingPrice || 0) - (b.sellingPrice || 0);
      case "category-asc":
        return (a.category || "").localeCompare(b.category || "");
      default:
        return 0;
    }
  });

  const getStatusBadge = (status: string, stock: number) => {
    switch (status) {
      case "in_stock":
        return <Badge variant="default" data-testid={`status-in-stock`}>In Stock ({stock})</Badge>;
      case "low_stock":
        return <Badge variant="secondary" data-testid={`status-low-stock`}>Low Stock ({stock})</Badge>;
      case "out_of_stock":
        return <Badge variant="destructive" data-testid={`status-out-of-stock`}>Out of Stock</Badge>;
      default:
        return <Badge variant="outline" data-testid={`status-${status}`}>{status}</Badge>;
    }
  };

  const renderProductForm = (isEdit: boolean) => (
    <form onSubmit={isEdit ? handleUpdateProduct : handleCreateProduct} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="brand">Brand *</Label>
          <Input
            id="brand"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            required
            data-testid="input-product-brand"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger data-testid="select-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map((cat: any) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
              <SelectItem value="Other">Add New Category</SelectItem>
            </SelectContent>
          </Select>
          {formData.category === 'Other' && (
            <Input
              value={formData.categoryCustom}
              onChange={(e) => setFormData({ ...formData, categoryCustom: e.target.value })}
              placeholder="Enter new category"
              required
              data-testid="input-category-custom"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            data-testid="input-product-model"
            placeholder="e.g., XL 100, Activa 6G"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="productId">Product ID (Optional)</Label>
          <Input
            id="productId"
            value={formData.productId}
            onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
            data-testid="input-product-id"
            placeholder="e.g., SKU-12345"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="productName">Product Name *</Label>
        <Input
          id="productName"
          value={formData.productName}
          onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
          required
          data-testid="input-product-name"
          placeholder="Enter product name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hsnNumber">Product HSN Number</Label>
        <Input
          id="hsnNumber"
          value={formData.hsnNumber}
          onChange={(e) => setFormData({ ...formData, hsnNumber: e.target.value })}
          data-testid="input-product-hsn"
          placeholder="e.g., 8512.90.20"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="barcode">Barcode/QR Code (Optional)</Label>
        <div className="relative">
          <Barcode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="barcode"
            value={formData.barcode}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            className="pl-10"
            data-testid="input-product-barcode"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Barcode Image (Optional)</Label>
        <div className="flex gap-2">
          <Input
            type="file"
            accept="image/*"
            onChange={handleBarcodeImageUpload}
            data-testid="input-barcode-image"
          />
        </div>
        {formData.barcodeImage && (
          <div className="relative inline-block mt-2">
            <img 
              src={formData.barcodeImage} 
              alt="Barcode" 
              className="w-32 h-32 object-contain rounded-md border"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={removeBarcodeImage}
              data-testid="button-remove-barcode-image"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="mrp">MRP *</Label>
          <Input
            id="mrp"
            type="number"
            step="0.01"
            value={formData.mrp}
            onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
            required
            data-testid="input-product-mrp"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sellingPrice">Selling Price *</Label>
          <Input
            id="sellingPrice"
            type="number"
            step="0.01"
            value={formData.sellingPrice}
            onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
            required
            data-testid="input-product-sellingprice"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discount">Discount % (Auto-calculated)</Label>
          <Input
            id="discount"
            type="text"
            value={formData.mrp && formData.sellingPrice ? 
              `${calculateDiscountPercentage(parseFloat(formData.mrp), parseFloat(formData.sellingPrice))}%` : 
              '0%'
            }
            readOnly
            className="bg-muted"
            data-testid="input-product-discount"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="stockQty">Stock Quantity *</Label>
          <Input
            id="stockQty"
            type="number"
            value={formData.stockQty}
            onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })}
            required
            data-testid="input-product-stockqty"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minStockLevel">Min Stock Level (Optional)</Label>
          <Input
            id="minStockLevel"
            type="number"
            value={formData.minStockLevel}
            onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
            placeholder="Default: 10"
            data-testid="input-product-minstocklevel"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="warranty">Warranty</Label>
        <Select
          value={formData.warranty}
          onValueChange={(value) => setFormData({ ...formData, warranty: value })}
        >
          <SelectTrigger data-testid="select-warranty">
            <SelectValue placeholder="Select warranty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2YR">2YR</SelectItem>
            <SelectItem value="1 Yr">1 Yr</SelectItem>
            <SelectItem value="6 month">6 month</SelectItem>
            <SelectItem value="1 month">1 month</SelectItem>
            <SelectItem value="NA">NA</SelectItem>
            <SelectItem value="Other">Other (Custom)</SelectItem>
          </SelectContent>
        </Select>
        {formData.warranty === 'Other' && (
          <Input
            value={formData.warrantyCustom}
            onChange={(e) => setFormData({ ...formData, warrantyCustom: e.target.value })}
            placeholder="Enter custom warranty"
            data-testid="input-warranty-custom"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Product Images</Label>
        <div className="flex gap-2">
          <Input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            data-testid="input-product-images"
          />
        </div>
        {formData.images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            {formData.images.map((image, index) => (
              <div key={index} className="relative">
                <img 
                  src={image} 
                  alt={`Product ${index + 1}`} 
                  className="w-full h-24 object-cover rounded-md"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => removeImage(index)}
                  data-testid={`button-remove-image-${index}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Product Variants</Label>
        {formData.variants.map((variant, index) => (
          <div key={index} className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={variant.size}
                onChange={(e) => updateVariant(index, 'size', e.target.value)}
                placeholder="Size"
                data-testid={`input-variant-size-${index}`}
              />
              <Select
                value={variant.color}
                onValueChange={(value) => updateVariant(index, 'color', value)}
              >
                <SelectTrigger data-testid={`select-variant-color-${index}`}>
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Red">Red</SelectItem>
                  <SelectItem value="Blue">Blue</SelectItem>
                  <SelectItem value="Black">Black</SelectItem>
                  <SelectItem value="White">White</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Gray">Gray</SelectItem>
                  <SelectItem value="Green">Green</SelectItem>
                  <SelectItem value="Yellow">Yellow</SelectItem>
                  <SelectItem value="Other">Other (Custom)</SelectItem>
                </SelectContent>
              </Select>
              {formData.variants.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeVariant(index)}
                  data-testid={`button-remove-variant-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {variant.color === 'Other' && (
              <Input
                value={variant.colorCustom}
                onChange={(e) => updateVariant(index, 'colorCustom', e.target.value)}
                placeholder="Enter custom color"
                data-testid={`input-variant-color-custom-${index}`}
              />
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addVariant}
          data-testid="button-add-variant"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Variant
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Model Compatibility</Label>
        <p className="text-xs text-muted-foreground">
          Select vehicle brands and models this product is compatible with
        </p>
        {formData.modelCompatibility.map((model, index) => (
          <div key={index} className="space-y-2">
            <div className="flex gap-2">
              <Select
                value={
                  model.startsWith('Other:') || model === '' 
                    ? '' 
                    : model.includes(' - ') 
                      ? model.split(' - ')[0] 
                      : model
                }
                onValueChange={(brand) => {
                  updateModelCompat(index, brand);
                }}
              >
                <SelectTrigger className="w-[200px]" data-testid={`select-brand-${index}`}>
                  <SelectValue placeholder="Other (Custom)" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_DATA.map((brand) => (
                    <SelectItem key={brand.name} value={brand.name}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {model && !model.startsWith('Other:') && model !== '' && VEHICLE_DATA.find(b => b.name === (model.includes(' - ') ? model.split(' - ')[0] : model)) && (
                <Select
                  value={model.includes(' - ') ? model.split(' - ')[1] : ''}
                  onValueChange={(modelName) => {
                    const brand = model.includes(' - ') ? model.split(' - ')[0] : model;
                    updateModelCompat(index, `${brand} - ${modelName}`);
                  }}
                >
                  <SelectTrigger className="flex-1" data-testid={`select-model-${index}`}>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_DATA.find(b => b.name === (model.includes(' - ') ? model.split(' - ')[0] : model))?.models.filter(m => m.name !== 'Other').map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        {m.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {(model.startsWith('Other:') || model === '') && (
                <Input
                  value={model.replace('Other: ', '')}
                  onChange={(e) => updateModelCompat(index, `Other: ${e.target.value}`)}
                  placeholder="Enter custom compatibility"
                  className="flex-1"
                  data-testid={`input-custom-model-${index}`}
                />
              )}
              
              {formData.modelCompatibility.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeModelCompat(index)}
                  data-testid={`button-remove-model-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {model && !model.startsWith('Other:') && model.includes(' - ') && (
              <p className="text-xs text-green-600">
                ✓ Selected: {model}
              </p>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addModelCompat}
          data-testid="button-add-model"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Vehicle
        </Button>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            isEdit ? setIsEditDialogOpen(false) : setIsCreateDialogOpen(false);
            if (!isEdit) resetForm();
          }}
          data-testid="button-cancel-product"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isEdit ? updateProductMutation.isPending : createProductMutation.isPending}
          data-testid="button-submit-product"
        >
          {isEdit 
            ? (updateProductMutation.isPending ? 'Updating...' : 'Update Product')
            : (createProductMutation.isPending ? 'Creating...' : 'Create Product')
          }
        </Button>
      </div>
    </form>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Products & Inventory</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load products</h3>
              <p className="text-muted-foreground mb-4">
                {(error as Error)?.message || 'An error occurred while fetching products'}
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Products & Inventory</h1>
        <div className="flex gap-2 flex-wrap">
          <input
            type="file"
            id="import-products"
            accept=".xlsx,.xls"
            onChange={handleImportProducts}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={handleExportProducts}
            disabled={products.length === 0}
            data-testid="button-export"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={() => document.getElementById('import-products')?.click()}
            data-testid="button-import"
            size="sm"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button
            variant="outline"
            onClick={() => deleteDuplicatesMutation.mutate()}
            disabled={deleteDuplicatesMutation.isPending}
            data-testid="button-delete-duplicates"
            size="sm"
          >
            <Copy className="h-4 w-4 mr-2" />
            Delete Duplicates
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-product" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>
                  Add a new product with specifications, images, and variants
                </DialogDescription>
              </DialogHeader>
              {renderProductForm(false)}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by brand, model, or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="sort-select" className="text-sm text-muted-foreground mb-2 block">Sort By</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger id="sort-select" className="w-full" data-testid="select-sort">
                <SelectValue placeholder="Select sort option..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brand-asc">Brand (A-Z)</SelectItem>
                <SelectItem value="brand-desc">Brand (Z-A)</SelectItem>
                <SelectItem value="stock-high">Stock Level (High to Low)</SelectItem>
                <SelectItem value="stock-low">Stock Level (Low to High)</SelectItem>
                <SelectItem value="price-high">Price (High to Low)</SelectItem>
                <SelectItem value="price-low">Price (Low to High)</SelectItem>
                <SelectItem value="category-asc">Category (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredProducts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product: any) => {
            const discountPercent = calculateDiscountPercentage(product.mrp, product.sellingPrice);
            return (
              <Card key={product._id} className="hover-elevate" data-testid={`card-product-${product._id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{product.brand}</CardTitle>
                      {product.model && (
                        <p className="text-sm text-muted-foreground mt-1">{product.model}</p>
                      )}
                      {product.barcode && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Barcode className="h-3 w-3" />
                          {product.barcode}
                        </p>
                      )}
                      {product.productId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: {product.productId}
                        </p>
                      )}
                    </div>
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {product.images && product.images.length > 0 && product.images[0] ? (
                    <div className="relative w-full h-40 bg-muted rounded-md overflow-hidden">
                      <img 
                        src={product.images[0]} 
                        alt={`${product.brand} ${product.model || 'Product'}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden absolute inset-0 flex items-center justify-center bg-muted">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-muted rounded-md flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" data-testid={`category-${product._id}`}>{product.category}</Badge>
                    {getStatusBadge(product.status, product.stockQty)}
                    {discountPercent > 0 && (
                      <Badge variant="default" className="bg-green-600">
                        {discountPercent}% OFF
                      </Badge>
                    )}
                  </div>

                  {product.warranty && (
                    <p className="text-xs text-muted-foreground">
                      Warranty: {product.warranty}
                    </p>
                  )}

                  {product.modelCompatibility && product.modelCompatibility.length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Compatible: </span>
                      <span>{product.modelCompatibility.slice(0, 2).join(', ')}</span>
                      {product.modelCompatibility.length > 2 && <span> +{product.modelCompatibility.length - 2} more</span>}
                    </div>
                  )}

                  {product.variants && product.variants.length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Variants: </span>
                      {product.variants.map((v: any, i: number) => (
                        <Badge key={i} variant="outline" className="mr-1">
                          {v.size && v.color ? `${v.size}/${v.color}` : v.size || v.color}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">MRP</p>
                      <p className="text-sm line-through text-muted-foreground">{formatCurrency(product.mrp)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Selling Price</p>
                      <p className="text-lg font-bold">{formatCurrency(product.sellingPrice)}</p>
                    </div>
                  </div>

                  {product.warehouseLocation && (
                    <p className="text-xs text-muted-foreground">
                      Location: {product.warehouseLocation}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1" 
                      onClick={() => handleEditProduct(product)}
                      data-testid={`button-edit-${product._id}`}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1" 
                      onClick={() => handleManageStock(product)}
                      data-testid={`button-stock-${product._id}`}
                    >
                      Manage Stock
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setSelectedProduct(product);
                        setIsDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-${product._id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : products.length > 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No products match your search criteria</p>
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No products found. Add your first product to get started.</p>
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update product information, specifications, and variants
            </DialogDescription>
          </DialogHeader>
          {renderProductForm(true)}
        </DialogContent>
      </Dialog>

      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Stock</DialogTitle>
            <DialogDescription>
              Update inventory for {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateStock} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stock-type">Transaction Type</Label>
              <Select
                value={stockFormData.type}
                onValueChange={(value) => setStockFormData({ ...stockFormData, type: value })}
              >
                <SelectTrigger data-testid="select-stock-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">Stock In</SelectItem>
                  <SelectItem value="OUT">Stock Out</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-quantity">Quantity</Label>
              <Input
                id="stock-quantity"
                type="number"
                value={stockFormData.quantity}
                onChange={(e) => setStockFormData({ ...stockFormData, quantity: e.target.value })}
                required
                data-testid="input-stock-quantity"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-reason">Reason</Label>
              <Textarea
                id="stock-reason"
                value={stockFormData.reason}
                onChange={(e) => setStockFormData({ ...stockFormData, reason: e.target.value })}
                required
                data-testid="input-stock-reason"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStockDialogOpen(false)}
                data-testid="button-cancel-stock"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateStockMutation.isPending}
                data-testid="button-submit-stock"
              >
                {updateStockMutation.isPending ? 'Updating...' : 'Update Stock'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProduct?.name}"? This action cannot be undone and will permanently remove this product from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedProduct) {
                  deleteProductMutation.mutate(selectedProduct._id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
