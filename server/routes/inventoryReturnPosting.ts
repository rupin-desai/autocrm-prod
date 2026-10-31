import type { Express, Request } from "express";
import { requireAuth, requirePermission } from "../middleware";
import { getCompanyForUser, ensureFinancialYear } from "./accountingFoundation";
import { PurchaseBill } from "../models/PurchaseBill";
import { Invoice } from "../models/Invoice";
import { PurchaseReturn } from "../models/PurchaseReturn";
import { SalesReturn } from "../models/SalesReturn";
import { InventoryMovement } from "../models/InventoryMovement";
import {
  purchaseReturnInventorySchema,
  salesReturnInventorySchema,
  returnStatusSchema,
} from "../inventoryReturnSchemas";
import {
  postPurchaseReturnInventory,
  postSalesReturnInventory,
} from "../services/inventoryReturns";

type AuthRequest = Request & {
  session: Request["session"] & {
    userId?: string;
    accountingCompanyId?: string;
  };
};
const uid = (req: AuthRequest) => String(req.session.userId);
const errorMessage = (error: any) =>
  error?.issues?.[0]?.message ||
  error?.message ||
  "Inventory return request failed";
async function access(req: AuthRequest, companyId: string, fyId: string) {
  if (!(await getCompanyForUser(req, companyId)))
    throw new Error("You are not authorized for this company");
  if (!(await ensureFinancialYear(req, companyId, fyId)))
    throw new Error("Financial year does not belong to this company");
}

