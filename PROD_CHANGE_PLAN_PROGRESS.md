# Production Change Plan And Progress

Last updated: 2026-03-01 (IST)
Source request timestamp: 2026-02-26 5:01 PM (IST)

## Request Summary

1. Inventory me same name ka product add nahi hona chahiye.
2. Bill me HSN number and GST rate alag details me show hona chahiye.
3. Manager role access update: Manager should NOT be able to delete stock item or invoice.
4. "Parts needed for service/replacement" option me products show nahi ho rahe.
5. If compatibility is marked as `Other`, item should be treated as universal (shown across brands/models as per final rule).

## Current Status

- [x] Codebase mapping complete
- [x] Root cause analysis complete
- [x] Implementation started
- [ ] Testing complete
- [ ] Ready for production deploy

## Detailed Plan

### 1) Prevent duplicate product creation

Status: `Pending`

Action items:
- Add duplicate check in product create API (`POST /api/products`) using normalized product key.
- Add duplicate check in product update API (`PATCH /api/products/:id`) excluding current ID.
- Add duplicate handling in product import API (`POST /api/products/import`) to skip/report duplicates.
- Add DB index-level protection in Product model for safety.

Primary files:
- `server/routes.ts`
- `server/models/Product.ts`

Acceptance:
- Creating same logical item twice returns a clear error.
- Import reports duplicate rows instead of silently creating.

---

### 2) Show HSN + GST rate separately in invoice PDF

Status: `Pending`

Action items:
- Ensure invoice item schema stores `gstPercentage` consistently.
- Keep `hsnNumber` resolution stable for all PDF generation paths.
- Update PDF table to explicitly show:
  - HSN
  - GST Rate (%)
  - GST Amount
  - Base/Unit amount and line total

Primary files:
- `server/models/Invoice.ts`
- `server/routes.ts`
- `server/utils/generateInvoicePDF.ts`
- `server/utils/invoiceNotifications.ts`

Acceptance:
- Approved/downloaded/public invoice PDF shows HSN and GST rate as separate visible fields.

---

### 3) Manager access update (no delete stock item/invoice)

Status: `Pending`

Action items:
- Remove `delete` permission for Manager in:
  - `products`
  - `invoices`
- Verify backend routes deny Manager for delete endpoints.
- Hide/remove delete action buttons in UI when permission is absent.

Primary files:
- `server/auth.ts`
- `client/src/pages/Products.tsx`
- `client/src/pages/Invoices.tsx` (already mostly Admin-only; verify consistency)

Acceptance:
- Manager cannot delete products.
- Manager cannot delete invoices.
- Admin delete flow remains unchanged.

---

### 4) Fix products not showing in "Parts Needed for Service/Replacement"

Status: `Pending`

Likely root cause:
- Compatibility matching is currently too strict (`Brand - Model` exact match), so valid products are filtered out.

Action items:
- Relax/normalize compatibility matching logic for standard and custom model cases.
- Ensure product compatibility values are saved in consistent format from product form.
- Keep search/filter UX unchanged unless needed for correctness.

Primary files:
- `client/src/pages/CustomerRegistration.tsx`
- `client/src/pages/Products.tsx`

Acceptance:
- Selecting brand/model in customer registration reliably shows compatible products.
- "No compatible products" appears only when truly none exist.

---

### 5) Define universal behavior for `Other` compatibility

Status: `Pending`

Action items:
- Confirm business rule:
  - `Other` means universal across all brands/models, OR
  - `Brand - Other` means all models within that brand.
- Standardize `modelCompatibility` value format for all `Other` entries.
- Update Step 3 matching rules to explicitly include agreed `Other` behavior.
- Validate with sample products under Mahindra/Suzuki and custom models.

Primary files:
- `client/src/pages/Products.tsx`
- `client/src/pages/CustomerRegistration.tsx`
- `server/routes.ts` (if normalization is done server-side)

Acceptance:
- Products marked with `Other` appear exactly as per agreed universal rule.
- Behavior is consistent for all roles in Step 3.

## Progress Log

### 2026-03-01

- Added this tracking document.
- Completed deep code analysis and file-level mapping for all requested changes.
- Implemented invoice action visibility using permission-based checks (manager can approve/reject when permission exists).
- Implemented customer registration Step 3 product matching fix:
  - normalized compatibility matching
  - stock-aware filtering
  - brand-level and in-stock fallback when compatibility mapping is missing

### 2026-03-01 (Latest updates requested by Rupin)

- Added explicit handling for: "allow Invoice approve to manager".
- Added fix attempt for: "customer registration step 3 manager doesn't get inventory/stock".
- Pending validation on real manager account in production-like data.
- Added pending to-do to define and implement universal `Other` compatibility behavior.

## Test Checklist (to complete during implementation)

- [ ] Duplicate create API test
- [ ] Duplicate update API test
- [ ] Duplicate import row handling test
- [ ] Manager cannot delete product (API + UI)
- [ ] Manager cannot delete invoice (API + UI)
- [ ] Invoice PDF shows HSN + GST rate for:
  - [ ] Approved download endpoint
  - [ ] Public token endpoint
- [ ] Customer registration "Parts Needed" list shows compatible products for known model
- [ ] `Other` compatibility behaves as agreed (universal or brand-scoped universal)
- [ ] Regression check for Admin flows
