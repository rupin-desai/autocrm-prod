import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const money = (paise = 0) =>
  `₹${(Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const get = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => ({}))).error || "Request failed",
    );
  return response.json();
};
const rupees = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
};
const Select = ({ value, onChange, children }: any) => (
  <select
    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {children}
  </select>
);

export default function PurchaseAccounting() {
  const [location] = useLocation();
  const { toast } = useToast();
  const section = location.includes("suppliers")
    ? "suppliers"
    : location.includes("mappings")
      ? "mappings"
      : location.includes("supplier-ledger")
        ? "ledger"
        : location.includes("reconciliation")
          ? "reconciliation"
          : location.includes("payments")
            ? "payments"
            : location.includes("advances")
              ? "advances"
              : location.includes("returns")
                ? "returns"
                : "bills";
  const context = useQuery<any>({
    queryKey: ["/api/accounting/context"],
    queryFn: () => get("/api/accounting/context"),
  });
  const companyId = context.data?.company?._id || "";
  const financialYearId = context.data?.financialYear?._id || "";
  const [billSearch, setBillSearch] = useState("");
  const [billSupplierFilter, setBillSupplierFilter] = useState("");
  const [billFromDate, setBillFromDate] = useState("");
  const [billToDate, setBillToDate] = useState("");
  const [reconciliationStatus, setReconciliationStatus] = useState("");
  const billParams = new URLSearchParams({ companyId });
  if (financialYearId) billParams.set("financialYearId", financialYearId);
  if (section === "reconciliation") {
    if (billSearch) billParams.set("search", billSearch);
    if (billSupplierFilter) billParams.set("supplierId", billSupplierFilter);
    if (billFromDate) billParams.set("fromDate", billFromDate);
    if (billToDate) billParams.set("toDate", billToDate);
    if (reconciliationStatus)
      billParams.set("reconciliationStatus", reconciliationStatus);
  }
  const suppliers = useQuery<any>({
    queryKey: ["/api/accounting/purchase/suppliers", companyId],
    queryFn: () =>
      get(`/api/accounting/purchase/suppliers?companyId=${companyId}`),
    enabled: Boolean(companyId),
  });
  const bills = useQuery<any[]>({
    queryKey: [
      "/api/accounting/purchase/bills",
      companyId,
      financialYearId,
      section,
      billSearch,
      billSupplierFilter,
      billFromDate,
      billToDate,
      reconciliationStatus,
    ],
    queryFn: () =>
      get(`/api/accounting/purchase/bills?${billParams.toString()}`),
    enabled: Boolean(companyId),
  });
  const mappings = useQuery<any>({
    queryKey: ["/api/accounting/purchase-mappings", companyId],
    queryFn: () =>
      get(`/api/accounting/purchase-mappings?companyId=${companyId}`),
    enabled: Boolean(companyId),
  });
  const ledgers = useQuery<any>({
    queryKey: ["/api/accounting/ledgers", companyId],
    queryFn: () =>
      get(`/api/accounting/ledgers?companyId=${companyId}&limit=500`),
    enabled: Boolean(companyId),
  });
  const payments = useQuery<any[]>({
    queryKey: ["/api/accounting/purchase/payments", companyId],
    queryFn: () =>
      get(`/api/accounting/purchase/payments?companyId=${companyId}`),
    enabled: section === "payments" && Boolean(companyId),
  });
  const advances = useQuery<any[]>({
    queryKey: ["/api/accounting/purchase/advances", companyId],
    queryFn: () =>
      get(`/api/accounting/purchase/advances?companyId=${companyId}`),
    enabled: section === "advances" && Boolean(companyId),
  });
  const returns = useQuery<any[]>({
    queryKey: ["/api/accounting/purchase/returns", companyId],
    queryFn: () =>
      get(`/api/accounting/purchase/returns?companyId=${companyId}`),
    enabled: section === "returns" && Boolean(companyId),
  });
  const supplierItems = suppliers.data?.items || [];
  const billItems = bills.data || [];
  const title: Record<string, string> = {
    suppliers: "Suppliers",
    bills: "Purchase Bills",
    mappings: "Purchase Accounting Mappings",
    ledger: "Supplier Ledger",
    reconciliation: "Purchase Reconciliation",
    payments: "Supplier Payments",
    advances: "Supplier Advances",
    returns: "Purchase Returns",
  };
  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/accounting/purchase/bills"],
    });
    queryClient.invalidateQueries({
      queryKey: ["/api/accounting/purchase/payments"],
    });
    queryClient.invalidateQueries({
      queryKey: ["/api/accounting/purchase/advances"],
    });
    queryClient.invalidateQueries({
      queryKey: ["/api/accounting/purchase/returns"],
    });
  };
  const action = (method: string, url: string, body: any, message: string) =>
    apiRequest(method, url, body).then(() => {
      invalidate();
      toast({ title: message });
    });
  const formField = (
    label: string,
    value: string,
    set: (v: string) => void,
    type = "text",
  ) => (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );
  const [supplierCode, setSupplierCode] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const createSupplier = useMutation({
    mutationFn: () =>
      action(
        "POST",
        "/api/accounting/purchase/suppliers",
        { companyId, supplierCode, name: supplierName },
        "Supplier created",
      ),
    onSuccess: () => {
      setSupplierCode("");
      setSupplierName("");
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/purchase/suppliers"],
      });
    },
    onError: (e: any) =>
      toast({
        title: e.message || "Supplier creation failed",
        variant: "destructive",
      }),
  });
  const [billSupplier, setBillSupplier] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [internalBillNumber, setInternalBillNumber] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [rate, setRate] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [taxType, setTaxType] = useState("none");
  const taxablePaise = Math.max(
    0,
    rupees(rate) * Number(quantity || 0) - rupees(discount),
  );
  const taxPaise = rupees(taxAmount);
  const totalPaise = taxablePaise + taxPaise;
  const [billStatus, setBillStatus] = useState<"draft" | "pending_approval">(
    "draft",
  );
  const billPayload = () => ({
    companyId,
    financialYearId,
    supplierId: billSupplier,
    supplierInvoiceNumber,
    supplierInvoiceDate,
    internalBillNumber,
    lines: [
      {
        description,
        type: "product",
        quantity: Number(quantity),
        unit: "Nos",
        ratePaise: rupees(rate),
        discountPaise: rupees(discount),
        taxablePaise,
        taxAmountPaise: taxPaise,
        taxType,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalPaise,
      },
    ],
    subtotalPaise: taxablePaise,
    taxAmountPaise: taxPaise,
    grandTotalPaise: totalPaise,
    status: billStatus,
  });
  const createBill = useMutation({
    mutationFn: () =>
      action(
        "POST",
        "/api/accounting/purchase/bills",
        billPayload(),
        billStatus === "draft"
          ? "Purchase bill saved as draft"
          : "Purchase bill submitted",
      ),
    onSuccess: () => {
      invalidate();
      setSupplierInvoiceNumber("");
      setInternalBillNumber("");
      setDescription("");
    },
    onError: (e: any) =>
      toast({
        title: e.message || "Purchase bill failed",
        variant: "destructive",
      }),
  });
  const [preview, setPreview] = useState<any>(null);
  const billStatusAction = async (id: string, status: string) => {
    try {
      await action(
        "POST",
        `/api/accounting/purchase/bills/${id}/status`,
        { status },
        status === "approved" ? "Bill approved" : "Bill submitted",
      );
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };
  const postBill = async (id: string) => {
    try {
      await action(
        "POST",
        `/api/accounting/purchase/bills/${id}/post`,
        {},
        "Purchase bill posted",
      );
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };
  const previewBill = async (id: string) => {
    try {
      setPreview(await get(`/api/accounting/purchase/bills/${id}/preview`));
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };
  const [paymentSupplier, setPaymentSupplier] = useState("");
  const [paymentBill, setPaymentBill] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentKey] = useState(
    () => `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const submitPayment = async () => {
    try {
      await action(
        "POST",
        "/api/accounting/purchase/payments",
        {
          companyId,
          financialYearId,
          supplierId: paymentSupplier,
          amountPaise: rupees(paymentAmount),
          paymentMode,
          paymentDate,
          transactionReference: paymentReference,
          idempotencyKey: paymentKey,
          allocations: [
            { purchaseBillId: paymentBill, amountPaise: rupees(paymentAmount) },
          ],
        },
        "Supplier payment posted",
      );
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };
  const [advanceSupplier, setAdvanceSupplier] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMode, setAdvanceMode] = useState("Cash");
  const [advanceDate, setAdvanceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [advanceKey] = useState(
    () => `advance-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [allocationAdvance, setAllocationAdvance] = useState("");
  const [allocationBill, setAllocationBill] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const submitAdvance = async () => {
    try {
      await action(
        "POST",
        "/api/accounting/purchase/advances",
        {
          companyId,
          financialYearId,
          supplierId: advanceSupplier,
          amountPaise: rupees(advanceAmount),
          paymentMode: advanceMode,
          receivedDate: advanceDate,
          idempotencyKey: advanceKey,
        },
        "Supplier advance posted",
      );
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };
  const allocateAdvance = async () => {
    try {
      await action(
        "POST",
        `/api/accounting/purchase/advances/${allocationAdvance}/allocate`,
        {
          purchaseBillId: allocationBill,
          amountPaise: rupees(allocationAmount),
        },
        "Advance allocated",
      );
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };
  const [returnSupplier, setReturnSupplier] = useState("");
  const [returnBill, setReturnBill] = useState("");
  const [returnNumber, setReturnNumber] = useState("");
  const [returnAmount, setReturnAmount] = useState("");
  const [returnTax, setReturnTax] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const submitReturn = async () => {
    try {
      await action(
        "POST",
        "/api/accounting/purchase/returns",
        {
          companyId,
          financialYearId,
          supplierId: returnSupplier,
          purchaseBillId: returnBill,
          returnNumber,
          amountPaise: rupees(returnAmount),
          taxAmountPaise: rupees(returnTax),
          reason: returnReason,
        },
        "Purchase return posted",
      );
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };
  const [ledgerSupplier, setLedgerSupplier] = useState("");
  const ledger = useQuery<any>({
    queryKey: [
      "/api/accounting/purchase/suppliers/ledger",
      ledgerSupplier,
      financialYearId,
    ],
    queryFn: () =>
      get(
        `/api/accounting/purchase/suppliers/${ledgerSupplier}/ledger?financialYearId=${financialYearId}`,
      ),
    enabled: section === "ledger" && Boolean(ledgerSupplier && financialYearId),
  });
  const [reconciliationBill, setReconciliationBill] = useState("");
  const reconciliation = useQuery<any>({
    queryKey: [
      "/api/accounting/purchase/reconciliation",
      reconciliationBill,
      companyId,
      financialYearId,
    ],
    queryFn: () =>
      get(
        `/api/accounting/purchase/reconciliation/bills/${reconciliationBill}`,
      ),
    enabled:
      section === "reconciliation" &&
      Boolean(reconciliationBill && companyId && financialYearId),
  });
  const mappingFields = mappings.data?.requiredFields || [];
  const [mappingForm, setMappingForm] = useState<any>({});
  const ledgerItems = ledgers.data?.items || ledgers.data || [];
  const mappingSave = useMutation({
    mutationFn: () =>
      action(
        "PUT",
        "/api/accounting/purchase-mappings",
        { companyId, ...mappingForm },
        "Purchase mappings saved",
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["/api/accounting/purchase-mappings"],
      }),
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });
  const postedBills = useMemo(
    () => billItems.filter((b: any) => b.status === "posted"),
    [billItems],
  );
  const supplierOptions = (
    <>
      <option value="">Select supplier</option>
      {supplierItems.map((s: any) => (
        <option key={s._id} value={s._id}>
          {s.supplierCode} — {s.name}
        </option>
      ))}
    </>
  );
  const billOptions = (
    <>
      <option value="">Select posted bill</option>
      {postedBills.map((b: any) => (
        <option key={b._id} value={b._id}>
          {b.internalBillNumber} — {money(b.grandTotalPaise)}
        </option>
      ))}
    </>
  );
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title[section]}</h1>
        <p className="text-muted-foreground">
          Company: {context.data?.company?.name || "Loading"} · FY:{" "}
          {context.data?.financialYear?.label || "Loading"}
        </p>
      </div>
      {section === "suppliers" && (
        <Card>
          <CardHeader>
            <CardTitle>Supplier master</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Supplier code</Label>
                <Input
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                />
              </div>
              <div>
                <Label>Supplier name</Label>
                <Input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  disabled={!supplierCode || !supplierName}
                  onClick={() => createSupplier.mutate()}
                >
                  Create Supplier
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ownership</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierItems.map((s: any) => (
                  <TableRow key={s._id}>
                    <TableCell>{s.supplierCode}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>
                      <Badge>{s.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.ownershipStatus}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {section === "bills" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Create purchase bill</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <Label>Supplier</Label>
                  <Select value={billSupplier} onChange={setBillSupplier}>
                    {supplierOptions}
                  </Select>
                </div>
                <div>
                  <Label>Supplier invoice no.</Label>
                  <Input
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Invoice date</Label>
                  <Input
                    type="date"
                    value={supplierInvoiceDate}
                    onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Internal bill no.</Label>
                  <Input
                    value={internalBillNumber}
                    onChange={(e) => setInternalBillNumber(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Label>Product/service</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Rate ₹</Label>
                  <Input
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Discount ₹</Label>
                  <Input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Stored tax ₹</Label>
                  <Input
                    type="number"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>GST classification</Label>
                  <Select value={taxType} onChange={setTaxType}>
                    <option value="none">Non-GST</option>
                    <option value="cgst_sgst">CGST + SGST</option>
                    <option value="igst">IGST</option>
                    <option value="ambiguous">Ambiguous (blocked)</option>
                  </Select>
                </div>
              </div>
              <div className="rounded border p-3 text-sm">
                Taxable {money(taxablePaise)} · Tax {money(taxPaise)} · Grand
                total <strong>{money(totalPaise)}</strong>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={
                    !billSupplier ||
                    !supplierInvoiceNumber ||
                    !internalBillNumber ||
                    !description
                  }
                  onClick={() => {
                    setBillStatus("draft");
                    createBill.mutate();
                  }}
                >
                  Save Draft
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !billSupplier ||
                    !supplierInvoiceNumber ||
                    !internalBillNumber ||
                    !description
                  }
                  onClick={() => {
                    setBillStatus("pending_approval");
                    createBill.mutate();
                  }}
                >
                  Submit for Approval
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bill workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Internal</TableHead>
                    <TableHead>Supplier invoice</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billItems.map((b: any) => (
                    <TableRow key={b._id}>
                      <TableCell>{b.internalBillNumber}</TableCell>
                      <TableCell>{b.supplierInvoiceNumber}</TableCell>
                      <TableCell>{money(b.grandTotalPaise)}</TableCell>
                      <TableCell>
                        <Badge>{b.status}</Badge>
                      </TableCell>
                      <TableCell className="flex gap-2">
                        {b.status === "draft" && (
                          <Button
                            size="sm"
                            onClick={() =>
                              billStatusAction(b._id, "pending_approval")
                            }
                          >
                            Submit
                          </Button>
                        )}
                        {b.status === "pending_approval" && (
                          <Button
                            size="sm"
                            onClick={() => billStatusAction(b._id, "approved")}
                          >
                            Approve
                          </Button>
                        )}
                        {["approved", "posted"].includes(b.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => previewBill(b._id)}
                          >
                            Preview
                          </Button>
                        )}
                        {b.status === "approved" && (
                          <Button size="sm" onClick={() => postBill(b._id)}>
                            Post to Accounts
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview && (
                <div className="mt-4 rounded border p-4">
                  <p className="font-medium">
                    Accounting preview — {preview.bill.internalBillNumber}
                  </p>
                  {preview.lines.map((l: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{l.description}</span>
                      <span>
                        Dr {money(l.debitPaise)} · Cr {money(l.creditPaise)}
                      </span>
                    </div>
                  ))}
                  <p className="mt-2 font-semibold">
                    Balanced: {money(preview.totalDebitPaise)} ={" "}
                    {money(preview.totalCreditPaise)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {section === "mappings" && (
        <Card>
          <CardHeader>
            <CardTitle>Purchase accounting mappings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Only active company ledgers are available. Missing mappings block
              posting.
            </p>
            {mappingFields.map((field: string) => (
              <div key={field}>
                <Label>{field}</Label>
                <Select
                  value={
                    mappingForm[field] ||
                    mappings.data?.mapping?.[field]?._id ||
                    mappings.data?.mapping?.[field] ||
                    ""
                  }
                  onChange={(v: string) =>
                    setMappingForm({ ...mappingForm, [field]: v || null })
                  }
                >
                  <option value="">Not configured</option>
                  {ledgerItems.map((l: any) => (
                    <option key={l._id} value={l._id}>
                      {l.code} — {l.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
            <Button onClick={() => mappingSave.mutate()}>Save mappings</Button>
          </CardContent>
        </Card>
      )}
      {section === "payments" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Supplier payment</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Supplier</Label>
                <Select value={paymentSupplier} onChange={setPaymentSupplier}>
                  {supplierOptions}
                </Select>
              </div>
              <div>
                <Label>Posted bill</Label>
                <Select value={paymentBill} onChange={setPaymentBill}>
                  {billOptions}
                </Select>
              </div>
              <div>
                <Label>Amount ₹</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Mode</Label>
                <Select value={paymentMode} onChange={setPaymentMode}>
                  {["Cash", "Bank Transfer", "UPI", "Card", "Cheque"].map(
                    (m) => (
                      <option key={m}>{m}</option>
                    ),
                  )}
                </Select>
              </div>
              <div>
                <Label>Transaction reference</Label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
              <Button
                disabled={!paymentSupplier || !paymentBill || !paymentAmount}
                onClick={submitPayment}
              >
                Post Payment
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payment history</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payments.data || []).map((p: any) => (
                    <TableRow key={p._id}>
                      <TableCell>{p.supplierId?.name}</TableCell>
                      <TableCell>{money(p.amountPaise)}</TableCell>
                      <TableCell>{p.paymentMode}</TableCell>
                      <TableCell>
                        <Badge>{p.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
      {section === "advances" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Supplier advance</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div>
                <Label>Supplier</Label>
                <Select value={advanceSupplier} onChange={setAdvanceSupplier}>
                  {supplierOptions}
                </Select>
              </div>
              <div>
                <Label>Amount ₹</Label>
                <Input
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Mode</Label>
                <Select value={advanceMode} onChange={setAdvanceMode}>
                  {["Cash", "Bank Transfer", "UPI", "Card", "Cheque"].map(
                    (m) => (
                      <option key={m}>{m}</option>
                    ),
                  )}
                </Select>
              </div>
              <Button
                disabled={!advanceSupplier || !advanceAmount}
                onClick={submitAdvance}
              >
                Post Advance
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Allocate advance</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div>
                <Label>Advance</Label>
                <Select
                  value={allocationAdvance}
                  onChange={setAllocationAdvance}
                >
                  <option value="">Select advance</option>
                  {(advances.data || [])
                    .filter((a: any) => a.status === "posted")
                    .map((a: any) => (
                      <option key={a._id} value={a._id}>
                        {a.supplierId?.name} — available{" "}
                        {money(a.amountPaise - a.allocatedPaise)}
                      </option>
                    ))}
                </Select>
              </div>
              <div>
                <Label>Posted bill</Label>
                <Select value={allocationBill} onChange={setAllocationBill}>
                  {billOptions}
                </Select>
              </div>
              <div>
                <Label>Amount ₹</Label>
                <Input
                  type="number"
                  value={allocationAmount}
                  onChange={(e) => setAllocationAmount(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  disabled={
                    !allocationAdvance || !allocationBill || !allocationAmount
                  }
                  onClick={allocateAdvance}
                >
                  Allocate
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Advance history</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Allocated</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(advances.data || []).map((a: any) => (
                    <TableRow key={a._id}>
                      <TableCell>{a.supplierId?.name}</TableCell>
                      <TableCell>{money(a.amountPaise)}</TableCell>
                      <TableCell>{money(a.allocatedPaise)}</TableCell>
                      <TableCell>
                        {money(a.amountPaise - a.allocatedPaise)}
                      </TableCell>
                      <TableCell>
                        <Badge>{a.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
      {section === "returns" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Purchase return / debit note</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Supplier</Label>
                <Select value={returnSupplier} onChange={setReturnSupplier}>
                  {supplierOptions}
                </Select>
              </div>
              <div>
                <Label>Original posted bill</Label>
                <Select value={returnBill} onChange={setReturnBill}>
                  {billOptions}
                </Select>
              </div>
              <div>
                <Label>Debit note reference</Label>
                <Input
                  value={returnNumber}
                  onChange={(e) => setReturnNumber(e.target.value)}
                />
              </div>
              <div>
                <Label>Return amount ₹</Label>
                <Input
                  type="number"
                  value={returnAmount}
                  onChange={(e) => setReturnAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Stored GST ₹</Label>
                <Input
                  type="number"
                  value={returnTax}
                  onChange={(e) => setReturnTax(e.target.value)}
                />
              </div>
              <div>
                <Label>Reason</Label>
                <Input
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground md:col-span-3">
                GST returns are blocked unless stored CGST/SGST/IGST
                classification is explicit.
              </p>
              <Button
                disabled={
                  !returnSupplier ||
                  !returnBill ||
                  !returnNumber ||
                  !returnAmount ||
                  !returnReason
                }
                onClick={submitReturn}
              >
                Post Purchase Return
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Return history</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(returns.data || []).map((r: any) => (
                    <TableRow key={r._id}>
                      <TableCell>{r.returnNumber}</TableCell>
                      <TableCell>{r.supplierId?.name}</TableCell>
                      <TableCell>{money(r.amountPaise)}</TableCell>
                      <TableCell>
                        <Badge>{r.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
      {section === "ledger" && (
        <Card>
          <CardHeader>
            <CardTitle>Supplier ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md mb-4">
              <Label>Supplier</Label>
              <Select value={ledgerSupplier} onChange={setLedgerSupplier}>
                {supplierOptions}
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Particulars</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Running balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ledger.data?.items || []).map((item: any) => (
                  <TableRow key={`${item.voucherId}-${item.voucherNumber}`}>
                    <TableCell>
                      {new Date(item.date).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell>{item.voucherNumber}</TableCell>
                    <TableCell>
                      {item.narration}{" "}
                      {item.referenceNumber && `(${item.referenceNumber})`}
                    </TableCell>
                    <TableCell>{money(item.debitPaise)}</TableCell>
                    <TableCell>{money(item.creditPaise)}</TableCell>
                    <TableCell>{money(item.runningBalancePaise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {ledger.data && (
              <p className="font-semibold mt-3">
                Closing balance: {money(ledger.data.balancePaise)}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {section === "reconciliation" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Purchase reconciliation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-5">
                <div className="md:col-span-2">
                  <Label>Search bill number</Label>
                  <Input
                    value={billSearch}
                    onChange={(e) => setBillSearch(e.target.value)}
                    placeholder="Internal or supplier invoice"
                  />
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Select
                    value={billSupplierFilter}
                    onChange={setBillSupplierFilter}
                  >
                    <option value="">All suppliers</option>
                    {supplierItems.map((s: any) => (
                      <option key={s._id} value={s._id}>
                        {s.supplierCode} — {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>From date</Label>
                  <Input
                    type="date"
                    value={billFromDate}
                    onChange={(e) => setBillFromDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>To date</Label>
                  <Input
                    type="date"
                    value={billToDate}
                    onChange={(e) => setBillToDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-w-xs">
                <Label>Reconciliation status</Label>
                <Select
                  value={reconciliationStatus}
                  onChange={setReconciliationStatus}
                >
                  <option value="">All statuses</option>
                  <option value="matched">Matched</option>
                  <option value="not_posted">Not posted</option>
                  <option value="missing_voucher">Missing voucher</option>
                  <option value="mismatch">Mismatch</option>
                </Select>
              </div>
              {bills.isLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading purchase bills…
                </p>
              )}
              {bills.isError && (
                <div className="rounded border border-destructive/50 p-4">
                  <p className="text-sm">Unable to load purchase bills.</p>
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => bills.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              )}
              {!bills.isLoading && !bills.isError && billItems.length === 0 && (
                <p className="rounded border p-4 text-sm text-muted-foreground">
                  No purchase bills match the selected filters.
                </p>
              )}
              {billItems.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billItems.map((b: any) => (
                      <TableRow
                        key={b._id}
                        className={
                          reconciliationBill === b._id
                            ? "bg-muted/50"
                            : undefined
                        }
                      >
                        <TableCell>
                          <div className="font-medium">
                            {b.internalBillNumber}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {b.supplierInvoiceNumber}
                          </div>
                        </TableCell>
                        <TableCell>{b.supplierId?.name || "—"}</TableCell>
                        <TableCell>
                          {b.supplierInvoiceDate
                            ? new Date(
                                b.supplierInvoiceDate,
                              ).toLocaleDateString("en-IN")
                            : "—"}
                        </TableCell>
                        <TableCell>{money(b.grandTotalPaise)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              [
                                "missing_voucher",
                                "mismatch",
                                "duplicate",
                              ].includes(b.reconciliationStatus)
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {b.reconciliationStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReconciliationBill(b._id)}
                          >
                            View details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {reconciliationBill && (
            <Card>
              <CardHeader>
                <CardTitle>Reconciliation details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reconciliation.isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Loading reconciliation details…
                  </p>
                )}
                {reconciliation.isError && (
                  <div className="rounded border border-destructive/50 p-4">
                    <p className="text-sm">
                      Unable to load reconciliation details.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-2"
                      onClick={() => reconciliation.refetch()}
                    >
                      Retry
                    </Button>
                  </div>
                )}
                {reconciliation.data && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded border p-3">
                        <p className="text-xs text-muted-foreground">
                          Purchase bill
                        </p>
                        <p className="font-semibold">
                          {money(reconciliation.data.grandTotalPaise)}
                        </p>
                      </div>
                      <div className="rounded border p-3">
                        <p className="text-xs text-muted-foreground">
                          Posted voucher
                        </p>
                        <p className="font-semibold">
                          {money(
                            reconciliation.data
                              .postedPurchaseVoucherAmountPaise,
                          )}
                        </p>
                      </div>
                      <div className="rounded border p-3">
                        <p className="text-xs text-muted-foreground">
                          Supplier payments
                        </p>
                        <p className="font-semibold">
                          {money(reconciliation.data.paymentTotalPaise)}
                        </p>
                      </div>
                      <div className="rounded border p-3">
                        <p className="text-xs text-muted-foreground">
                          Advance allocations
                        </p>
                        <p className="font-semibold">
                          {money(
                            reconciliation.data.confirmedAdvanceAllocationPaise,
                          )}
                        </p>
                      </div>
                      <div className="rounded border p-3">
                        <p className="text-xs text-muted-foreground">
                          Outstanding
                        </p>
                        <p className="font-semibold">
                          {money(reconciliation.data.outstandingPaise)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">Status:</span>
                      <Badge
                        variant={
                          ["missing_voucher", "mismatch", "duplicate"].includes(
                            reconciliation.data.reconciliationStatus,
                          )
                            ? "destructive"
                            : "default"
                        }
                      >
                        {reconciliation.data.reconciliationStatus}
                      </Badge>
                      {reconciliation.data.source?.voucherId?.voucherNumber && (
                        <span className="text-sm text-muted-foreground">
                          Voucher{" "}
                          {reconciliation.data.source.voucherId.voucherNumber}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="mb-2 font-medium">
                        Supplier payment vouchers
                      </h3>
                      {reconciliation.data.supplierPayments?.length ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Mode</TableHead>
                              <TableHead>Allocated</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead>Voucher</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reconciliation.data.supplierPayments.map(
                              (p: any) => (
                                <TableRow
                                  key={`${p.paymentId}-${p.voucher?._id || "unlinked"}`}
                                >
                                  <TableCell>
                                    {p.paymentDate
                                      ? new Date(
                                          p.paymentDate,
                                        ).toLocaleDateString("en-IN")
                                      : "—"}
                                  </TableCell>
                                  <TableCell>{p.paymentMode}</TableCell>
                                  <TableCell>
                                    {money(p.allocatedAmountPaise)}
                                  </TableCell>
                                  <TableCell>
                                    {p.transactionReference || "—"}
                                  </TableCell>
                                  <TableCell>
                                    {p.voucher?.voucherNumber ||
                                      "Missing voucher"}
                                  </TableCell>
                                </TableRow>
                              ),
                            )}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="rounded border p-3 text-sm text-muted-foreground">
                          No posted supplier payment vouchers are linked to this
                          bill.
                        </p>
                      )}
                    </div>
                    <div>
                      <h3 className="mb-2 font-medium">
                        Confirmed advance allocations
                      </h3>
                      {reconciliation.data.allocations?.length ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Allocation</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Voucher</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reconciliation.data.allocations.map((a: any) => (
                              <TableRow key={a._id}>
                                <TableCell>{a._id}</TableCell>
                                <TableCell>{money(a.amountPaise)}</TableCell>
                                <TableCell>
                                  {a.voucherId || "Missing voucher"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="rounded border p-3 text-sm text-muted-foreground">
                          No confirmed advance allocations.
                        </p>
                      )}
                    </div>
                    <div>
                      <h3 className="mb-2 font-medium">
                        Reconciliation checks
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(
                          reconciliation.data.mismatches || {},
                        ).map(([key, value]) => (
                          <Badge
                            key={key}
                            variant={value ? "destructive" : "outline"}
                          >
                            {key}: {value ? "Issue" : "OK"}
                          </Badge>
                        ))}
                        {reconciliation.data.duplicatePostingCount > 1 && (
                          <Badge variant="destructive">
                            Duplicate postings:{" "}
                            {reconciliation.data.duplicatePostingCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
