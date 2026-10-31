import type { Express, Request } from "express";
import mongoose from "mongoose";
import { requireAuth, requirePermission } from "../middleware";
import { hasPermission } from "../auth";
import { AccountGroup } from "../models/AccountGroup";
import { LedgerAccount } from "../models/LedgerAccount";
import { OpeningBalance } from "../models/OpeningBalance";
import { FinancialYear } from "../models/FinancialYear";
import { AccountingAuditEvent } from "../models/AccountingAuditEvent";
import { getCompanyForUser, ensureFinancialYear } from "./accountingFoundation";
import {
  validateHierarchyParent,
  validateOpeningBalanceAmounts,
  summarizeOpeningBalances,
} from "../accountingLogic";
import {
  accountGroupCreateSchema,
  accountGroupUpdateSchema,
  ledgerCreateSchema,
  ledgerQuerySchema,
  ledgerUpdateSchema,
  openingBalanceSchema,
  openingBalanceFinalizeSchema,
} from "../accountingLedgerSchemas";

type AuthRequest = Request & {
  session: Request["session"] & {
    userId?: string;
    userRole?: string;
    accountingCompanyId?: string;
    accountingFinancialYearId?: string;
  };
};

const DEFAULT_GROUPS = [
  {
    code: "EQ",
    name: "Capital Account",
    rootCategory: "equity",
    normalBalance: "credit",
  },
  {
    code: "FA",
    name: "Fixed Assets",
    rootCategory: "assets",
    normalBalance: "debit",
  },
  {
    code: "CA",
    name: "Current Assets",
    rootCategory: "assets",
    normalBalance: "debit",
  },
  {
    code: "BA",
    name: "Bank Accounts",
    parentCode: "CA",
    rootCategory: "assets",
    normalBalance: "debit",
  },
  {
    code: "CASH",
    name: "Cash-in-Hand",
    parentCode: "CA",
    rootCategory: "assets",
    normalBalance: "debit",
  },
  {
    code: "SD",
    name: "Sundry Debtors",
    parentCode: "CA",
    rootCategory: "assets",
    normalBalance: "debit",
  },
  {
    code: "LL",
    name: "Loans and Liabilities",
    rootCategory: "liabilities",
    normalBalance: "credit",
  },
  {
    code: "SC",
    name: "Sundry Creditors",
    parentCode: "LL",
    rootCategory: "liabilities",
    normalBalance: "credit",
  },
  {
    code: "SA",
    name: "Sales Accounts",
    rootCategory: "income",
    normalBalance: "credit",
  },
  {
    code: "PA",
    name: "Purchase Accounts",
    rootCategory: "expenses",
    normalBalance: "debit",
  },
  {
    code: "DE",
    name: "Direct Expenses",
    rootCategory: "expenses",
    normalBalance: "debit",
  },
  {
    code: "IE",
    name: "Indirect Expenses",
    rootCategory: "expenses",
    normalBalance: "debit",
  },
  {
    code: "DI",
    name: "Direct Income",
    rootCategory: "income",
    normalBalance: "credit",
  },
  {
    code: "II",
    name: "Indirect Income",
    rootCategory: "income",
    normalBalance: "credit",
  },
  {
    code: "DUTY",
    name: "Duties & Taxes",
    rootCategory: "liabilities",
    normalBalance: "credit",
  },
];

function currentUserId(req: AuthRequest) {
  return req.session.userId as string;
}
function audit(
  req: AuthRequest,
  companyId: string,
  entityType: string,
  entityId: string,
  action: string,
  metadata?: unknown,
  financialYearId?: string,
) {
  return AccountingAuditEvent.create({
    companyId,
    financialYearId,
    entityType,
    entityId,
    action,
    performedBy: currentUserId(req),
    ipAddress: req.ip,
    metadata,
  });
}

async function resolveCompany(req: AuthRequest, requested?: string) {
  const companyId = requested || req.session.accountingCompanyId;
  return companyId ? getCompanyForUser(req, companyId) : null;
}

async function resolveFinancialYear(
  req: AuthRequest,
  companyId: string,
  requested?: string,
) {
  const financialYearId = requested || req.session.accountingFinancialYearId;
  if (financialYearId)
    return ensureFinancialYear(req, companyId, financialYearId);
  return FinancialYear.findOne({ companyId, status: "active" }).sort({
    startDate: -1,
  });
}

