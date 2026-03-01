import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CreditCard, Smartphone, Banknote, Building, Receipt, Plus, Trash2 } from "lucide-react";

const paymentEntrySchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  paymentMode: z.enum(['UPI', 'Cash', 'Card', 'Net Banking', 'Cheque']),
  transactionId: z.string().optional(),
});

const paymentFormSchema = z.object({
  payments: z.array(paymentEntrySchema).min(1, "Add at least one payment"),
  notes: z.string().optional(),
}).refine((data) => {
  const totalAmount = data.payments.reduce((sum, p) => sum + p.amount, 0);
  return totalAmount > 0;
}, {
  message: "Total payment amount must be greater than 0",
  path: ["payments"],
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
}

const PAYMENT_MODES = [
  { value: 'UPI', label: 'UPI', icon: Smartphone, color: 'text-blue-600' },
  { value: 'Cash', label: 'Cash', icon: Banknote, color: 'text-green-600' },
  { value: 'Card', label: 'Debit/Credit Card', icon: CreditCard, color: 'text-purple-600' },
  { value: 'Net Banking', label: 'Net Banking', icon: Building, color: 'text-orange-600' },
  { value: 'Cheque', label: 'Cheque', icon: Receipt, color: 'text-gray-600' },
];

export function PaymentRecordingDialog({ open, onOpenChange, invoice }: PaymentRecordingDialogProps) {
  const { toast } = useToast();
  const [showRazorpay, setShowRazorpay] = useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      payments: [{ amount: invoice?.dueAmount || 0, paymentMode: 'Cash', transactionId: '' }],
      notes: '',
    },
  });

  const payments = form.watch('payments');
  const totalPaymentAmount = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  const recordPaymentMutation = useMutation({
    mutationFn: (data: PaymentFormValues) =>
      apiRequest('POST', `/api/invoices/${invoice._id}/payments`, { ...data, totalAmount: totalPaymentAmount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ title: "Payment recorded successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to record payment";
      toast({ 
        title: "Failed to record payment", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: PaymentFormValues) => {
    if (totalPaymentAmount > invoice?.dueAmount) {
      toast({ 
        title: "Error", 
        description: `Total payment (₹${totalPaymentAmount.toLocaleString()}) exceeds due amount (₹${invoice?.dueAmount.toLocaleString()})`,
        variant: "destructive" 
      });
      return;
    }
    recordPaymentMutation.mutate(data);
  };

  const handleRazorpayPayment = () => {
    setShowRazorpay(true);
    setTimeout(() => {
      toast({
        title: "Razorpay Integration (Demo)",
        description: "This is a dummy Razorpay integration. In production, this would process the payment.",
      });
      setShowRazorpay(false);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto" data-testid="dialog-record-payment">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Invoice: {invoice?.invoiceNumber} | Customer: {invoice?.customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">₹{invoice?.totalAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold text-green-600">₹{invoice?.paidAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due</p>
                  <p className="text-2xl font-bold text-red-600">₹{invoice?.dueAmount.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Total Payment This Time:</p>
                  <p className={`text-lg font-bold ${totalPaymentAmount > invoice?.dueAmount ? 'text-red-600' : 'text-blue-600'}`}>
                    ₹{totalPaymentAmount.toLocaleString()}
                  </p>
                </div>
                {totalPaymentAmount > invoice?.dueAmount && (
                  <p className="text-xs text-red-600 mt-2">Exceeds due amount</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <FormLabel className="text-base">Payment Methods</FormLabel>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newPayments = [...(payments || []), { amount: 0, paymentMode: 'Cash' as const, transactionId: '' }];
                      form.setValue('payments', newPayments);
                    }}
                    data-testid="button-add-payment-method"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Payment Method
                  </Button>
                </div>

                {payments?.map((payment, index) => {
                  const modeObj = PAYMENT_MODES.find(m => m.value === payment.paymentMode);
                  return (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                          <FormField
                            control={form.control}
                            name={`payments.${index}.amount`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Amount</FormLabel>
                                <FormControl>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*\.?[0-9]*"
                                    {...field}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        field.onChange(val === '' ? 0 : parseFloat(val));
                                      }
                                    }}
                                    data-testid={`input-payment-amount-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {payments.length > 1 && (
                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              onClick={() => {
                                const newPayments = payments.filter((_, i) => i !== index);
                                form.setValue('payments', newPayments);
                              }}
                              data-testid={`button-remove-payment-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <FormField
                          control={form.control}
                          name={`payments.${index}.paymentMode`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Mode</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger data-testid={`select-payment-mode-${index}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {PAYMENT_MODES.map(mode => (
                                    <SelectItem key={mode.value} value={mode.value}>
                                      <div className="flex items-center gap-2">
                                        <mode.icon className={`h-4 w-4 ${mode.color}`} />
                                        {mode.label}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {payment.paymentMode !== 'Cash' && (
                          <FormField
                            control={form.control}
                            name={`payments.${index}.transactionId`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Transaction ID / Reference</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder={
                                      payment.paymentMode === 'UPI' ? 'UPI Transaction ID' :
                                      payment.paymentMode === 'Card' ? 'Card Transaction ID' :
                                      payment.paymentMode === 'Cheque' ? 'Cheque Number' :
                                      'Transaction Reference'
                                    }
                                    data-testid={`input-transaction-id-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Additional payment notes..."
                        data-testid="textarea-payment-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Quick Payment Options</p>
                <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="sm:w-auto w-full"
                    onClick={() => form.setValue('payments', [{ amount: invoice?.dueAmount || 0, paymentMode: 'Cash' as const, transactionId: '' }])}
                    data-testid="button-pay-full"
                  >
                    Pay Full Amount (₹{invoice?.dueAmount.toLocaleString()})
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="sm:w-auto w-full"
                    onClick={() => {
                      const half = Math.round((invoice?.dueAmount || 0) / 2);
                      form.setValue('payments', [
                        { amount: half, paymentMode: 'Cash' as const, transactionId: '' },
                        { amount: (invoice?.dueAmount || 0) - half, paymentMode: 'Cash' as const, transactionId: '' }
                      ]);
                    }}
                    data-testid="button-pay-half"
                  >
                    Pay Half (₹{Math.round((invoice?.dueAmount || 0) / 2).toLocaleString()})
                  </Button>
                </div>
              </div>

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-payment"
                  className="sm:w-auto w-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  data-testid="button-submit-payment"
                  className="sm:w-auto w-full"
                >
                  {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
