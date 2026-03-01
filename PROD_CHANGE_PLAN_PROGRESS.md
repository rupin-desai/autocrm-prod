# Production Change Plan And Progress

Last updated: 2026-03-01 (IST)  
Source request timestamps: 2026-02-26 and 2026-03-01 (IST)

## Request Summary

1. Prevent duplicate products from being created in inventory.
2. Show HSN number and GST rate as separate details in invoices.
3. Fix Customer Registration Step 3 where compatible products are not visible in "Parts Needed for Service/Replacement".
4. Define universal behavior for `Other` compatibility across brands and models.
5. Manager access update: Manager can approve invoices, but Manager should not have delete options.

## Execution Guardrails Followed

- No production DB calls were made for testing during this implementation.
- Changes were implemented at code level only.
- Validation done via static code checks and review, not live DB/runtime workflows.

## Overall Status

- [x] Code implementation completed for all 5 requested items
- [ ] Runtime validation completed
- [ ] UAT sign-off completed
- [ ] Ready for production deployment

## Implementation Details And Status

### 1) Prevent duplicate product creation

Status: `Implemented in code (confirmed)`  
Files:
- `server/routes.ts`

What is done:
- Added normalized duplicate check in `POST /api/products`.
- Added duplicate prevention in `PATCH /api/products/:id` (excluding current record).
- Added duplicate skip/report handling in `POST /api/products/import`.
- Duplicate rule enforced as case-insensitive match on `productName + brand + model`.

Needs live verification:
- API behavior against existing production-like data (especially old records with inconsistent fields/casing).

---

### 2) Show HSN + GST rate separately in invoice PDF

Status: `Implemented in code (confirmed)`  
Files:
- `server/models/Invoice.ts`
- `server/routes.ts`
- `server/utils/generateInvoicePDF.ts`

What is done:
- Added `gstPercentage` field in invoice item schema.
- Passed `gstPercentage` through invoice PDF generation paths.
- Updated PDF line-item table to show separate columns for:
  - Product Name
  - HSN
  - Qty
  - Unit
  - GST %
  - GST Amount
  - Total

Needs live verification:
- Generate/approve/download invoice in real UI flows and verify final PDF output formatting with real data.

---

### 3) Fix Step 3 compatible products not visible

Status: `Implemented in code (confirmed)`  
Files:
- `client/src/pages/CustomerRegistration.tsx`

What is done:
- Replaced strict exact compatibility filter with normalized matching.
- Added broader fallback matching when strict compatibility entries are missing.
- Restricted to in-stock products.
- Enabled parts section for `Other` model when custom model is provided.
- Updated message to display actual selected/custom model context.

Needs live verification:
- End-to-end customer registration Step 3 behavior for Admin and Manager accounts with real inventory records.

---

### 4) Universal behavior for `Other` compatibility

Status: `Implemented in code (confirmed)`  
Files:
- `client/src/pages/CustomerRegistration.tsx`
- `client/src/pages/Products.tsx`

What is done:
- Matching logic now treats `* - Other` compatibility as universal behavior.
- Explicit helper text added in product compatibility section to indicate `Other` is universal.

Needs live verification:
- Confirm business acceptance that current universal behavior exactly matches client expectation in UAT.

---

### 5) Manager access: approve invoices, no delete options

Status: `Implemented in code (confirmed)`  
Files:
- `server/auth.ts`
- `client/src/pages/Products.tsx`
- `client/src/pages/Invoices.tsx` (already aligned for invoice delete visibility)

What is done:
- Removed Manager delete permissions for:
  - `products`
  - `invoices`
- Kept Manager invoice approval permissions (`approve`, `reject`).
- Hid product delete and delete-duplicates UI actions when user lacks delete permission.
- Invoice delete route already requires `invoices.delete`; Manager no longer has it.
- In invoice UI, delete remains Admin-only, approval remains available to Manager.

Needs live verification:
- Login as Manager and confirm:
  - Can approve invoices.
  - Cannot delete products.
  - Cannot delete invoices (UI and API behavior).

## Progress Log

### 2026-03-01

- Switched to correct workspace `autocrm-prod`.
- Implemented backend permission and duplicate prevention changes.
- Implemented invoice PDF field separation for HSN/GST rate.
- Implemented Customer Registration Step 3 compatibility improvements.
- Implemented manager delete UI restriction in products page.
- Updated this document with code-confirmed status and pending runtime checks.

## Validation Notes

Static validation attempted:
- `npm run check` was executed.

Result:
- Project has existing TypeScript issues unrelated to this change set, so full type-check is not green.
- No DB-backed runtime tests were executed (intentional, as requested).

### Final verification pass (2026-03-01, late pass)

- Re-ran `npm run check` after all requested implementations.
- Confirmed no new TypeScript errors were introduced by the implemented change set.
- Verified permission gates end-to-end in code:
  - Manager retains invoice approval.
  - Manager delete remains blocked by backend permission middleware.
  - Product delete UI actions are hidden when delete permission is absent.
- Verified duplicate prevention logic includes legacy product records that may still use `name` instead of `productName`.
- Verified customer Step 3 now renders product section for `Other + custom model` and uses normalized compatibility matching with universal `Other` behavior.