async function validateParent(
  companyId: string,
  groupId: string | null | undefined,
  parentGroupId: string | null | undefined,
) {
  if (!parentGroupId) return null;
  const parent = await AccountGroup.findOne({ _id: parentGroupId, companyId });
  if (!parent) return "Parent account group not found in this company";
  if (groupId && groupId === parentGroupId)
    return "A group cannot be its own parent";
  if (parent.status !== "active") return "Parent account group is inactive";
  const groups = await AccountGroup.find({ companyId })
    .select("_id parentGroupId")
    .lean();
  const parents = new Map(
    groups.map((group: any) => [
      String(group._id),
      group.parentGroupId ? String(group.parentGroupId) : null,
    ]),
  );
  const result = validateHierarchyParent(
    groupId || null,
    parentGroupId,
    parents,
  );
  return result.valid ? null : result.error;
}

async function validateLedgerReferences(
  companyId: string,
  groupId: string,
  data: any,
) {
  const group = await AccountGroup.findOne({ _id: groupId, companyId });
  if (!group) return { error: "Account group not found in this company" };
  if (group.status !== "active")
    return { error: "Cannot create a ledger under an inactive account group" };
  if (data.ledgerType === "customer" && !data.customerId)
    return { error: "Customer control ledgers require a customer reference" };
  if (data.ledgerType === "supplier" && !data.supplierId)
    return { error: "Supplier control ledgers require a supplier reference" };
  if (data.ledgerType !== "customer" && data.customerId)
    return { error: "Customer reference is only valid for customer ledgers" };
  if (data.ledgerType !== "supplier" && data.supplierId)
    return { error: "Supplier reference is only valid for supplier ledgers" };
  const balance = validateOpeningBalanceAmounts(
    data.openingBalanceType === "debit" ? data.openingBalancePaise : 0,
    data.openingBalanceType === "credit" ? data.openingBalancePaise : 0,
  );
  if (!balance.valid) return { error: balance.error };
  return { group };
}

