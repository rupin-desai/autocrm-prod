import type { Express, Request } from "express";
import { requireAuth, requirePermission } from "../middleware";
import { getCompanyForUser, ensureFinancialYear } from "./accountingFoundation";
import { PurchaseBill } from "../models/PurchaseBill";
import { Invoice } from "../models/Invoice";
import { InventoryMovement } from "../models/InventoryMovement";
import { PurchaseReturn } from "../models/PurchaseReturn";
import { SalesReturn } from "../models/SalesReturn";
import { returnEligibilitySchema } from "../inventoryReturnSchemas";

type AuthRequest = Request & {
  session: Request["session"] & {
    accountingCompanyId?: string;
    accountingFinancialYearId?: string;
  };
};
const errorMessage = (error: any) =>
  error?.issues?.[0]?.message ||
  error?.message ||
  "Inventory return request failed";

export function registerInventoryReturnRoutes(app: Express) {
  app.get(
    "/api/accounting/inventory/returns/eligible",
    requireAuth,
    requirePermission("inventory", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data: any = returnEligibilitySchema.parse({
          ...req.query,
          companyId: req.query.companyId || request.session.accountingCompanyId,
          financialYearId:
            req.query.financialYearId ||
            request.session.accountingFinancialYearId,
        });
        if (!(await getCompanyForUser(request, data.companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        if (
          !(await ensureFinancialYear(
            request,
            data.companyId,
            data.financialYearId,
          ))
        )
          return res
            .status(403)
            .json({ error: "Financial year does not belong to this company" });
        if (data.purchaseBillId) {
          const bill: any = await PurchaseBill.findOne({
            _id: data.purchaseBillId,
            companyId: data.companyId,
            financialYearId: data.financialYearId,
            status: "posted",
          }).lean();
          if (!bill)
            return res
              .status(404)
              .json({ error: "Posted purchase bill not found" });
          const movements: any[] = await InventoryMovement.find({
            companyId: data.companyId,
            financialYearId: data.financialYearId,
            movementType: "purchase_receipt",
            sourceType: "inventory_operation:purchase_receipt",
            sourceReference: String(bill._id),
            status: "posted",
          })
            .populate("productId", "productName productId")
            .populate("warehouseId", "warehouseName warehouseCode")
            .lean();
          const returned: any[] = await PurchaseReturn.find({
            companyId: data.companyId,
            purchaseBillId: bill._id,
            status: { $in: ["approved", "posted"] },
          }).lean();
          const returnedByMovement = new Map<string, number>();
          for (const item of returned.flatMap(
            (entry: any) => entry.lines || [],
          ))
            returnedByMovement.set(
              String(item.originalReceiptMovementId),
              (returnedByMovement.get(String(item.originalReceiptMovementId)) ||
                0) + Number(item.returnQuantity || 0),
            );
          res.json({
            source: bill,
            kind: "purchase",
            eligible: movements.map((movement: any) => ({
              movement,
              receivedQuantity: movement.quantityIn,
              returnedQuantity:
                returnedByMovement.get(String(movement._id)) || 0,
              availableQuantity: Math.max(
                0,
                Number(movement.quantityIn) -
                  (returnedByMovement.get(String(movement._id)) || 0),
              ),
            })),
          });
          return;
        }
        const invoice: any = await Invoice.findOne({
          _id: data.invoiceId,
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          ownershipStatus: "verified",
          status: "approved",
        }).lean();
        if (!invoice)
          return res
            .status(404)
            .json({ error: "Verified approved invoice not found" });
        const movements: any[] = await InventoryMovement.find({
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          movementType: "sales_issue",
          sourceType: "inventory_operation:sales_issue",
          sourceReference: String(invoice._id),
          status: "posted",
        })
          .populate("productId", "productName productId")
          .populate("warehouseId", "warehouseName warehouseCode")
          .lean();
        const returned: any[] = await SalesReturn.find({
          companyId: data.companyId,
          invoiceId: invoice._id,
          status: { $in: ["approved", "posted"] },
        }).lean();
        const returnedByMovement = new Map<string, number>();
        for (const item of returned.flatMap((entry: any) => entry.lines || []))
          returnedByMovement.set(
            String(item.originalSalesIssueMovementId),
            (returnedByMovement.get(
              String(item.originalSalesIssueMovementId),
            ) || 0) + Number(item.returnQuantity || 0),
          );
        res.json({
          source: invoice,
          kind: "sales",
          eligible: movements.map((movement: any) => ({
            movement,
            issuedQuantity: movement.quantityOut,
            returnedQuantity: returnedByMovement.get(String(movement._id)) || 0,
            availableQuantity: Math.max(
              0,
              Number(movement.quantityOut) -
                (returnedByMovement.get(String(movement._id)) || 0),
            ),
          })),
        });
      } catch (error) {
        res.status(400).json({ error: errorMessage(error) });
      }
    },
  );
}
