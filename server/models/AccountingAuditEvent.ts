import mongoose from "mongoose";

const accountingAuditEventSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    financialYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialYear",
    },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    action: { type: String, required: true },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ipAddress: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: "performedAt", updatedAt: false } },
);

accountingAuditEventSchema.index({ companyId: 1, performedAt: -1 });
accountingAuditEventSchema.index({
  entityType: 1,
  entityId: 1,
  performedAt: -1,
});

export const AccountingAuditEvent =
  mongoose.models.AccountingAuditEvent ||
  mongoose.model("AccountingAuditEvent", accountingAuditEventSchema);
