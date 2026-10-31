import type { Express, Request, Response } from "express";
import mongoose from "mongoose";
import { requireAuth, requirePermission } from "../middleware";
import { hasPermission } from "../auth";
import { Company } from "../models/Company";
import { FinancialYear } from "../models/FinancialYear";
import { AccountingPeriod } from "../models/AccountingPeriod";
import { AccountingSettings } from "../models/AccountingSettings";
import { AccountingAuditEvent } from "../models/AccountingAuditEvent";
import {
  accountingSettingsUpdateSchema,
  companyCreateSchema,
  companyUpdateSchema,
  contextSchema,
  dateOnlyValue,
  financialYearCreateSchema,
  financialYearUpdateSchema,
  parseDateOnly,
  periodUpdateSchema,
} from "../accountingSchemas";

type AuthRequest = Request & {
  session: Request["session"] & {
    userId?: string;
    userRole?: string;
    accountingCompanyId?: string;
    accountingFinancialYearId?: string;
  };
};

function userId(req: AuthRequest) {
  return req.session.userId as string;
}

function isAdmin(req: AuthRequest) {
  return req.session.userRole === "Admin";
}

async function audit(
  req: AuthRequest,
  companyId: string,
  entityType: string,
  entityId: string,
  action: string,
  metadata?: unknown,
  financialYearId?: string,
) {
  await AccountingAuditEvent.create({
    companyId,
    financialYearId,
    entityType,
    entityId,
    action,
    performedBy: userId(req),
    ipAddress: req.ip,
    metadata,
  });
}

async function accessibleCompanies(req: AuthRequest) {
  const companies = await Company.find({
    status: { $in: ["active", "inactive"] },
  })
    .sort({ name: 1 })
    .lean();
  if (isAdmin(req)) return companies;
  const assigned = companies.filter((company: any) => {
    const ids = (company.authorizedUserIds || []).map((id: any) => String(id));
    return ids.length === 0 || ids.includes(userId(req));
  });
  if (assigned.length <= 1) return assigned;
  return assigned.filter((company: any) =>
    (company.authorizedUserIds || [])
      .map((id: any) => String(id))
      .includes(userId(req)),
  );
}

export async function getCompanyForUser(req: AuthRequest, companyId: string) {
  if (!mongoose.isValidObjectId(companyId)) return null;
  const company = await Company.findById(companyId);
  if (!company) return null;
  if (isAdmin(req)) return company;
  const authorized = (company.authorizedUserIds || []).map((id: any) =>
    String(id),
  );
  if (authorized.includes(userId(req))) return company;
  const activeCount = await Company.countDocuments({ status: "active" });
  return authorized.length === 0 && activeCount <= 1 ? company : null;
}

export async function ensureFinancialYear(
  req: AuthRequest,
  companyId: string,
  financialYearId: string,
) {
  const company = await getCompanyForUser(req, companyId);
  if (!company) return null;
  if (!mongoose.isValidObjectId(financialYearId)) return null;
  return FinancialYear.findOne({ _id: financialYearId, companyId });
}

function nextPeriodDate(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0));
}