async function syncOpeningBalance(
  req: AuthRequest,
  companyId: string,
  financialYearId: string | undefined,
  ledger: any,
  data: any,
) {
  if (!financialYearId) return;
  if (
    data.openingBalancePaise === undefined &&
    data.openingBalanceType === undefined
  )
    return;
  const debitPaise =
    data.openingBalanceType === "debit"
      ? Number(data.openingBalancePaise || 0)
      : 0;
  const creditPaise =
    data.openingBalanceType === "credit"
      ? Number(data.openingBalancePaise || 0)
      : 0;
  await OpeningBalance.findOneAndUpdate(
    { companyId, financialYearId, ledgerAccountId: ledger._id },
    {
      $set: {
        debitPaise,
        creditPaise,
        source: "manual",
        updatedBy: currentUserId(req),
      },
      $setOnInsert: { createdBy: currentUserId(req), status: "draft" },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export function registerAccountingLedgerRoutes(app: Express) {
  app.get(
    "/api/accounting/account-groups",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const company = await resolveCompany(
          request,
          typeof req.query.companyId === "string"
            ? req.query.companyId
            : undefined,
        );
        if (!company)
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const groups = await AccountGroup.find({ companyId: company._id })
          .sort({ code: 1 })
          .lean();
        res.json(groups);
      } catch {
        res.status(500).json({ error: "Failed to fetch account groups" });
      }
    },
  );

  app.post(
    "/api/accounting/account-groups/defaults",
    requireAuth,
    requirePermission("accounting", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const company = await resolveCompany(
          request,
          typeof req.body.companyId === "string"
            ? req.body.companyId
            : undefined,
        );
        if (!company)
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const existing = await AccountGroup.find({
          companyId: company._id,
        }).lean();
        const byCode = new Map(
          existing.map((group: any) => [group.code, group]),
        );
        const created: any[] = [];
        for (const definition of DEFAULT_GROUPS) {
          if (byCode.has(definition.code)) continue;
          const parent = definition.parentCode
            ? byCode.get(definition.parentCode)
            : null;
          if (definition.parentCode && !parent) continue;
          const group = await AccountGroup.create({
            ...definition,
            parentGroupId: parent?._id || null,
            companyId: company._id,
            isSystemGroup: true,
            createdBy: currentUserId(request),
            updatedBy: currentUserId(request),
          });
          byCode.set(group.code, group);
          created.push(group);
        }
        await audit(
          request,
          company._id.toString(),
          "AccountGroup",
          company._id.toString(),
          "default_groups_initialized",
          { createdCount: created.length },
        );
        res
          .status(201)
          .json({
            createdCount: created.length,
            groups: await AccountGroup.find({ companyId: company._id })
              .sort({ code: 1 })
              .lean(),
          });
      } catch (error: any) {
        res
          .status(400)
          .json({
            error:
              error?.code === 11000
                ? "A default account group already exists"
                : "Failed to initialize default account groups",
          });
      }
    },
  );

  app.get(
    "/api/accounting/account-groups/:id",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const group: any = await AccountGroup.findById(req.params.id).lean();
        if (
          !group ||
          !(await getCompanyForUser(request, group.companyId.toString()))
        )
          return res.status(404).json({ error: "Account group not found" });
        res.json(group);
      } catch {
        res.status(500).json({ error: "Failed to fetch account group" });
      }
    },
  );

  app.post(
    "/api/accounting/account-groups",
    requireAuth,
    requirePermission("accounting", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data = accountGroupCreateSchema.parse(req.body);
        if (!(await getCompanyForUser(request, data.companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const parentError = await validateParent(
          data.companyId,
          null,
          data.parentGroupId,
        );
        if (parentError) return res.status(400).json({ error: parentError });
        if (data.parentGroupId) {
          const parent = await AccountGroup.findById(data.parentGroupId);
          if (
            parent &&
            (parent.rootCategory !== data.rootCategory ||
              parent.normalBalance !== data.normalBalance)
          )
            return res
              .status(400)
              .json({
                error: "Child group classification must match its parent group",
              });
        }
        const group = await AccountGroup.create({
          ...data,
          code: data.code.toUpperCase(),
          createdBy: currentUserId(request),
          updatedBy: currentUserId(request),
        });
        await audit(
          request,
          data.companyId,
          "AccountGroup",
          group._id.toString(),
          "created",
        );
        res.status(201).json(group);
      } catch (error: any) {
        res
          .status(error?.code === 11000 ? 409 : 400)
          .json({
            error:
              error?.code === 11000
                ? "Account group code already exists in this company"
                : error?.issues?.[0]?.message ||
                  "Failed to create account group",
          });
      }
    },
  );

  app.patch(
    "/api/accounting/account-groups/:id",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const group = await AccountGroup.findById(req.params.id);
        if (
          !group ||
          !(await getCompanyForUser(request, group.companyId.toString()))
        )
          return res.status(404).json({ error: "Account group not found" });
        const data = accountGroupUpdateSchema.parse(req.body);
        if (
          group.isSystemGroup &&
          (data.name || data.code || data.rootCategory || data.normalBalance)
        )
          return res
            .status(400)
            .json({ error: "Predefined group identity cannot be changed" });
        if (data.parentGroupId !== undefined) {
          const parentError = await validateParent(
            group.companyId.toString(),
            group._id.toString(),
            data.parentGroupId,
          );
          if (parentError) return res.status(400).json({ error: parentError });
          if (data.parentGroupId) {
            const parent = await AccountGroup.findById(data.parentGroupId);
            if (
              parent &&
              (parent.rootCategory !== group.rootCategory ||
                parent.normalBalance !== group.normalBalance)
            )
              return res
                .status(400)
                .json({
                  error:
                    "Child group classification must match its parent group",
                });
          }
        }
        Object.assign(group, data, {
          code: data.code ? data.code.toUpperCase() : group.code,
          updatedBy: currentUserId(request),
        });
        await group.save();
        await audit(
          request,
          group.companyId.toString(),
          "AccountGroup",
          group._id.toString(),
          "updated",
          data,
        );
        res.json(group);
      } catch (error: any) {
        res
          .status(error?.code === 11000 ? 409 : 400)
          .json({
            error:
              error?.code === 11000
                ? "Account group code already exists in this company"
                : error?.issues?.[0]?.message ||
                  "Failed to update account group",
          });
      }
    },
  );

  app.get(
    "/api/accounting/ledgers",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const query = ledgerQuerySchema.parse(req.query);
        const company = await resolveCompany(request, query.companyId);
        if (!company)
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const filter: any = { companyId: company._id };
        if (query.groupId) filter.groupId = query.groupId;
        if (query.ledgerType) filter.ledgerType = query.ledgerType;
        if (query.status) filter.status = query.status;
        if (query.search) {
          const safe = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          filter.$or = [
            { name: new RegExp(safe, "i") },
            { code: new RegExp(safe, "i") },
          ];
        }
        const skip = (query.page - 1) * query.limit;
        const [items, total] = await Promise.all([
          LedgerAccount.find(filter)
            .populate("groupId", "name code rootCategory normalBalance")
            .sort({ code: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
          LedgerAccount.countDocuments(filter),
        ]);
        res.json({
          items,
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        });
      } catch (error: any) {
        res
          .status(400)
          .json({
            error: error?.issues?.[0]?.message || "Failed to fetch ledgers",
          });
      }
    },
  );

  app.get(
    "/api/accounting/ledgers/:id",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const ledger = await LedgerAccount.findById(req.params.id).populate(
          "groupId",
        );
        if (
          !ledger ||
          !(await getCompanyForUser(request, ledger.companyId.toString()))
        )
          return res.status(404).json({ error: "Ledger account not found" });
        res.json(ledger);
      } catch {
        res.status(500).json({ error: "Failed to fetch ledger account" });
      }
    },
  );

  app.post(
    "/api/accounting/ledgers",
    requireAuth,
    requirePermission("accounting", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data = ledgerCreateSchema.parse(req.body);
        if (!(await getCompanyForUser(request, data.companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const validation = await validateLedgerReferences(
          data.companyId,
          data.groupId,
          data,
        );
        if (validation.error)
          return res.status(400).json({ error: validation.error });
        const financialYear = await resolveFinancialYear(
          request,
          data.companyId,
          data.financialYearId || undefined,
        );
        if (data.openingBalancePaise > 0 && !financialYear)
          return res
            .status(400)
            .json({ error: "Select a financial year for the opening balance" });
        const ledger = await LedgerAccount.create({
          ...data,
          code: data.code.toUpperCase(),
          createdBy: currentUserId(request),
          updatedBy: currentUserId(request),
        });
        await syncOpeningBalance(
          request,
          data.companyId,
          financialYear?._id?.toString(),
          ledger,
          data,
        );
        await audit(
          request,
          data.companyId,
          "LedgerAccount",
          ledger._id.toString(),
          "created",
          { code: ledger.code },
          financialYear?._id?.toString(),
        );
        res
          .status(201)
          .json(
            await LedgerAccount.findById(ledger._id).populate(
              "groupId",
              "name code rootCategory normalBalance",
            ),
          );
      } catch (error: any) {
        res
          .status(error?.code === 11000 ? 409 : 400)
          .json({
            error:
              error?.code === 11000
                ? "Ledger code already exists in this company"
                : error?.issues?.[0]?.message ||
                  "Failed to create ledger account",
          });
      }
    },
  );

  app.patch(
    "/api/accounting/ledgers/:id",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const ledger = await LedgerAccount.findById(req.params.id);
        if (
          !ledger ||
          !(await getCompanyForUser(request, ledger.companyId.toString()))
        )
          return res.status(404).json({ error: "Ledger account not found" });
        const data = ledgerUpdateSchema.parse(req.body);
        const next = { ...ledger.toObject(), ...data };
        const validation = await validateLedgerReferences(
          ledger.companyId.toString(),
          String(next.groupId),
          next,
        );
        if (validation.error)
          return res.status(400).json({ error: validation.error });
        const financialYear = await resolveFinancialYear(
          request,
          ledger.companyId.toString(),
          data.financialYearId || undefined,
        );
        Object.assign(ledger, data, {
          code: data.code ? data.code.toUpperCase() : ledger.code,
          updatedBy: currentUserId(request),
        });
        await ledger.save();
        await syncOpeningBalance(
          request,
          ledger.companyId.toString(),
          financialYear?._id?.toString(),
          ledger,
          data,
        );
        await audit(
          request,
          ledger.companyId.toString(),
          "LedgerAccount",
          ledger._id.toString(),
          "updated",
          data,
          financialYear?._id?.toString(),
        );
        res.json(
          await LedgerAccount.findById(ledger._id).populate(
            "groupId",
            "name code rootCategory normalBalance",
          ),
        );
      } catch (error: any) {
        res
          .status(error?.code === 11000 ? 409 : 400)
          .json({
            error:
              error?.code === 11000
                ? "Ledger code already exists in this company"
                : error?.issues?.[0]?.message ||
                  "Failed to update ledger account",
          });
      }
    },
  );

  app.get(
    "/api/accounting/opening-balances",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const company = await resolveCompany(
          request,
          typeof req.query.companyId === "string"
            ? req.query.companyId
            : undefined,
        );
        if (!company)
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const financialYear = await resolveFinancialYear(
          request,
          company._id.toString(),
          typeof req.query.financialYearId === "string"
            ? req.query.financialYearId
            : undefined,
        );
        if (!financialYear)
          return res
            .status(400)
            .json({ error: "Select a financial year first" });
        const ledgers = await LedgerAccount.find({
          companyId: company._id,
          status: "active",
        })
          .populate("groupId", "name code")
          .sort({ code: 1 })
          .lean();
        const balances: any[] = (await OpeningBalance.find({
          companyId: company._id,
          financialYearId: financialYear._id,
        }).lean()) as any;
        const byLedger = new Map(
          balances.map((item: any) => [String(item.ledgerAccountId), item]),
        );
        const items = ledgers.map((ledger: any) => ({
          ...ledger,
          openingBalance: byLedger.get(String(ledger._id)) || {
            debitPaise: 0,
            creditPaise: 0,
            status: "draft",
          },
        }));
        const summary = summarizeOpeningBalances(balances);
        res.json({ financialYear, items, summary });
      } catch {
        res.status(500).json({ error: "Failed to fetch opening balances" });
      }
    },
  );

  app.post(
    "/api/accounting/opening-balances",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data = openingBalanceSchema.parse(req.body);
        if (!(await getCompanyForUser(request, data.companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const financialYear = await ensureFinancialYear(
          request,
          data.companyId,
          data.financialYearId,
        );
        if (!financialYear)
          return res
            .status(403)
            .json({ error: "Financial year does not belong to this company" });
        if (financialYear.status === "closed")
          return res
            .status(400)
            .json({
              error:
                "Cannot update opening balances in a closed financial year",
            });
        const validation = validateOpeningBalanceAmounts(
          data.debitPaise,
          data.creditPaise,
        );
        if (!validation.valid)
          return res.status(400).json({ error: validation.error });
        const ledger = await LedgerAccount.findOne({
          _id: data.ledgerAccountId,
          companyId: data.companyId,
          status: "active",
        });
        if (!ledger)
          return res
            .status(404)
            .json({ error: "Active ledger account not found in this company" });
        const existingBalance: any = await OpeningBalance.findOne({
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          ledgerAccountId: data.ledgerAccountId,
        });
        if (existingBalance?.status === "finalized")
          return res
            .status(409)
            .json({ error: "Finalized opening balances cannot be edited" });
        const balance = await OpeningBalance.findOneAndUpdate(
          {
            companyId: data.companyId,
            financialYearId: data.financialYearId,
            ledgerAccountId: data.ledgerAccountId,
          },
          {
            $set: {
              debitPaise: data.debitPaise,
              creditPaise: data.creditPaise,
              source: data.source,
              updatedBy: currentUserId(request),
            },
            $setOnInsert: {
              createdBy: currentUserId(request),
              status: "draft",
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        ledger.openingBalancePaise = data.debitPaise || data.creditPaise;
        ledger.openingBalanceType =
          data.debitPaise > 0
            ? "debit"
            : data.creditPaise > 0
              ? "credit"
              : "none";
        ledger.updatedBy = currentUserId(request) as any;
        await ledger.save();
        await audit(
          request,
          data.companyId,
          "OpeningBalance",
          balance._id.toString(),
          "updated",
          data,
          data.financialYearId,
        );
        res.json(balance);
      } catch (error: any) {
        res
          .status(400)
          .json({
            error:
              error?.issues?.[0]?.message || "Failed to save opening balance",
          });
      }
    },
  );

  app.post(
    "/api/accounting/opening-balances/finalize",
    requireAuth,
    requirePermission("accounting", "close"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data = openingBalanceFinalizeSchema.parse(req.body);
        if (!(await getCompanyForUser(request, data.companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const financialYear = await ensureFinancialYear(
          request,
          data.companyId,
          data.financialYearId,
        );
        if (!financialYear || financialYear.status === "closed")
          return res
            .status(400)
            .json({ error: "Financial year is unavailable for finalization" });
        const balances: any[] = await OpeningBalance.find({
          companyId: data.companyId,
          financialYearId: data.financialYearId,
        }).lean();
        const summary = summarizeOpeningBalances(balances);
        if (!summary.balanced)
          return res
            .status(400)
            .json({
              error: "Opening balances must be balanced before finalization",
              summary,
            });
        if (balances.some((item: any) => item.status === "finalized"))
          return res
            .status(409)
            .json({ error: "Opening balances are already finalized" });
        const result = await OpeningBalance.updateMany(
          {
            companyId: data.companyId,
            financialYearId: data.financialYearId,
            status: "draft",
          },
          { $set: { status: "finalized", updatedBy: currentUserId(request) } },
        );
        await audit(
          request,
          data.companyId,
          "OpeningBalance",
          data.financialYearId,
          "finalized",
          { count: result.modifiedCount, summary },
          data.financialYearId,
        );
        res.json({ finalizedCount: result.modifiedCount, summary });
      } catch (error: any) {
        res
          .status(400)
          .json({
            error:
              error?.issues?.[0]?.message ||
              error?.message ||
              "Failed to finalize opening balances",
          });
      }
    },
  );
}
