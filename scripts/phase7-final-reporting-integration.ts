import mongoose from "mongoose";
import { Company } from "../server/models/Company";
import { FinancialYear } from "../server/models/FinancialYear";
import {
  trialBalance,
  profitLoss,
  balanceSheet,
  cashFlow,
  generalLedger,
  dayBook,
  gstSummary,
} from "../server/accountingReports";
import {
  receivablesReport,
  payablesReport,
  historicalInventoryValuation,
} from "../server/reportingSourceReports";
const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const company: any = await Company.findOne({ name: "6G Return Test" }).lean();
  const fy: any = await FinancialYear.findOne({
    companyId: company._id,
  }).lean();
  const query: any = {
    companyId: String(company._id),
    financialYearId: String(fy._id),
    fromDate: "2026-04-01",
    toDate: "2026-10-31",
    asOfDate: "2026-10-31",
    page: 1,
    limit: 100,
  };
  const [tb, pl, bs, cf, gl, db, ar, ap, inv, gst]: any[] = await Promise.all([
    trialBalance(query),
    profitLoss(query),
    balanceSheet(query),
    cashFlow(query),
    generalLedger(query),
    dayBook(query),
    receivablesReport(query),
    payablesReport(query),
    historicalInventoryValuation(query),
    gstSummary(query),
  ]);
  console.log(
    JSON.stringify({
      trialBalanced: tb.balanced,
      trialDifference: tb.differencePaise,
      profit: pl.netProfitPaise,
      balanceSheetBalanced: bs.balanced,
      balanceSheetDifference: bs.differencePaise,
      cashClosing: cf.closingCashPaise,
      generalLedgerRows: gl.total,
      dayBookRows: db.total,
      receivableRows: ar.rows.length,
      receivableOutstanding: ar.totals.outstandingPaise,
      payableRows: ap.rows.length,
      payableOutstanding: ap.totals.outstandingPaise,
      inventoryValue: inv.totalInventoryValuePaise,
      inventoryRows: inv.rows.length,
      gstRows: gst.rows.length,
      gstLimitation: Boolean(gst.limitation),
    }),
  );
  await mongoose.disconnect();
};
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
