# AutoCRM — Codebase & Workflow Audit

**Date:** 2026-09-22
**Commit audited:** b299208 (master)
**Scope:** `server/` (10,927 LOC), `client/src/` (26,549 LOC), 141 API routes, 24 Mongoose models
**Method:** full read of the invoice/payment/stock/auth paths, route-by-route middleware inventory, model & index review, plus live probing of a locally running instance.

Findings marked **[verified live]** were reproduced against a running server, not inferred from reading.

---

## Verdict

The product works and the domain modelling is sensible, but three structural problems dominate everything else:

1. **The customer database is world-readable.** Thirteen `/api/registration/*` endpoints have no authentication at all, including a full PII dump and a destructive delete.
2. **Money is whatever the browser says it is.** Invoice totals, GST and line prices are computed client-side and persisted without server recalculation.
3. **The two shops share one dataset.** Shop selection is a localStorage label; no record carries a shop, no query filters by one.

Beneath those, the payment ledger has two competing sources of truth, and nothing is paginated.

Health signals that are good: `tsc --noEmit` passes with **0 errors**; stock decrement uses a correct atomic guard; PDF path handling is traversal-safe; search regex input is escaped; the RBAC permission matrix is coherent and consistently applied *where it is applied*.

Health signals that are bad: **0 automated tests** anywhere in the repo, for an application that moves money and stock.

---

## CRITICAL

### C1 — Thirteen customer/vehicle endpoints have no authentication
`server/routes.ts:4574, 4667, 4733, 4891, 4947, 5000, 5037, 5064, 5091, 5147, 5203` (+ `498`)

`GET /api/registration/customers` returns **every customer in the database** — full name, mobile, alternative number, email, complete address, pin code — with no session, no permission, and no pagination.

**[verified live]** `curl http://localhost:5001/api/registration/customers` with no cookie → `200`.
**[verified live]** `curl -X DELETE .../api/registration/vehicles/<id>` with no cookie → `404` (not `401`) — proving the handler runs unauthenticated. With a real id, it deletes.

Anyone who knows the domain name can export the entire customer list, and can delete vehicle records.

Two of these are legitimately public (a customer self-registering and verifying their own OTP). The other eleven are staff operations that were never gated.

**Fix:** add `requireAuth` + `requirePermission('customers', …)` to everything except `POST /api/registration/customers` and `POST /api/registration/verify-otp`. For those two, scope the response to the customer's own record. Add pagination to the list endpoints while you are in there.

---

### C2 — Invoice totals are taken from the client and never recomputed
`server/routes.ts:5682` — `const subtotal = items.reduce((sum, item) => sum + item.total, 0);`

The server accepts `items[].unitPrice`, `items[].total`, `items[].gstAmount` and `items[].gstPercentage` exactly as the browser sent them. It never loads the product, never multiplies `unitPrice × quantity`, never derives GST, never checks the line total against the catalogue price. `taxAmount` is hardcoded to `0` while `taxRate` (default 18) is stored on the invoice and printed on the PDF.

Any user who can create an invoice — including a Sales Executive — can issue one for ₹1 on ₹50,000 of goods, and stock will be deducted correctly for the full quantity. There is no server-side record of what the price *should* have been.

**Fix:** recompute server-side from `Product.sellingPrice` × quantity, derive GST from the product's tax rate, and treat the client's numbers as a proposal to validate rather than a value to store. Reject on mismatch beyond a rounding tolerance. Allow an explicit, permissioned, logged manual price override where the shop genuinely needs one.

---

### C3 — `POST /api/invoices/manual/create` fails 100% of the time
`server/routes.ts:5586` — `createdBy: (req as any).session.userName || 'System'`

`Invoice.createdBy` is `{ type: ObjectId, ref: 'User', required: true }`. The route assigns the user's **name**.

**[verified live]** With valid fixtures and an authenticated Admin session:
```
POST /api/invoices/manual/create → 500
Invoice validation failed: createdBy: Cast to ObjectId failed for value "Local Admin"
```
This is not an edge case — it fails for every user on every call. The manual-invoice path has never worked.