async function createPeriods(companyId: string, financialYear: any) {
  const start = new Date(financialYear.startDate);
  const year = start.getUTCFullYear();
  const documents = Array.from({ length: 12 }, (_, index) => {
    const month = 3 + index;
    const monthYear = year + Math.floor(month / 12);
    const monthIndex = month % 12;
    const periodStart = new Date(Date.UTC(monthYear, monthIndex, 1));
    const periodEnd = nextPeriodDate(monthYear, monthIndex);
    return {
      companyId,
      financialYearId: financialYear._id,
      periodNumber: index + 1,
      label: periodStart.toLocaleString("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      startDate: periodStart,
      endDate: periodEnd,
      status: "open",
    };
  });
  await AccountingPeriod.insertMany(documents, { ordered: true });
}

export function registerAccountingFoundationRoutes(app: Express) {
  app.get(
    "/api/accounting/context",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companies = await accessibleCompanies(request);
        let company = request.session.accountingCompanyId
          ? companies.find(
              (item: any) =>
                String(item._id) === request.session.accountingCompanyId,
            )
          : null;
        company ||=
          companies.find((item: any) => item.status === "active") ||
          companies[0] ||
          null;

        if (!company)
          return res.json({
            company: null,
            financialYear: null,
            companies: [],
            financialYears: [],
          });

        const financialYears = await FinancialYear.find({
          companyId: company._id,
        })
          .sort({ startDate: -1 })
          .lean();
        let financialYear = request.session.accountingFinancialYearId
          ? financialYears.find(
              (item: any) =>
                String(item._id) === request.session.accountingFinancialYearId,
            )
          : null;
        financialYear ||=
          financialYears.find((item: any) => item.status === "active") ||
          financialYears[0] ||
          null;

        request.session.accountingCompanyId = String(company._id);
        request.session.accountingFinancialYearId = financialYear
          ? String(financialYear._id)
          : undefined;
        res.json({ company, financialYear, companies, financialYears });
      } catch (error) {
        res.status(500).json({ error: "Failed to load accounting context" });
      }
    },
  );

  app.post(
    "/api/accounting/context",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data = contextSchema.parse(req.body);
        const company = await getCompanyForUser(request, data.companyId);
        if (!company)
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });

        let financialYear = null;
        if (data.financialYearId) {
          financialYear = await ensureFinancialYear(
            request,
            data.companyId,
            data.financialYearId,
          );
          if (!financialYear)
            return res
              .status(403)
              .json({
                error: "Financial year does not belong to this company",
              });
        }

        request.session.accountingCompanyId = data.companyId;
        request.session.accountingFinancialYearId = financialYear
          ? String(financialYear._id)
          : undefined;
        await audit(
          request,
          data.companyId,
          "AccountingContext",
          company._id.toString(),
          "context_selected",
          { financialYearId: financialYear?._id },
        );
        res.json({ company, financialYear });
      } catch (error: any) {
        res
          .status(400)
          .json({
            error: error?.issues?.[0]?.message || "Invalid accounting context",
          });
      }
    },
  );

  app.get(
    "/api/accounting/companies",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        res.json(await accessibleCompanies(req as AuthRequest));
      } catch {
        res.status(500).json({ error: "Failed to fetch companies" });
      }
    },
  );

  app.post(
    "/api/accounting/companies",
    requireAuth,
    requirePermission("accounting", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data = companyCreateSchema.parse(req.body);
        const company = await Company.create({
          ...data,
          country: "India",
          createdBy: userId(request),
          updatedBy: userId(request),
        });
        await AccountingSettings.create({
          companyId: company._id,
          updatedBy: userId(request),
        });
        await audit(
          request,
          company._id.toString(),
          "Company",
          company._id.toString(),
          "created",
        );
        res.status(201).json(company);
      } catch (error: any) {
        const message =
          error?.code === 11000
            ? "A company with these details already exists"
            : error?.issues?.[0]?.message || "Failed to create company";
        res.status(400).json({ error: message });
      }
    },
  );

  app.get(
    "/api/accounting/companies/:id",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const company = await getCompanyForUser(
          req as AuthRequest,
          req.params.id,
        );
        if (!company)
          return res.status(404).json({ error: "Company not found" });
        res.json(company);
      } catch {
        res.status(500).json({ error: "Failed to fetch company" });
      }
    },
  );

  app.patch(
    "/api/accounting/companies/:id",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const company = await getCompanyForUser(request, req.params.id);
        if (!company)
          return res.status(404).json({ error: "Company not found" });
        const data = companyUpdateSchema.parse(req.body);
        Object.assign(company, data, { updatedBy: userId(request) });
        await company.save();
        await audit(
          request,
          company._id.toString(),
          "Company",
          company._id.toString(),
          "updated",
          data,
        );
        res.json(company);
      } catch (error: any) {
        res
          .status(400)
          .json({
            error: error?.issues?.[0]?.message || "Failed to update company",
          });
      }
    },
  );

  app.get(
    "/api/accounting/financial-years",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId =
          typeof req.query.companyId === "string"
            ? req.query.companyId
            : request.session.accountingCompanyId;
        if (!companyId) return res.json([]);
        if (!(await getCompanyForUser(request, companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        res.json(
          await FinancialYear.find({ companyId })
            .sort({ startDate: -1 })
            .lean(),
        );
      } catch {
        res.status(500).json({ error: "Failed to fetch financial years" });
      }
    },
  );

  app.post(
    "/api/accounting/financial-years",
    requireAuth,
    requirePermission("accounting", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data = financialYearCreateSchema.parse(req.body);
        if (!(await getCompanyForUser(request, data.companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const startDate = parseDateOnly(data.startDate);
        const endDate = parseDateOnly(data.endDate);
        if (
          startDate.getUTCMonth() !== 3 ||
          startDate.getUTCDate() !== 1 ||
          endDate.getUTCMonth() !== 2 ||
          endDate.getUTCDate() !== 31 ||
          endDate <= startDate
        ) {
          return res
            .status(400)
            .json({
              error: "Financial year must run from April 1 to March 31",
            });
        }
        const overlap = await FinancialYear.findOne({
          companyId: data.companyId,
          startDate: { $lte: endDate },
          endDate: { $gte: startDate },
        });
        if (overlap)
          return res
            .status(409)
            .json({
              error: "Financial year overlaps an existing financial year",
            });
        if (data.status === "active")
          await FinancialYear.updateMany(
            { companyId: data.companyId, status: "active" },
            { $set: { status: "inactive", isCurrent: false } },
          );
        const financialYear = await FinancialYear.create({
          ...data,
          startDate,
          endDate,
          isCurrent: data.status === "active",
          createdBy: userId(request),
          updatedBy: userId(request),
        });
        await createPeriods(data.companyId, financialYear);
        await audit(
          request,
          data.companyId,
          "FinancialYear",
          financialYear._id.toString(),
          "created",
        );
        res.status(201).json(financialYear);
      } catch (error: any) {
        const message =
          error?.code === 11000
            ? "Financial year already exists"
            : error?.issues?.[0]?.message || "Failed to create financial year";
        res.status(400).json({ error: message });
      }
    },
  );

  app.patch(
    "/api/accounting/financial-years/:id",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const financialYear = await FinancialYear.findById(req.params.id);
        if (
          !financialYear ||
          !(await getCompanyForUser(
            request,
            financialYear.companyId.toString(),
          ))
        )
          return res.status(404).json({ error: "Financial year not found" });
        const data = financialYearUpdateSchema.parse(req.body);
        if (
          data.status === "closed" &&
          !hasPermission(request.session.userRole || "", "accounting", "close")
        )
          return res
            .status(403)
            .json({ error: "You are not authorized to close financial years" });
        if (
          financialYear.status === "closed" &&
          data.status !== "closed" &&
          !hasPermission(request.session.userRole || "", "accounting", "unlock")
        )
          return res
            .status(403)
            .json({
              error:
                "Closed financial years require an authorized unlock permission",
            });
        if (data.status === "active")
          await FinancialYear.updateMany(
            {
              companyId: financialYear.companyId,
              _id: { $ne: financialYear._id },
              status: "active",
            },
            { $set: { status: "inactive", isCurrent: false } },
          );
        Object.assign(financialYear, data, {
          isCurrent: data.status === "active",
          updatedBy: userId(request),
        });
        if (data.status === "closed") {
          financialYear.closedAt = new Date();
          financialYear.closedBy = userId(request) as any;
        }
        await financialYear.save();
        await audit(
          request,
          financialYear.companyId.toString(),
          "FinancialYear",
          financialYear._id.toString(),
          "updated",
          data,
        );
        res.json(financialYear);
      } catch (error: any) {
        res
          .status(400)
          .json({
            error:
              error?.issues?.[0]?.message || "Failed to update financial year",
          });
      }
    },
  );

  app.get(
    "/api/accounting/financial-years/:id/periods",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const financialYear = await FinancialYear.findById(req.params.id);
        if (
          !financialYear ||
          !(await getCompanyForUser(
            request,
            financialYear.companyId.toString(),
          ))
        )
          return res.status(404).json({ error: "Financial year not found" });
        res.json(
          await AccountingPeriod.find({ financialYearId: financialYear._id })
            .sort({ periodNumber: 1 })
            .lean(),
        );
      } catch {
        res.status(500).json({ error: "Failed to fetch accounting periods" });
      }
    },
  );

  app.post(
    "/api/accounting/financial-years/:id/periods",
    requireAuth,
    requirePermission("accounting", "create"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const financialYear = await FinancialYear.findById(req.params.id);
        if (
          !financialYear ||
          !(await getCompanyForUser(
            request,
            financialYear.companyId.toString(),
          ))
        )
          return res.status(404).json({ error: "Financial year not found" });
        const existing = await AccountingPeriod.countDocuments({
          financialYearId: financialYear._id,
        });
        if (existing > 0)
          return res
            .status(409)
            .json({
              error: "Accounting periods already exist for this financial year",
            });
        await createPeriods(financialYear.companyId.toString(), financialYear);
        res
          .status(201)
          .json(
            await AccountingPeriod.find({ financialYearId: financialYear._id })
              .sort({ periodNumber: 1 })
              .lean(),
          );
      } catch {
        res.status(400).json({ error: "Failed to create accounting periods" });
      }
    },
  );

  app.patch(
    "/api/accounting/periods/:id",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data = periodUpdateSchema.parse(req.body);
        const period = await AccountingPeriod.findById(req.params.id);
        if (
          !period ||
          !(await getCompanyForUser(request, period.companyId.toString()))
        )
          return res.status(404).json({ error: "Accounting period not found" });
        if (
          data.status === "open" &&
          !hasPermission(request.session.userRole || "", "accounting", "unlock")
        )
          return res
            .status(403)
            .json({
              error: "You are not authorized to unlock accounting periods",
            });
        period.status = data.status;
        if (data.status === "closed") {
          period.closedAt = new Date();
          period.closedBy = userId(request) as any;
        }
        if (data.status === "locked") {
          period.lockedAt = new Date();
          period.lockedBy = userId(request) as any;
        }
        await period.save();
        await audit(
          request,
          period.companyId.toString(),
          "AccountingPeriod",
          period._id.toString(),
          `status_${data.status}`,
          { status: data.status },
          period.financialYearId.toString(),
        );
        res.json(period);
      } catch (error: any) {
        res
          .status(400)
          .json({
            error:
              error?.issues?.[0]?.message ||
              "Failed to update accounting period",
          });
      }
    },
  );

  app.get(
    "/api/accounting/settings",
    requireAuth,
    requirePermission("accounting", "read"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const companyId =
          typeof req.query.companyId === "string"
            ? req.query.companyId
            : request.session.accountingCompanyId;
        if (!companyId || !(await getCompanyForUser(request, companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const settings = await AccountingSettings.findOneAndUpdate(
          { companyId },
          { $setOnInsert: { companyId } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        ).lean();
        res.json(settings);
      } catch {
        res.status(500).json({ error: "Failed to fetch accounting settings" });
      }
    },
  );

  app.patch(
    "/api/accounting/settings",
    requireAuth,
    requirePermission("accounting", "update"),
    async (req, res) => {
      try {
        const request = req as AuthRequest;
        const data = accountingSettingsUpdateSchema.parse(req.body);
        const companyId =
          typeof req.query.companyId === "string"
            ? req.query.companyId
            : request.session.accountingCompanyId;
        if (!companyId || !(await getCompanyForUser(request, companyId)))
          return res
            .status(403)
            .json({ error: "You are not authorized for this company" });
        const settings = await AccountingSettings.findOneAndUpdate(
          { companyId },
          {
            $set: {
              ...data,
              updatedBy: userId(request),
              currencyCode: "INR",
              currencyMinorUnit: 2,
              country: "India",
              financialYearStartMonth: 4,
              financialYearStartDay: 1,
              financialYearEndMonth: 3,
              financialYearEndDay: 31,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        await audit(
          request,
          companyId,
          "AccountingSettings",
          settings._id.toString(),
          "updated",
          data,
        );
        res.json(settings);
      } catch (error: any) {
        res
          .status(400)
          .json({
            error:
              error?.issues?.[0]?.message ||
              "Failed to update accounting settings",
          });
      }
    },
  );
}
