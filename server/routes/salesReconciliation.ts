import type { Express, Request } from "express";
import { requireAuth, requirePermission } from "../middleware";
import { Invoice } from "../models/Invoice";
import { SalesAccountingSource } from "../models/SalesAccountingSource";
import { AdvanceAllocation } from "../models/AdvanceAllocation";
import { getCompanyForUser } from "./accountingFoundation";
import { rupeesToPaise } from "../accountingMoney";

type AuthRequest = Request & {
  session: Request["session"] & {
    userId?: string;
    accountingCompanyId?: string;
  };
};
export function registerSalesReconciliationRoutes(app: Express) {
  app.get(
    "/api/accounting/sales/reconciliation/invoices/:id",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const invoice: any = await Invoice.findById(req.params.id).lean();
        if (
          !invoice ||
          !(await getCompanyForUser(request, String(invoice.companyId)))
        )
          return res.status(404).json({ error: "Invoice not found" });
        const invoiceTotalPaise = rupeesToPaise(
          Number(invoice.totalAmount || 0).toFixed(2),
        );
        const invoiceSource: any = await SalesAccountingSource.findOne({
          companyId: invoice.companyId,
          sourceType: "invoice",
          sourceId: invoice._id,
        })
          .populate(
            "voucherId",
            "voucherNumber status totalDebitPaise totalCreditPaise",
          )
          .lean();
        const paymentIds = (invoice.payments || []).map((p: any) => p._id);
        const receiptSources: any[] = await SalesAccountingSource.find({
          companyId: invoice.companyId,
          sourceType: "invoice_payment",
          sourceId: { $in: paymentIds },
        })
          .populate(
            "voucherId",
            "voucherNumber status totalDebitPaise totalCreditPaise",
          )
          .lean();
        const paymentTotalPaise = Math.round(
          (invoice.payments || []).reduce(
            (sum: number, p: any) => sum + Number(p.amount || 0),
            0,
          ) * 100,
        );
        const allocations: any[] = await AdvanceAllocation.find({
          companyId: invoice.companyId,
          invoiceId: invoice._id,
          status: "confirmed",
        }).lean();
        const allocationTotalPaise = allocations.reduce(
          (sum, a: any) => sum + a.amountPaise,
          0,
        );
        res.json({
          invoiceId: invoice._id,
          invoiceTotalPaise,
          invoiceVoucher: invoiceSource || null,
          crmPaymentTotalPaise: paymentTotalPaise,
          postedReceiptTotalPaise: receiptSources.reduce(
            (sum, s) => sum + (s.amountPaise || 0),
            0,
          ),
          receipts: receiptSources,
          confirmedAdvanceAllocationPaise: allocationTotalPaise,
          allocations,
          mismatches: {
            invoicePostingMissing: !invoiceSource,
            receiptDifferencePaise:
              paymentTotalPaise -
              receiptSources.reduce((sum, s) => sum + (s.amountPaise || 0), 0),
          },
        });
      } catch (e: any) {
        res
          .status(400)
          .json({
            error: e.message || "Failed to reconcile invoice accounting",
          });
      }
    },
  );
}