**Fix:** `createdBy: (req as any).session.userId`. Then decide whether this route should exist at all (see C4).

---

### C4 — Two independent invoice-numbering schemes that will collide
`server/models/Invoice.ts:161` (pre-save hook) vs `server/routes.ts:5560` (`getNextSequence`)

Both produce `INV/YYYY/NNNN`, from two unrelated sources:

- The **pre-save hook** finds the most recent invoice by `createdAt`, parses its trailing number and adds one. Two concurrent saves read the same value and generate the same number; `unique: true` then throws E11000 and the second invoice creation fails outright.
- `/api/invoices/manual/create` uses `getNextSequence('invoice')` — an atomic `$inc` counter in a separate collection that knows nothing about existing invoice numbers.

The counter starts at 1. On any database that already has invoices, the counter path regenerates numbers that already exist.

Note that `server/models/Counter.ts:10` — the correct atomic-sequence helper — already exists and is used by exactly one route. The fix is to use it everywhere.

**Fix:** delete the pre-save hook, route all invoice numbering through `getNextSequence`, and seed the counter from `MAX(existing invoice number)` in a migration. Keep the unique index as a backstop.

---

### C5 — Approved invoices can be hard-deleted
`server/routes.ts:6439`

`DELETE /api/invoices/:id` removes an approved, paid, PDF-delivered tax invoice from the database and `unlink`s its PDF. Stock is reversed, but the coupon's `usedCount` is not. What remains is one line in the activity log.

For GST-registered billing in India this is a compliance problem, not just a data-integrity one: issued invoices must be cancelled or credit-noted, never erased. It also silently breaks the invoice number sequence.

**Fix:** restrict deletion to `draft` and `rejected`. Replace it with `cancelled` status + credit note for anything approved. Decrement `coupon.usedCount` on both cancel and reject.

---

## HIGH

### H1 — The payment ledger has two sources of truth that disagree
`server/routes.ts:6069` (`payment-status`) vs `server/routes.ts:6362` (`payments`)

`PATCH /api/invoices/:id/payment-status` sets `paidAmount = totalAmount`, `dueAmount = 0` and `paymentMethod` — **without appending anything to `payments[]`**. `POST /api/invoices/:id/payments` appends entries and increments the same fields.

Consequences:
- Marking an invoice paid produces no payment record. Cash reconciliation has nothing to reconcile against.
- Setting status to `'partial'` hits neither branch — `paidAmount` is left untouched while the status claims partial payment. Arbitrary state.
- Recording a real payment afterwards double-counts, because `paidAmount` was already set to the full total.

**Fix:** make `payments[]` the only writable source. Derive `paidAmount`, `dueAmount` and `paymentStatus` from it (ideally in a pre-save hook). Reduce `payment-status` to a read-only projection, or delete it.

### H2 — Fully-paid invoices get stuck on `partial` (float equality on money)
`server/routes.ts:6412` — `if (invoice.dueAmount === 0)`

Every amount in the system is a JS float. Two part-payments on an invoice ending in paise leave `dueAmount` at `4.5e-13`, never exactly `0`, so the invoice stays `partial` forever and keeps appearing in the pending-payments list and the overdue notifications.

**Fix:** short term, compare with a ₹0.01 epsilon and round on write. Properly, store money as integer paise.

### H3 — Payment-mode dashboard figures don't add up
`server/routes.ts:2955-2965`

UPI/Card/Cash collection totals are computed from `invoice.paymentMethod` — the single legacy field — while `todaySales` sums `paidAmount`. A split-tender invoice (₹500 cash + ₹500 UPI) records two entries in `payments[]` but leaves `paymentMethod` unset, so it lands in `todaySales` and in none of the three mode buckets. The three figures will never sum to the total, and the gap grows with split payments.

**Fix:** aggregate over `payments[]` by `paymentMode` once H1 makes it authoritative.

### H4 — Deactivating, demoting or deleting a user does nothing to their live session
`server/middleware.ts:4-9`, `server/routes.ts:1178, 1213`

