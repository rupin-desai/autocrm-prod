import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userRole?: string;
    userName?: string;
    userEmail?: string;
    accountingCompanyId?: string;
    accountingFinancialYearId?: string;
  }
}
