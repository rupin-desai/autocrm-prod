import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Minus, Tag, Calculator, Receipt } from "lucide-react";

const invoiceItemSchema = z.object({
  type: z.enum(['product', 'service']),
  productId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  isLabourCharge: z.boolean().default(false),
  quantity: z.number().min(1, "Quantity must be at least 1").default(1),
  unitPrice: z.number().min(0, "Price must be positive"),
  total: z.number(),
  hasGst: z.boolean().default(false),
  gstPercentage: z.number().min(0).max(100).default(18),
  gstAmount: z.number().default(0),
  hasWarranty: z.boolean().default(false),
  warrantyCards: z.array(z.object({
    url: z.string(),
    filename: z.string(),
    uploadedAt: z.string(),
  })).optional().default([]),
});

const invoiceFormSchema = z.object({
  items: z.array(invoiceItemSchema).min(1, "Add at least one item"),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface InvoiceGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceVisit: any;
}

export function InvoiceGenerationDialog({ open, onOpenChange, serviceVisit }: InvoiceGenerationDialogProps) {
  const { toast } = useToast();
  const [couponValidation, setCouponValidation] = useState<any>(null);
  const [calculatedTotals, setCalculatedTotals] = useState({
    subtotal: 0,
    discount: 0,
    taxAmount: 0,
    total: 0,
  });
  const [initialItemsSet, setInitialItemsSet] = useState(false);
  const [productSearchQueries, setProductSearchQueries] = useState<Record<number, string>>({});

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      items: [{
        type: 'service' as const,
        name: 'Labour Charges',
        isLabourCharge: true,
        quantity: 1,
        unitPrice: 0,
        total: 0,
        hasGst: false,
        gstPercentage: 18,
        gstAmount: 0,
        hasWarranty: false,
        warrantyCards: [],
      }],
      couponCode: '',
      notes: '',
      terms: 'Payment due within 30 days',
    },
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['/api/products'],
  });

  const { data: suggestedProductsData, isLoading: loadingSuggestedProducts } = useQuery<{ products: any[] }>({
    queryKey: ['/api/service-visits', serviceVisit?._id, 'suggested-products'],
    enabled: open && !!serviceVisit?._id,
  });

  const items = form.watch('items');
  const couponCode = form.watch('couponCode');

  useEffect(() => {
    if (!open) {
      setInitialItemsSet(false);
      setCouponValidation(null);
      return;
    }

    if (initialItemsSet || loadingSuggestedProducts) {
      return;
    }

    console.log('\n========================================');
    console.log('📋 INVOICE DIALOG - Processing Products');
    console.log('========================================');
    console.log('Service Visit ID:', serviceVisit?._id);
    console.log('Service Visit Vehicle:', serviceVisit?.vehicleReg);
    console.log('Loading Suggested Products?', loadingSuggestedProducts);
    console.log('Suggested Products Data:', suggestedProductsData);
    console.log('Service Visit PartsUsed:', serviceVisit?.partsUsed);
    console.log('Service Visit PartsUsed Count:', serviceVisit?.partsUsed?.length || 0);

    // Build a map of productId -> fresh product data from suggested products
    const freshProductMap = new Map();
    console.log('\n🗺️ Building fresh product map from suggested products...');
    suggestedProductsData?.products?.forEach((product: any, index: number) => {
      console.log(`  Product ${index + 1}:`, {
        productId: product.productId,
        name: product.name,
        price: product.price,
        warranty: product.warranty,
      });
      freshProductMap.set(product.productId, {
        name: product.name,
        price: product.price || 0,
        warranty: product.warranty,
      });
    });
    console.log('Fresh product map size:', freshProductMap.size);

    // Create partsUsedItems with fresh prices from the map
    console.log('\n🔧 Processing PartsUsed items...');
    const partsUsedItems = serviceVisit?.partsUsed?.map((part: any, index: number) => {
      const productId = part.productId?._id || part.productId;
      const freshData = freshProductMap.get(productId?.toString());
      
      console.log(`  Part ${index + 1}:`, {
        rawPart: part,
        productId: productId,
        productIdString: productId?.toString(),
        freshData: freshData,
        hasInMap: freshProductMap.has(productId?.toString()),
      });
      
      const item = {
        type: 'product' as const,
        productId: productId,
        name: freshData?.name || part.productId?.name || 'Product',
        isLabourCharge: false,
        quantity: part.quantity || 1,
        unitPrice: freshData?.price || part.price || 0,
        total: (part.quantity || 1) * (freshData?.price || part.price || 0),
        hasGst: false,
        gstPercentage: 18,
        gstAmount: 0,
        hasWarranty: !!(freshData?.warranty || part.productId?.warranty),
        warrantyCards: [],
      };
      
      console.log(`    → Created item:`, item);
      return item;
    }) || [];
    
    console.log('Total PartsUsed items created:', partsUsedItems.length);

    // Create suggested items for products not already in partsUsed
    const usedProductIds = new Set(partsUsedItems.map((item: any) => item.productId?.toString()));
    console.log('\n💡 Processing Suggested Products (excluding partsUsed)...');
    console.log('Used Product IDs:', Array.from(usedProductIds));
    
    const uniqueSuggestedItems = suggestedProductsData?.products
      ?.filter((product: any) => {
        const isUsed = usedProductIds.has(product.productId);
        console.log(`  Product "${product.name}" (${product.productId}):`, isUsed ? 'SKIP (already in partsUsed)' : 'INCLUDE');
        return !isUsed;
      })
      .map((product: any) => ({
        type: 'product' as const,
        productId: product.productId,
        name: product.name,
        isLabourCharge: false,
        quantity: 1,
        unitPrice: product.price || 0,
        total: product.price || 0,
        hasGst: false,
        gstPercentage: 18,
        gstAmount: 0,
        hasWarranty: !!product.warranty,
        warrantyCards: [],
      })) || [];

    console.log('Total Unique Suggested items created:', uniqueSuggestedItems.length);
    console.log('Unique Suggested Items:', uniqueSuggestedItems);

    console.log('\n📊 SUMMARY:');
    console.log('  PartsUsed Items:', partsUsedItems.length);
    console.log('  Unique Suggested Items:', uniqueSuggestedItems.length);
    console.log('  Total Items:', partsUsedItems.length + uniqueSuggestedItems.length);

    const labourChargeItem = {
      type: 'service' as const,
      name: 'Labour Charges',
      isLabourCharge: true,
      quantity: 1,
      unitPrice: 0,
      total: 0,
      hasGst: false,
      gstPercentage: 18,
      gstAmount: 0,
      hasWarranty: false,
      warrantyCards: [],
    };

    const allItems = [labourChargeItem, ...partsUsedItems, ...uniqueSuggestedItems];

    if (allItems.length > 0) {
      console.log('\n✅ Setting', allItems.length, 'items in form (including Labour Charges)');
      console.log('All Items:', allItems);
      form.setValue('items', allItems);
      setInitialItemsSet(true);
    } else {
      console.log('\n⚠️ No items to set, marking as initialized');
      setInitialItemsSet(true);
    }
    console.log('========================================\n');
  }, [open, serviceVisit, suggestedProductsData, initialItemsSet, loadingSuggestedProducts, form]);

  useEffect(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const discount = couponValidation?.coupon?.discountAmount || 0;
    const total = subtotal - discount;

    setCalculatedTotals({
      subtotal,
      discount,
      taxAmount: 0,
      total,
    });
  }, [items, couponValidation]);

  const validateCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest('POST', '/api/coupons/validate', {
        code,
        customerId: serviceVisit.customerId._id,
        purchaseAmount: calculatedTotals.subtotal,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setCouponValidation(data);
      toast({ title: "Coupon applied successfully", description: `Discount: ₹${data.coupon.discountAmount}` });
    },
    onError: (error: any) => {
      setCouponValidation(null);
      toast({ title: "Invalid coupon", description: error.message, variant: "destructive" });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormValues) => {
      const response = await apiRequest('POST', '/api/invoices/from-service-visit', {
        serviceVisitId: serviceVisit._id,
        ...data,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-visits'] });
      toast({ title: "Invoice created successfully", description: "Invoice sent for approval" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create invoice", variant: "destructive" });
    },
  });

  const addItem = () => {
    const currentItems = form.getValues('items');
    form.setValue('items', [
      ...currentItems,
      {
        type: 'product' as const,
        name: '',
        isLabourCharge: false,
        quantity: 1,
        unitPrice: 0,
        total: 0,
        hasGst: false,
        gstPercentage: 18,
        gstAmount: 0,
        hasWarranty: false,
        warrantyCards: [],
      },
    ]);
  };

  const addLabourCharge = () => {
    const currentItems = form.getValues('items');
    form.setValue('items', [
      ...currentItems,
      {
        type: 'service' as const,
        name: 'Labour Charges',
        isLabourCharge: true,
        quantity: 1,
        unitPrice: 0,
        total: 0,
        hasGst: false,
        gstPercentage: 18,
        gstAmount: 0,
        hasWarranty: false,
        warrantyCards: [],
      },
    ]);
  };

  const removeItem = (index: number) => {
    const currentItems = form.getValues('items');
    form.setValue('items', currentItems.filter((_, i) => i !== index));
    setTimeout(() => recalculateTotals(), 0);
  };

  const recalculateTotals = () => {
    const currentItems = form.getValues('items');
    const subtotal = currentItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const discount = couponValidation?.coupon?.discountAmount || 0;
    const total = subtotal - discount;

    setCalculatedTotals({
      subtotal,
      discount,
      taxAmount: 0,
      total,
    });
  };

  const updateItemTotal = (index: number) => {
    const items = form.getValues('items');
    const item = items[index];
    
    const total = item.unitPrice * item.quantity;
    
    if (item.hasGst) {
      const gstPercentage = item.gstPercentage || 18;
      const gstAmount = total * (gstPercentage / (100 + gstPercentage));
      form.setValue(`items.${index}.gstAmount`, gstAmount, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      form.setValue(`items.${index}.total`, total, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    } else {
      form.setValue(`items.${index}.gstAmount`, 0, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      form.setValue(`items.${index}.total`, total, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    }
    
    recalculateTotals();
  };

  const toggleGst = (index: number) => {
    const items = form.getValues('items');
    const newHasGst = !items[index].hasGst;
    form.setValue(`items.${index}.hasGst`, newHasGst);
    updateItemTotal(index);
  };

  const updateGstPercentage = (index: number, percentage: number) => {
    form.setValue(`items.${index}.gstPercentage`, percentage);
    updateItemTotal(index);
  };

  const applyCoupon = () => {
    const code = form.getValues('couponCode');
    if (code) {
      validateCouponMutation.mutate(code);
    }
  };

  const getFilteredProducts = (itemIndex: number) => {
    const searchQuery = productSearchQueries[itemIndex] || '';
    return products
      .filter((p: any) => p.stockQty > 0)
      .filter((p: any) => {
        const productName = (p.productName || p.name || p.model || 'Unknown').toLowerCase();
        return productName.includes(searchQuery.toLowerCase());
      });
  };

  const onSubmit = (data: InvoiceFormValues) => {
    createInvoiceMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] lg:max-w-7xl max-h-[80vh] sm:max-h-[90vh] lg:max-h-[95vh] overflow-y-auto" data-testid="dialog-generate-invoice">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Generate Invoice
          </DialogTitle>
          <DialogDescription>
            Create invoice for service visit - {serviceVisit?.vehicleReg || 'N/A'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">Items & Services</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Item
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={addLabourCharge} data-testid="button-add-labour-charge">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Labour Charge
                      </Button>
                    </div>
                  </div>

                  <div className="hidden md:block border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Type</TableHead>
                          <TableHead className="min-w-[200px]">Name</TableHead>
                          <TableHead className="min-w-[80px]">Qty</TableHead>
                          <TableHead className="min-w-[120px]">Unit Price</TableHead>
                          <TableHead className="min-w-[100px]">GST %</TableHead>
                          <TableHead className="min-w-[80px]">GST Amount</TableHead>
                          <TableHead className="min-w-[100px]">Total</TableHead>
                          <TableHead className="min-w-[80px]">Warranty</TableHead>
                          <TableHead className="min-w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.type`}
                                render={({ field }) => (
                                  <FormItem>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                      <SelectTrigger className="w-[120px]" data-testid={`select-item-type-${index}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="product">Product</SelectItem>
                                        <SelectItem value="service">Service</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.name`}
                                render={({ field }) => (
                                  <FormItem>
                                    {item.type === 'product' ? (
                                      <Select
                                        value={form.watch(`items.${index}.productId`) || ''}
                                        onValueChange={(productId) => {
                                          const selectedProduct = products.find((p: any) => p._id === productId);
                                          if (selectedProduct) {
                                            const displayName = selectedProduct.productName || selectedProduct.name || selectedProduct.model || "Unknown";
                                            field.onChange(displayName);
                                            form.setValue(`items.${index}.productId`, selectedProduct._id);
                                            form.setValue(`items.${index}.unitPrice`, selectedProduct.sellingPrice);
                                            setProductSearchQueries({ ...productSearchQueries, [index]: '' });
                                            updateItemTotal(index);
                                          }
                                        }}
                                      >
                                        <SelectTrigger data-testid={`select-product-${index}`}>
                                          <SelectValue placeholder="Select product from inventory">
                                            {field.value || 'Select product from inventory'}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent onOpenAutoFocus={false} className="w-[300px]">
                                          <div className="p-2 border-b sticky top-0 bg-background z-50" onClick={(e) => e.stopPropagation()}>
                                            <Input
                                              autoFocus
                                              placeholder="Search products..."
                                              value={productSearchQueries[index] || ''}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                setProductSearchQueries({ ...productSearchQueries, [index]: e.target.value });
                                              }}
                                              onKeyDown={(e) => {
                                                e.stopPropagation();
                                                if (e.key === 'Escape') {
                                                  e.preventDefault();
                                                }
                                              }}
                                              data-testid={`input-product-search-${index}`}
                                              className="h-8"
                                            />
                                          </div>
                                          <div className="max-h-[300px] overflow-y-auto">
                                            {getFilteredProducts(index).map((product: any) => (
                                              <SelectItem key={product._id} value={product._id}>
                                                {product.productName || product.name || product.model || "Unknown"} - ₹{product.sellingPrice} ({product.stockQty} in stock)
                                              </SelectItem>
                                            ))}
                                            {getFilteredProducts(index).length === 0 && (
                                              <div className="p-2 text-sm text-muted-foreground text-center">
                                                No matching products in stock
                                              </div>
                                            )}
                                          </div>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input {...field} placeholder="Service name" data-testid={`input-item-name-${index}`} />
                                    )}
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              {!item.isLabourCharge ? (
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.quantity`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <Input
                                        type="number"
                                        {...field}
                                        onChange={(e) => {
                                          field.onChange(parseFloat(e.target.value) || 0);
                                          updateItemTotal(index);
                                        }}
                                        className="w-20"
                                        data-testid={`input-item-quantity-${index}`}
                                      />
                                    </FormItem>
                                  )}
                                />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.unitPrice`}
                                render={({ field }) => (
                                  <FormItem>
                                    <Input
                                      type={item.isLabourCharge ? "text" : "number"}
                                      {...field}
                                      onChange={(e) => {
                                        if (item.isLabourCharge) {
                                          const value = e.target.value.replace(/[^0-9.]/g, '');
                                          const numValue = parseFloat(value) || 0;
                                          if (numValue >= 0) {
                                            field.onChange(numValue);
                                            form.setValue(`items.${index}.total`, numValue);
                                            recalculateTotals();
                                          }
                                        } else {
                                          field.onChange(parseFloat(e.target.value) || 0);
                                          updateItemTotal(index);
                                        }
                                      }}
                                      className="w-24"
                                      data-testid={`input-item-price-${index}`}
                                    />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              {!item.isLabourCharge ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={item.hasGst}
                                    onChange={() => toggleGst(index)}
                                    className="h-4 w-4"
                                    data-testid={`checkbox-gst-${index}`}
                                  />
                                  {item.hasGst && (
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      pattern="[0-9]*\.?[0-9]*"
                                      value={item.gstPercentage === 0 ? '' : item.gstPercentage}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                          updateGstPercentage(index, val === '' ? 0 : parseFloat(val));
                                        }
                                      }}
                                      className="w-16 h-8"
                                      data-testid={`input-gst-percentage-${index}`}
                                    />
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.hasGst ? `₹${item.gstAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                            </TableCell>
                            <TableCell>₹{item.total.toLocaleString()}</TableCell>
                            <TableCell>
                              {!item.isLabourCharge ? (
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.hasWarranty`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <input
                                        type="checkbox"
                                        checked={field.value}
                                        onChange={field.onChange}
                                        className="h-4 w-4"
                                        data-testid={`checkbox-warranty-${index}`}
                                      />
                                    </FormItem>
                                  )}
                                />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {items.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeItem(index)}
                                  data-testid={`button-remove-item-${index}`}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {items.map((item, index) => (
                      <Card key={index} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm">Item {index + 1}</h4>
                          {items.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                              data-testid={`button-remove-item-${index}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        <FormField
                          control={form.control}
                          name={`items.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger data-testid={`select-item-type-${index}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="product">Product</SelectItem>
                                  <SelectItem value="service">Service</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name={`items.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              {item.type === 'product' ? (
                                <Select
                                  value={form.watch(`items.${index}.productId`) || ''}
                                  onValueChange={(productId) => {
                                    const selectedProduct = products.find((p: any) => p._id === productId);
                                    if (selectedProduct) {
                                      const displayName = selectedProduct.productName || selectedProduct.name || selectedProduct.model || "Unknown";
                                      field.onChange(displayName);
                                      form.setValue(`items.${index}.productId`, selectedProduct._id);
                                      form.setValue(`items.${index}.unitPrice`, selectedProduct.sellingPrice);
                                      setProductSearchQueries({ ...productSearchQueries, [index]: '' });
                                      updateItemTotal(index);
                                    }
                                  }}
                                >
                                  <SelectTrigger data-testid={`select-product-${index}`}>
                                    <SelectValue placeholder="Select product">
                                      {field.value || 'Select product'}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent onOpenAutoFocus={false} className="w-[300px]">
                                    <div className="p-2 border-b sticky top-0 bg-background z-50" onClick={(e) => e.stopPropagation()}>
                                      <Input
                                        autoFocus
                                        placeholder="Search products..."
                                        value={productSearchQueries[index] || ''}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          setProductSearchQueries({ ...productSearchQueries, [index]: e.target.value });
                                        }}
                                        onKeyDown={(e) => {
                                          e.stopPropagation();
                                          if (e.key === 'Escape') {
                                            e.preventDefault();
                                          }
                                        }}
                                        data-testid={`input-product-search-${index}`}
                                        className="h-8"
                                      />
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto">
                                      {getFilteredProducts(index).map((product: any) => (
                                        <SelectItem key={product._id} value={product._id}>
                                          {product.productName || product.name || product.model || "Unknown"} - ₹{product.sellingPrice}
                                        </SelectItem>
                                      ))}
                                      {getFilteredProducts(index).length === 0 && (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                          No matching products in stock
                                        </div>
                                      )}
                                    </div>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input {...field} placeholder="Service name" data-testid={`input-item-name-${index}`} />
                              )}
                            </FormItem>
                          )}
                        />
                        
                        <div className={item.isLabourCharge ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
                          {!item.isLabourCharge && (
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Qty</FormLabel>
                                  <Input
                                    type="number"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(parseFloat(e.target.value) || 0);
                                      updateItemTotal(index);
                                    }}
                                    data-testid={`input-item-quantity-${index}`}
                                  />
                                </FormItem>
                              )}
                            />
                          )}
                          <FormField
                            control={form.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{item.isLabourCharge ? "Charge Amount" : "Unit Price"}</FormLabel>
                                <Input
                                  type={item.isLabourCharge ? "text" : "number"}
                                  {...field}
                                  onChange={(e) => {
                                    if (item.isLabourCharge) {
                                      const value = e.target.value.replace(/[^0-9.]/g, '');
                                      const numValue = parseFloat(value) || 0;
                                      if (numValue >= 0) {
                                        field.onChange(numValue);
                                        form.setValue(`items.${index}.total`, numValue);
                                        recalculateTotals();
                                      }
                                    } else {
                                      field.onChange(parseFloat(e.target.value) || 0);
                                      updateItemTotal(index);
                                    }
                                  }}
                                  data-testid={`input-item-price-${index}`}
                                />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          {!item.isLabourCharge && (
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.hasGst`}
                                  render={({ field }) => (
                                    <FormItem className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={field.value}
                                        onChange={() => toggleGst(index)}
                                        className="h-4 w-4"
                                        data-testid={`checkbox-gst-${index}`}
                                      />
                                      <FormLabel className="!mt-0">GST</FormLabel>
                                    </FormItem>
                                  )}
                                />
                                {item.hasGst && (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      pattern="[0-9]*\.?[0-9]*"
                                      value={item.gstPercentage === 0 ? '' : item.gstPercentage}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                          updateGstPercentage(index, val === '' ? 0 : parseFloat(val));
                                        }
                                      }}
                                      className="w-16 h-8 text-sm"
                                      data-testid={`input-gst-percentage-mobile-${index}`}
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                  </div>
                                )}
                              </div>
                              {item.hasGst && (
                                <div className="text-xs">
                                  <FormLabel className="text-muted-foreground">GST: ₹{item.gstAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</FormLabel>
                                </div>
                              )}
                              <FormField
                                control={form.control}
                                name={`items.${index}.hasWarranty`}
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={field.value}
                                      onChange={field.onChange}
                                      className="h-4 w-4"
                                      data-testid={`checkbox-warranty-${index}`}
                                    />
                                    <FormLabel className="!mt-0">Warranty</FormLabel>
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}
                          <div className="text-right">
                            <FormLabel className="text-xs text-muted-foreground">Total</FormLabel>
                            <p className="font-semibold">₹{item.total.toLocaleString()}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Discount</h3>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <FormField
                      control={form.control}
                      name="couponCode"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Coupon Code</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter coupon code" data-testid="input-coupon-code" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="sm:self-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={applyCoupon}
                        disabled={!couponCode || validateCouponMutation.isPending}
                        data-testid="button-apply-coupon"
                        className="w-full sm:w-auto"
                      >
                        <Tag className="h-4 w-4 mr-1" />
                        Apply
                      </Button>
                    </div>
                  </div>

                  {couponValidation && (
                    <Badge variant="default" data-testid="badge-coupon-applied">
                      Coupon Applied: {couponValidation.coupon.discountType === 'percentage'
                        ? `${couponValidation.coupon.discountValue}% off`
                        : `₹${couponValidation.coupon.discountValue} off`}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Invoice Summary
                  </h3>
                  
                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <div className="flex justify-between text-base">
                      <span>Subtotal:</span>
                      <span className="font-semibold" data-testid="text-subtotal">₹{calculatedTotals.subtotal.toLocaleString()}</span>
                    </div>
                    
                    {calculatedTotals.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span className="font-semibold" data-testid="text-discount">-₹{calculatedTotals.discount.toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="border-t border-border pt-3 mt-3">
                      <div className="flex justify-between text-xl font-bold">
                        <span>Grand Total:</span>
                        <span data-testid="text-grand-total">₹{calculatedTotals.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Note: GST is calculated per item. Check the GST box for items that include GST in their price.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Additional notes..." data-testid="textarea-notes" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Terms & Conditions</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Payment terms and conditions..." data-testid="textarea-terms" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-invoice"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createInvoiceMutation.isPending}
                data-testid="button-create-invoice"
                className="w-full sm:w-auto"
              >
                {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
