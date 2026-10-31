import type { Request } from "express";
import mongoose from "mongoose";
import { Company } from "../models/Company";

type OwnershipRequest = Request & {
  session: Request["session"] & {
    userId?: string;
    userRole?: string;
    accountingCompanyId?: string;
  };
};

export async function resolveTrustedOwnership(
  req: OwnershipRequest,
  linkedCompanyIds: Array<string | null | undefined> = [],
) {
  const linked = Array.from(
    new Set(linkedCompanyIds.filter(Boolean).map(String)),
  );
  if (linked.length > 1)
    throw new Error("Linked records belong to conflicting companies");
  const sessionCompanyId = req.session.accountingCompanyId;
  let trusted: any = null;
  if (sessionCompanyId && mongoose.isValidObjectId(sessionCompanyId)) {
    trusted = await Company.findOne({
      _id: sessionCompanyId,
      status: "active",
    }).lean();
    if (trusted && req.session.userRole !== "Admin") {
      const allowed = (trusted.authorizedUserIds || []).map((id: any) =>
        String(id),
      );
      if (allowed.length && !allowed.includes(String(req.session.userId)))
        trusted = null;
    }
  }
  if (trusted && linked.length && String(trusted._id) !== linked[0])
    throw new Error("Linked record does not belong to the selected company");
  if (!trusted && linked.length)
    trusted = await Company.findOne({
      _id: linked[0],
      status: "active",
    }).lean();
  if (!trusted) {
    const active = await Company.find({ status: "active" })
      .select("_id")
      .lean();
    if (active.length === 1) trusted = active[0];
  }
  return trusted
    ? { companyId: trusted._id, ownershipStatus: "verified" as const }
    : { companyId: undefined, ownershipStatus: "unverified" as const };
}

export function ownershipFields(value: {
  companyId?: any;
  ownershipStatus: "verified" | "unverified" | "conflict";
}) {
  return { companyId: value.companyId, ownershipStatus: value.ownershipStatus };
}
