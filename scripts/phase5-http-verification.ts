import mongoose from "mongoose";
import { hashPassword } from "../server/auth";
import { User } from "../server/models/User";
import { Company } from "../server/models/Company";
import { FinancialYear } from "../server/models/FinancialYear";
import { AccountingPeriod } from "../server/models/AccountingPeriod";
import { AccountGroup } from "../server/models/AccountGroup";
import { LedgerAccount } from "../server/models/LedgerAccount";
import { Supplier } from "../server/models/Supplier";
import { PurchaseBill } from "../server/models/PurchaseBill";
import { SupplierPayment } from "../server/models/SupplierPayment";
import { SupplierAdvance } from "../server/models/SupplierAdvance";
import { SupplierAdvanceAllocation } from "../server/models/SupplierAdvanceAllocation";
import { PurchaseReturn } from "../server/models/PurchaseReturn";
import { AccountingVoucher } from "../server/models/AccountingVoucher";
import { PurchaseAccountingSource } from "../server/models/PurchaseAccountingSource";

const base = "http://127.0.0.1:5055";
const json = (value: unknown) => ({
  "content-type": "application/json",
  body: JSON.stringify(value),
});
const result: Record<string, unknown> = {};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const password = "Phase5-Test-Password-20261031";
  const admin: any = await User.create({
    name: "Phase 5 HTTP Admin",
    email: "phase5-http-admin@example.test",
    mobileNumber: "919900000501",
    passwordHash: await hashPassword(password),
    role: "Admin",
    isActive: true,
  });
  const staff: any = await User.create({
    name: "Phase 5 HTTP Staff",
    email: "phase5-http-staff@example.test",
    mobileNumber: "919900000502",
    passwordHash: await hashPassword(password),
    role: "Service Staff",
    isActive: true,
  });
  const company: any = await Company.create({
    name: "Phase 5 HTTP Company",
    legalName: "Phase 5 HTTP Company Private Limited",
    authorizedUserIds: [admin._id, staff._id],
    createdBy: admin._id,
  });
  const fy: any = await FinancialYear.create({
    companyId: company._id,
    label: "2026-27 HTTP",
    startDate: new Date("2026-04-01"),
    endDate: new Date("2027-03-31"),
    status: "active",
    isCurrent: true,
    createdBy: admin._id,
  });
  const period: any = await AccountingPeriod.create({
    companyId: company._id,
    financialYearId: fy._id,
    periodNumber: 1,
    label: "FY HTTP",
    startDate: fy.startDate,
    endDate: fy.endDate,
    status: "open",
  });
  const expenseGroup: any = await AccountGroup.create({
    companyId: company._id,
    name: "HTTP Purchase Expenses",
    code: "HTTP-EXP",
    rootCategory: "expenses",
    normalBalance: "debit",
    createdBy: admin._id,
  });
  const liabilityGroup: any = await AccountGroup.create({
    companyId: company._id,
    name: "HTTP Supplier Liabilities",
    code: "HTTP-LIA",
    rootCategory: "liabilities",
    normalBalance: "credit",
    createdBy: admin._id,
  });
  const assetGroup: any = await AccountGroup.create({
    companyId: company._id,
    name: "HTTP Current Assets",
    code: "HTTP-AST",
    rootCategory: "assets",
    normalBalance: "debit",
    createdBy: admin._id,
  });
  const goods: any = await LedgerAccount.create({
    companyId: company._id,
    groupId: expenseGroup._id,
    code: "HTTP-PURCHASE",
    name: "HTTP Purchase Goods",
    createdBy: admin._id,
  });
  const returnLedger: any = await LedgerAccount.create({
    companyId: company._id,
    groupId: expenseGroup._id,
    code: "HTTP-RETURNS",
    name: "HTTP Purchase Returns",
    createdBy: admin._id,
  });
  const cash: any = await LedgerAccount.create({
    companyId: company._id,
    groupId: assetGroup._id,
    code: "HTTP-CASH",
    name: "HTTP Cash",
    ledgerType: "cash",
    createdBy: admin._id,
  });
  const advanceLedger: any = await LedgerAccount.create({
    companyId: company._id,
    groupId: liabilityGroup._id,
    code: "HTTP-ADVANCE",
    name: "HTTP Supplier Advances",
    createdBy: admin._id,
  });
  const payableGroup: any = await AccountGroup.create({
    companyId: company._id,
    name: "HTTP Payables",
    code: "HTTP-PAY",
    rootCategory: "liabilities",
    normalBalance: "credit",
    createdBy: admin._id,
  });
  const payable: any = await LedgerAccount.create({
    companyId: company._id,
    groupId: payableGroup._id,
    code: "HTTP-SUPPLIER",
    name: "HTTP Supplier Payable",
    ledgerType: "supplier",
    createdBy: admin._id,
  });
  const supplier: any = await Supplier.create({
    companyId: company._id,
    supplierCode: "SUP-HTTP",
    name: "HTTP Supplier",
    ownershipStatus: "verified",
    ledgerAccountId: payable._id,
    createdBy: admin._id,
  });
  const login = async (email: string) => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: json({ email, password }),
      ...json({ email, password }),
    });
    const cookie = response.headers.get("set-cookie")?.split(";")[0] || "";
    return { response, cookie };
  };
  const adminLogin = await login(admin.email);
  result.login = adminLogin.response.status;
  const call = async (
    cookie: string,
    method: string,
    path: string,
    body?: unknown,
  ) => {
    const payload: any = body === undefined ? {} : json(body);
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        cookie,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: payload.body,
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  };
  const adminCall = (method: string, path: string, body?: unknown) =>
    call(adminLogin.cookie, method, path, body);
  result.context = (
    await adminCall("POST", "/api/accounting/context", {
      companyId: company._id,
      financialYearId: fy._id,
    })
  ).status;
  result.supplierCreate = (
    await adminCall("POST", "/api/accounting/purchase/suppliers", {
      companyId: company._id,
      supplierCode: "SUP-HTTP-2",
      name: "HTTP Supplier Two",
    })
  ).status;
  const supplierUpdate = await adminCall(
    "PATCH",
    "/api/accounting/purchase/suppliers/" + supplier._id,
    { name: "HTTP Supplier Updated" },
  );
  result.supplierUpdate = supplierUpdate.status;
  const mapping = await adminCall("PUT", "/api/accounting/purchase-mappings", {
    companyId: company._id,
    purchaseGoodsLedgerId: goods._id,
    purchaseReturnsLedgerId: returnLedger._id,
    supplierPayableLedgerId: payable._id,
    cashLedgerId: cash._id,
    supplierAdvancesLedgerId: advanceLedger._id,
  });
  result.mapping = mapping.status;
  const billBody = {
    companyId: company._id,
    financialYearId: fy._id,
    supplierId: supplier._id,
    supplierInvoiceNumber: "SUP-INV-HTTP-1",
    supplierInvoiceDate: "2026-10-31",
    internalBillNumber: "PB-HTTP-1",
    lines: [
      {
        description: "HTTP item",
        type: "product",
        quantity: 1,
        unit: "Nos",
        ratePaise: 10000,
        discountPaise: 0,
        taxablePaise: 10000,
        taxAmountPaise: 0,
        taxType: "none",
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalPaise: 10000,
      },
    ],
    subtotalPaise: 10000,
    taxAmountPaise: 0,
    grandTotalPaise: 10000,
    status: "draft",
  };
  const createdBill: any = (
    await adminCall("POST", "/api/accounting/purchase/bills", billBody)
  ).data;
  result.billCreate = createdBill._id ? 201 : "failed";
  result.billApprove = (
    await adminCall(
      "POST",
      `/api/accounting/purchase/bills/${createdBill._id}/status`,
      { status: "pending_approval" },
    )
  ).status;
  result.billApprove2 = (
    await adminCall(
      "POST",
      `/api/accounting/purchase/bills/${createdBill._id}/status`,
      { status: "approved" },
    )
  ).status;
  result.preview = (
    await adminCall(
      "GET",
      `/api/accounting/purchase/bills/${createdBill._id}/preview`,
    )
  ).status;
  result.billPost = (
    await adminCall(
      "POST",
      `/api/accounting/purchase/bills/${createdBill._id}/post`,
      {},
    )
  ).status;
  result.billDuplicate = (
    await adminCall(
      "POST",
      `/api/accounting/purchase/bills/${createdBill._id}/post`,
      {},
    )
  ).status;
  const payment = {
    companyId: company._id,
    financialYearId: fy._id,
    supplierId: supplier._id,
    amountPaise: 4000,
    paymentMode: "Cash",
    paymentDate: "2026-10-31",
    transactionReference: "PAY-HTTP-1",
    idempotencyKey: "http-payment-key-1",
    allocations: [{ purchaseBillId: createdBill._id, amountPaise: 4000 }],
  };
  result.payment = (
    await adminCall("POST", "/api/accounting/purchase/payments", payment)
  ).status;
  result.paymentRetry = (
    await adminCall("POST", "/api/accounting/purchase/payments", payment)
  ).status;
  const p1 = {
    ...payment,
    amountPaise: 4000,
    transactionReference: "PAY-RACE-1",
    idempotencyKey: "http-payment-race-1",
    allocations: [{ purchaseBillId: createdBill._id, amountPaise: 4000 }],
  };
  const p2 = {
    ...p1,
    transactionReference: "PAY-RACE-2",
    idempotencyKey: "http-payment-race-2",
  };
  const paymentRace = await Promise.all([
    adminCall("POST", "/api/accounting/purchase/payments", p1),
    adminCall("POST", "/api/accounting/purchase/payments", p2),
  ]);
  result.paymentConcurrency = paymentRace.map((item) => item.status);
  const advanceBody = {
    companyId: company._id,
    financialYearId: fy._id,
    supplierId: supplier._id,
    amountPaise: 3000,
    paymentMode: "Cash",
    receivedDate: "2026-10-31",
    transactionReference: "ADV-HTTP-1",
    idempotencyKey: "http-advance-key-1",
  };
  const advanceResult: any = await adminCall(
    "POST",
    "/api/accounting/purchase/advances",
    advanceBody,
  );
  result.advance = advanceResult.status;
  const advanceId = advanceResult.data.advance?._id;
  const a1 = { purchaseBillId: createdBill._id, amountPaise: 1500 };
  const a2 = { purchaseBillId: createdBill._id, amountPaise: 1500 };
  const allocationRace = await Promise.all([
    adminCall(
      "POST",
      `/api/accounting/purchase/advances/${advanceId}/allocate`,
      a1,
    ),
    adminCall(
      "POST",
      `/api/accounting/purchase/advances/${advanceId}/allocate`,
      a2,
    ),
  ]);
  result.advanceConcurrency = allocationRace.map((item) => item.status);
  result.returnTooLarge = (
    await adminCall("POST", "/api/accounting/purchase/returns", {
      companyId: company._id,
      financialYearId: fy._id,
      supplierId: supplier._id,
      purchaseBillId: createdBill._id,
      returnNumber: "RET-HTTP-BAD",
      amountPaise: 11000,
      taxAmountPaise: 0,
      reason: "too large",
    })
  ).status;
  result.returnTaxTooLarge = (
    await adminCall("POST", "/api/accounting/purchase/returns", {
      companyId: company._id,
      financialYearId: fy._id,
      supplierId: supplier._id,
      purchaseBillId: createdBill._id,
      returnNumber: "RET-HTTP-TAX",
      amountPaise: 100,
      taxAmountPaise: 101,
      reason: "bad tax",
    })
  ).status;
  result.return = (
    await adminCall("POST", "/api/accounting/purchase/returns", {
      companyId: company._id,
      financialYearId: fy._id,
      supplierId: supplier._id,
      purchaseBillId: createdBill._id,
      returnNumber: "RET-HTTP-1",
      amountPaise: 500,
      taxAmountPaise: 0,
      reason: "verified test return",
    })
  ).status;
  result.returnDuplicate = (
    await adminCall("POST", "/api/accounting/purchase/returns", {
      companyId: company._id,
      financialYearId: fy._id,
      supplierId: supplier._id,
      purchaseBillId: createdBill._id,
      returnNumber: "RET-HTTP-2",
      amountPaise: 500,
      taxAmountPaise: 0,
      reason: "duplicate test return",
    })
  ).status;
  result.ledger = (
    await adminCall(
      "GET",
      `/api/accounting/purchase/suppliers/${supplier._id}/ledger?financialYearId=${fy._id}`,
    )
  ).status;
  result.reconciliation = (
    await adminCall(
      "GET",
      `/api/accounting/purchase/reconciliation/bills/${createdBill._id}`,
    )
  ).status;
  result.companyIsolation = (
    await adminCall(
      "GET",
      `/api/accounting/purchase/bills?companyId=${new mongoose.Types.ObjectId()}`,
    )
  ).status;
  result.financialYearIsolation = (
    await adminCall("POST", "/api/accounting/purchase/bills", {
      ...billBody,
      financialYearId: new mongoose.Types.ObjectId(),
      internalBillNumber: "PB-HTTP-BAD-FY",
      supplierInvoiceNumber: "SUP-INV-BAD-FY",
    })
  ).status;
  await AccountingPeriod.updateOne(
    { _id: period._id },
    { $set: { status: "locked" } },
  );
  result.lockedPeriod = (
    await adminCall("POST", "/api/accounting/purchase/advances", {
      ...advanceBody,
      idempotencyKey: "http-advance-locked",
    })
  ).status;
  const staffLogin = await login(staff.email);
  result.staffLogin = staffLogin.response.status;
  result.permission = (
    await call(
      staffLogin.cookie,
      "GET",
      `/api/accounting/purchase/bills?companyId=${company._id}`,
    )
  ).status;
  const [
    bill,
    payments,
    advances,
    allocations,
    returns,
    vouchers,
    sources,
    ledger,
  ] = await Promise.all([
    PurchaseBill.findById(createdBill._id).lean(),
    SupplierPayment.find({ companyId: company._id }).lean(),
    SupplierAdvance.find({ companyId: company._id }).lean(),
    SupplierAdvanceAllocation.find({ companyId: company._id }).lean(),
    PurchaseReturn.find({ companyId: company._id }).lean(),
    AccountingVoucher.find({
      companyId: company._id,
      status: { $in: ["posted", "reversed"] },
    }).lean(),
    PurchaseAccountingSource.find({ companyId: company._id }).lean(),
    adminCall(
      "GET",
      `/api/accounting/purchase/suppliers/${supplier._id}/ledger?financialYearId=${fy._id}`,
    ),
  ]);
  const voucherTotals = vouchers.reduce(
    (sum: any, v: any) => ({
      debit: sum.debit + v.totalDebitPaise,
      credit: sum.credit + v.totalCreditPaise,
    }),
    { debit: 0, credit: 0 },
  );
  result.persisted = {
    billStatus: bill?.status,
    settledPaise: bill?.settledPaise,
    paymentCount: payments.length,
    paymentPosted: payments.filter((p: any) => p.status === "posted").length,
    advanceCount: advances.length,
    allocationCount: allocations.length,
    returnCount: returns.length,
    voucherCount: vouchers.length,
    sourceCount: sources.length,
    voucherTotals,
    ledgerStatus: ledger.status,
    ledgerItems: ledger.data?.items?.length,
  };
  console.log(JSON.stringify(result));
  await mongoose.disconnect();
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