`requireAuth` checks only that `session.userId` exists. Role and permissions come from `session.userRole`, written once at login and never re-read. So:
- Setting `isActive: false` does not log the user out. They keep working.
- Demoting Admin → Service Staff leaves full Admin permissions until they voluntarily log out.
- Deleting the user entirely leaves their session fully functional.

**Fix:** load the user from the database in `requireAuth` (cached briefly), check `isActive`, and take the role from the record rather than the session.

### H5 — Unauthenticated OTP sending with no rate limit anywhere
`server/routes.ts:1004` (`forgot-password`), `920` (`send-otp`), `4574`, `5203` (registration)

There is no rate limiting in the application — no `express-rate-limit`, no `helmet`, nothing. `POST /api/auth/forgot-password` is unauthenticated and fires a real WhatsApp message on each call. It also returns `"No {role} account found with this mobile number"`, which enumerates valid accounts by role.

Uncapped: WhatsApp-bombing any number at your cost, account enumeration, and unlimited password-guessing against `/api/auth/login`.

Registration OTP verification (`routes.ts:4667`) has **no attempt cap at all** — unlike `verifyOTP` in `auth.ts`, which caps at 3 — so a 6-digit registration OTP is brute-forceable in ~1M requests with no lockout.

**Fix:** `express-rate-limit` on `/api/auth/*` and the registration endpoints, per-IP and per-mobile. Make failure responses generic. Add an attempt counter to the registration OTP path.

### H6 — Nothing is paginated
`server/routes.ts` — 0 occurrences of `skip(` or a `page` parameter across 141 routes

`GET /api/invoices` returns every invoice ever created, each carrying embedded `customerDetails`, `vehicleDetails` (including a base64 `vehiclePhoto`), all items and all payments, through five `.populate()` calls. `GET /api/registration/customers`, `/api/products` and the reports endpoints have the same shape.

At a few thousand invoices this is tens of megabytes per request, per user, per page load. This is the single thing most likely to take production down as the data grows.

**Fix:** cursor or offset pagination with a hard server-side cap, and `.select()` to drop embedded blobs from list views.

### H7 — Images are stored as base64 inside MongoDB documents
`server/routes.ts:2325` (50MB per image accepted), `server/index.ts:22` (100MB JSON body)

Service-visit before/after photos, vehicle photos and barcode images are stored as base64 strings in the documents. MongoDB's hard document limit is 16MB, so anything over ~12MB of image fails on save with an opaque error. Below that, it inflates every query that touches the collection — including the dashboard and the invoice list, which carry `vehiclePhoto` along for the ride.

**Fix:** object storage (S3/R2/local `uploads/` behind a route), store URLs. Resize and cap on upload.

### H8 — No index on any hot collection
`server/models/` — indexes exist only on `ActivityLog`, `OTP`, `SupportTicket`, `Attendance`, `PerformanceLog`

`Invoice`, `Product`, `RegistrationCustomer`, `RegistrationVehicle` and `ServiceVisit` have none beyond the implicit `_id` and a few `unique` fields. Every dashboard load, invoice filter, customer lookup and vehicle search is a collection scan.

**Fix (minimum):**
```
Invoice:              { createdAt: -1 }, { status: 1, paymentStatus: 1 }, { customerId: 1, createdAt: -1 }, { createdBy: 1 }
ServiceVisit:         { status: 1, createdAt: -1 }, { customerId: 1 }
RegistrationCustomer: { mobileNumber: 1 } unique, { referenceCode: 1 } unique, { createdAt: -1 }
RegistrationVehicle:  { customerId: 1 }, { vehicleNumber: 1 }
Product:              { stockQty: 1 }, { category: 1 }, { barcode: 1 }
```

### H9 — Session and transport configuration is unsafe for production
`server/index.ts:16, 29, 32, 36`; `ecosystem.config.cjs`

- `secret: process.env.SESSION_SECRET || "autoshop-secret-key-change-in-production"` — a hardcoded fallback in a git repo. `ecosystem.config.cjs` has its own fallback, `'change_me_in_server_env'`. If the env var is ever missing, session cookies are forgeable.
- `cookie.secure: false` is hardcoded, so the session cookie is transmitted over plain HTTP in production.
- `cors({ origin: true, credentials: true })` reflects any origin. `sameSite: 'lax'` limits the practical damage today, but this is one cookie-policy change away from being exploitable.
- `MemoryStore` means every deploy and every restart logs out every user, and session memory grows unbounded.