export function registerInventoryReturnPostingRoutes(app: Express) {
  app.post(
    "/api/accounting/inventory/purchase-returns",
    requireAuth,
    requirePermission("inventory", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data: any = purchaseReturnInventorySchema.parse(req.body);
        await access(request, data.companyId, data.financialYearId);
        const bill: any = await PurchaseBill.findOne({
          _id: data.purchaseBillId,
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          supplierId: data.supplierId,
          status: "posted",
        }).lean();
        if (!bill) throw new Error("Posted purchase bill is required");
        if (
          data.amountPaise !==
          data.lines.reduce(
            (sum: number, line: any) => sum + line.returnValuePaise,
            0,
          )
        )
          throw new Error("Return amount must equal return lines");
        for (const line of data.lines) {
          const movement: any = await InventoryMovement.findOne({
            _id: line.originalReceiptMovementId,
            companyId: data.companyId,
            financialYearId: data.financialYearId,
            movementType: "purchase_receipt",
            sourceType: "inventory_operation:purchase_receipt",
            sourceReference: String(bill._id),
            status: "posted",
          }).lean();
          if (
            !movement ||
            String(movement.productId) !== line.productId ||
            String(movement.warehouseId) !== line.warehouseId
          )
            throw new Error(
              "Every return line must link to a posted receipt movement of this bill",
            );
        }
        const existing: any = await PurchaseReturn.findOne({
          companyId: data.companyId,
          idempotencyKey: data.idempotencyKey,
        }).lean();
        if (existing) return res.json(existing);
        const created = await PurchaseReturn.create({
          ...data,
          movementDate: new Date(`${data.movementDate}T00:00:00.000Z`),
          status: "draft",
          createdBy: uid(request),
        });
        res.status(201).json(created);
      } catch (error) {
        res.status(400).json({ error: errorMessage(error) });
      }
    },
  );
  app.post(
    "/api/accounting/inventory/sales-returns",
    requireAuth,
    requirePermission("inventory", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data: any = salesReturnInventorySchema.parse(req.body);
        await access(request, data.companyId, data.financialYearId);
        const invoice: any = await Invoice.findOne({
          _id: data.invoiceId,
          companyId: data.companyId,
          ownershipStatus: "verified",
          status: "approved",
        }).lean();
        if (!invoice) throw new Error("Verified approved invoice is required");
        const existing: any = await SalesReturn.findOne({
          companyId: data.companyId,
          idempotencyKey: data.idempotencyKey,
        }).lean();
        if (existing) return res.json(existing);
        for (const line of data.lines) {
          const movement: any = await InventoryMovement.findOne({
            _id: line.originalSalesIssueMovementId,
            companyId: data.companyId,
            financialYearId: data.financialYearId,
            movementType: "sales_issue",
            sourceType: "inventory_operation:sales_issue",
            sourceReference: String(invoice._id),
            status: "posted",
          }).lean();
          if (
            !movement ||
            String(movement.productId) !== line.productId ||
            String(movement.warehouseId) !== line.warehouseId
          )
            throw new Error(
              "Every return line must link to a posted sales issue movement of this invoice",
            );
        }
        const created = await SalesReturn.create({
          ...data,
          movementDate: new Date(`${data.movementDate}T00:00:00.000Z`),
          status: "draft",
          createdBy: uid(request),
        });
        res.status(201).json(created);
      } catch (error) {
        res.status(400).json({ error: errorMessage(error) });
      }
    },
  );
  app.post(
    "/api/accounting/inventory/returns/:kind/:id/status",
    requireAuth,
    requirePermission("inventory", "approve"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const { status } = returnStatusSchema.parse(req.body);
        const Model: any =
          req.params.kind === "purchase"
            ? PurchaseReturn
            : req.params.kind === "sales"
              ? SalesReturn
              : null;
        if (!Model)
          return res.status(400).json({ error: "Invalid return kind" });
        const item: any = await Model.findById(req.params.id);
        if (
          !item ||
          !(await getCompanyForUser(request, String(item.companyId)))
        )
          return res.status(404).json({ error: "Return not found" });
        if (status === "submitted" && item.status !== "draft")
          throw new Error("Only draft returns can be submitted");
        if (status === "approved" && item.status !== "submitted")
          throw new Error("Only submitted returns can be approved");
        if (
          status === "cancelled" &&
          !["draft", "submitted"].includes(item.status)
        )
          throw new Error("Only unposted returns can be cancelled");
        item.status = status;
        if (status === "approved" && req.params.kind === "sales")
          item.physicalReceiptAuthorizedBy = undefined;
        await item.save();
        res.json(item);
      } catch (error) {
        res.status(400).json({ error: errorMessage(error) });
      }
    },
  );
  app.post(
    "/api/accounting/inventory/sales-returns/:id/physical-receipt",
    requireAuth,
    requirePermission("inventory", "approve"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const item: any = await SalesReturn.findById(req.params.id);
        if (
          !item ||
          !(await getCompanyForUser(request, String(item.companyId)))
        )
          return res.status(404).json({ error: "Sales return not found" });
        if (!["approved"].includes(item.status))
          throw new Error(
            "Sales return must be approved before physical receipt confirmation",
          );
        item.physicalReceiptAuthorizedBy = uid(request);
        item.inventoryLinkStatus = "verified";
        await item.save();
        res.json(item);
      } catch (error) {
        res.status(400).json({ error: errorMessage(error) });
      }
    },
  );
  app.post(
    "/api/accounting/inventory/purchase-returns/:id/post",
    requireAuth,
    requirePermission("inventory", "post"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const item: any = await PurchaseReturn.findById(req.params.id);
        if (
          !item ||
          !(await getCompanyForUser(request, String(item.companyId)))
        )
          return res.status(404).json({ error: "Purchase return not found" });
        res
          .status(201)
          .json(
            await postPurchaseReturnInventory(String(item._id), uid(request)),
          );
      } catch (error) {
        res.status(409).json({ error: errorMessage(error) });
      }
    },
  );
  app.post(
    "/api/accounting/inventory/sales-returns/:id/post",
    requireAuth,
    requirePermission("inventory", "post"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const item: any = await SalesReturn.findById(req.params.id);
        if (
          !item ||
          !(await getCompanyForUser(request, String(item.companyId)))
        )
          return res.status(404).json({ error: "Sales return not found" });
        res
          .status(201)
          .json(await postSalesReturnInventory(String(item._id), uid(request)));
      } catch (error) {
        res.status(409).json({ error: errorMessage(error) });
      }
    },
  );
}