**Fix:** fail hard at boot if `SESSION_SECRET` is unset; `secure: NODE_ENV === 'production'`; an explicit CORS allowlist; move sessions to MongoDB (`connect-mongo` — you already have the connection).

---

## MEDIUM

### M1 — Anyone who can create an invoice can approve their own
`server/routes.ts:5785`

`requirePermission('invoices','approve')` is the only gate. Admin and Manager hold both `create` and `approve`, so the approval step is self-service for them — there is no check that `invoice.createdBy !== session.userId`. The approval workflow exists but enforces nothing for the roles that matter.

**Fix:** reject self-approval, or make it an explicit, logged, Admin-only override.

### M2 — Service-visit status accepts any transition
`server/routes.ts:2343` — `if (req.body.status !== undefined) visit.status = req.body.status;`

The enum is validated; the *transition* is not. A visit can jump straight from `inquired` to `completed`, or be moved back from `completed` to `working` after an invoice has been generated from it — leaving an approved invoice attached to an incomplete visit. `DELETE /api/service-visits/:id` has no guard either, so a visit with invoices can be deleted, orphaning `invoice.serviceVisitId`.

**Fix:** a transition table (`inquired → working → waiting → completed`), and refuse backwards moves or deletion once an invoice exists.

### M3 — Every customer notification says "Unknown Customer"
`server/routes.ts:2410, 2515, 2549, 2555, 2583` — `customerId?.name || 'Unknown Customer'`

`RegistrationCustomer` has `fullName`, not `name` (`server/models/RegistrationCustomer.ts:5`), and both `ServiceVisit.customerId` and `Order.customerId` reference it. The fallback fires every time, in all five places. Every service-visit and order notification ever sent has been addressed to "Unknown Customer".

**Fix:** `customerId?.fullName` at all five sites.

### M4 — The shop selector is decorative
`client/src/pages/ShopSelection.tsx:35`, `client/src/pages/CustomerRegistrationDashboard.tsx:424`

The chosen shop is written to `localStorage` and read back in exactly one place, to render a label. No model has a shop field; no query filters by shop; the server never validates it. It is also chosen *before* login and never bound to the user account.

So Shop B's staff see Shop A's customers, invoices, stock and reports, and a sale at either location decrements the same global stock number. If you genuinely run two locations, per-location inventory is the requirement this silently fails to meet — and it is the most likely source of "the stock numbers are wrong" complaints.

**Fix:** a `shop` field on User, Product stock, ServiceVisit, Invoice and Customer; derive the active shop from the logged-in user, not localStorage; scope every query. This is the largest change in this document and deserves its own design pass.

### M5 — The client never refetches
`client/src/lib/queryClient.ts:6-9` — `staleTime: Infinity`, `refetchOnWindowFocus: false`, `refetchInterval: false`, `retry: false`

Cached data is never refreshed unless a mutation explicitly invalidates its exact key. In a shop where several people work the same jobs on different devices, one person's stock deduction, status change or payment is invisible to everyone else until a hard reload. Every missed `invalidateQueries` call is a permanently stale screen.

**Fix:** a finite `staleTime` (30–60s), `refetchOnWindowFocus: true`, and polling on the live boards (service visits, dashboard).

### M6 — Non-atomic multi-step writes with hand-rolled compensation
`server/routes.ts:5741-5758`

Invoice creation performs: save invoice → adjust stock (per-product) → increment coupon usage. On stock failure it deletes the invoice; on coupon failure nothing unwinds. The stock helper has its own manual rollback loop. Each individual stock decrement is correctly atomic (`findOneAndUpdate` with a `$gte` guard — this part is well done), but the sequence as a whole is not.

**Fix:** MongoDB multi-document transactions, which need a replica set. Converting the single-node deployment to a one-node replica set is a small ops change and unlocks this.

### M7 — Reference-code generation has a race and an O(n) scan
`server/routes.ts:4604-4613`

`countDocuments()` then a `while (await findOne(...)) nextNumber++` loop. Two concurrent registrations get the same code; after deletions the loop walks every taken number one query at a time.

**Fix:** `getNextSequence('customer-' + stateCode)`.

### M8 — Secrets and PII in logs; 616 `console.log` calls in `server/`
`server/routes.ts` alone has 187

`/api/public/invoices/:id/pdf` logs the **full expected access token** on mismatch (`routes.ts:6270`). The invoice-approval path logs customer names and phone numbers. Service-visit updates log entire request bodies. There is no log level, no redaction and no rotation — this goes straight to the PM2 log file.

**Fix:** a real logger (`pino`) with levels and redaction; never log tokens.

### M9 — No timeouts on any outbound call
`server/services/whatsapp.ts`, `server/utils/invoiceNotifications.ts`

Every `fetch` to the WhatsApp provider runs without an `AbortController`. A hung provider holds the request open indefinitely — and invoice approval calls it synchronously, so approvals hang with it.

**Fix:** 10s `AbortSignal.timeout`, and move notification sending to a queue so approval never blocks on a third party.

### M10 — Config read through a fallback that scrapes `MONGODB_URI`
`server/services/whatsapp.ts:10-23`, `server/db.ts:23-30`

`parseEnvValue` looks up a variable and, failing that, tries to extract it with a regex **from inside the Mongo connection string**. `db.ts` correspondingly splits `WHATSAPP_API_KEY` back out of `MONGODB_URI`. This was a workaround for one malformed `.env` that has become load-bearing config logic.

**Fix:** validate the environment once at boot with a zod schema, fail loudly on anything missing, delete the scraping.

### M11 — Dashboard route: duplicated branches, sequential queries, full documents
`server/routes.ts:2940-3097`

The Admin and Manager branches are verbatim 35-line copies. The route runs ~10 queries sequentially with no `Promise.all`, and `Invoice.find({...})` pulls complete documents into memory to sum them in JavaScript where a single `$group` would do.

**Fix:** one aggregation pipeline, permission-driven field selection instead of a branch per role.

### M12 — Dead and undeclared features
- Customer loyalty is fully commented out (`routes.ts:2386-2402`) while `docs/LOYALTY_DISCOUNT_SYSTEM.md` documents it as a feature.
- `ServiceVisit.partsUsed` never affects stock; only invoicing moves inventory. Parts consumed on a visit that is never invoiced are invisible.
- `taxRate` is stored and printed but `taxAmount` is always `0` (C2).

### M13 — Customer PII committed to git
13 invoice PDFs are tracked under `invoices/`, containing real customer names, addresses and phone numbers. `attached_assets/` adds 76MB to the repository. PDFs are also written to `process.cwd()/invoices`, so a clean deploy loses historical invoice files.

**Fix:** `git rm --cached invoices/*.pdf`, add to `.gitignore`, move PDF storage outside the working tree or into object storage. Treat the committed PDFs as disclosed.

---

## Suggested sequence

Phased so that each stage is independently shippable.

**Phase 1 — Stop the bleeding (~1 day)**
C1 auth gaps · C3 one-line fix · H9 session/CORS config · M3 one-line fix · M13 untrack PDFs

**Phase 2 — Money integrity (~2-3 days)**
C2 server-side pricing · H1 single payment ledger · H2 paise/epsilon · H3 dashboard aggregation · C4 unified numbering · C5 no hard delete

**Phase 3 — Performance & scale (~2-3 days)**
H8 indexes · H6 pagination · H7 images out of the database · M11 dashboard aggregation

**Phase 4 — Workflow correctness (~2-3 days)**
H4 live session revocation · M1 separation of duties · M2 status transitions · M5 client freshness · H5 rate limiting

**Phase 5 — Structural (own design pass)**
M4 multi-shop scoping · M6 transactions · M9/M10 config and queueing · tests around the invoice path

**Phase 1 and 2 together are the ones that matter.** Everything in Phase 1 is small, and C1 is a live data-exposure issue on a production domain.
