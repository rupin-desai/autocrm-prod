# CRM Requirements v2 — Implementation Notes

Implements `CRM_Updated_Requirements_v2`. All eight items are built end to end
(model → API → UI) and verified against a running instance.

---

## 1. Customer OTP optional

OTP is no longer compulsory. The registration form carries an explicit
**Yes / No** control; choosing No registers the customer immediately.

- `client/src/pages/CustomerRegistration.tsx` — "OTP Verification" Yes/No control
- `server/routes.ts` `POST /api/registration/customers` — honours `otpRequired`
- `RegistrationCustomer.otpRequired` / `otpSkipReason` record the decision
  (`staff_opted_out`, `low_value_no_phone`, `local_bypass`) so it is auditable

The existing low-value walk-in rule still applies independently. Registration
OTP verification now also caps guesses at 5 attempts, which it did not before.

## 2. Advance Payment Received

New Main Menu item **Advance Payments**.

- Records customer, vehicle, item/service, related work/order, amount, mode and date
- Reminder defaults to **15 days** and is editable per record, by anyone who can
  create the advance
- Reminder is linked to the customer and the pending work; it stops once the
  advance is marked adjusted, refunded or cancelled
- An advance already adjusted against an invoice cannot be edited or deleted
- `GET /api/advance-payments/customer/:id/pending` exposes available advances for billing

Files: `server/models/AdvancePayment.ts`, `server/routes/advancePayments.ts`,
`client/src/pages/AdvancePayments.tsx`

## 3. Phase I — Customer Inquiry

New Main Menu item **Customer Inquiries**.

- Records customer, vehicle, the items inquired about (with qty and expected
  price), date, salesman, notes and status
- Search spans every one of those fields at once, plus a dedicated filter per
  field and the shared date/period filter
- Status flow: open → quoted → converted / lost / closed. A converted inquiry
  is locked
- `GET /api/inquiries/analytics/top-items` ranks what customers ask for most,
  to steer purchasing

Files: `server/models/Inquiry.ts`, `server/routes/inquiries.ts`,
`client/src/pages/Inquiries.tsx`

## 4. Dashboard — date/period data and customer analytics

A **Business Overview** panel at the top of the Dashboard, driven by one shared
date resolver so every figure moves together.

- Periods: Today, Yesterday, Last 7 days, Month, Year, a specific date, or a
  custom from/to range
- Shows **Sales, UPI, Cash, Card and Pending**, plus **Total Customers**
- Customer counts for the selected window: added, visited, verified, unverified
- A chart of customers added vs visited, auto-bucketed by hour/day/month/year
  to suit the window, plus a referral-source breakdown
- Counts refresh automatically when the period changes — no reload
- `?compare=true` adds period-over-period deltas

**Payment-mode figures now come from the invoice `payments[]` ledger**, not the
legacy single `paymentMethod` field. A split payment (₹6,000 UPI + ₹4,620 Cash)
lands in both buckets and the modes sum exactly to the collected total. Under
the old dashboard it landed in neither.

Files: `server/utils/dateRange.ts`, `server/routes/dashboardPeriod.ts`,
`client/src/components/PeriodFilter.tsx`, `client/src/components/PeriodOverview.tsx`

## 5. Warranty Management

New Main Menu item **Warranty Management**, with two tabs over one linked record
so an item is followed from intake to return.

**Customer Warranty** — receive an item: problem item name, quantity, received
date, problem description, and a reminder after a user-chosen number of days.

**Vendor Warranty** — give the item to a vendor: item name, quantity, date,
problem and narration, with its own reminder and an expected return date. An
item can go out more than once; the claim stays `with_vendor` until every
dispatch is back.

Status flow is enforced: `received → with_vendor → returned_from_vendor →
resolved → delivered_to_customer`. Invalid jumps are rejected with the list of
allowed transitions. A claim cannot be deleted while an item is still out.

Files: `server/models/WarrantyClaim.ts`, `server/routes/warrantyClaims.ts`,
`client/src/pages/WarrantyClaims.tsx`

## 6. WhatsApp — automatic customer updates

Messages are generated from CRM transaction data and sent at these points:

| Trigger | Message |
|---|---|
| Service visit → `working` | Work started, with the current value |
| Service visit total increases | **Added items, additional amount, previous total and revised total** — the ₹50,000 + ₹19,000 case from the brief |
| Service visit → `completed` | Work complete, total and any amount due |
| Payment recorded on an invoice | Payment confirmation, amount, mode, and balance or "fully settled" |
| Advance recorded | Advance receipt confirmation |
| Quotation sent | Quotation shared, with the total |
| Warranty claim status change | Item status update |

Every attempt is written to `CommunicationLog` whether it sends, is skipped or
fails, so the CRM holds the full message history. Messaging never fails the
underlying transaction.

> **Action needed on your side:** WhatsApp requires Meta-approved templates, which
> cannot be created from code. Until you add the approved template names to the
> environment, messages are generated and logged but not delivered — the API
> response says `skipped: "no_template_configured"` and the UI says so too.
> Set: `WHATSAPP_WORK_STARTED_TEMPLATE`, `WHATSAPP_WORK_UPDATED_TEMPLATE`,
> `WHATSAPP_WORK_COMPLETED_TEMPLATE`, `WHATSAPP_PAYMENT_RECEIVED_TEMPLATE`,
> `WHATSAPP_ADVANCE_RECEIVED_TEMPLATE`, `WHATSAPP_QUOTATION_TEMPLATE`,
> `WHATSAPP_WARRANTY_TEMPLATE`. Each takes positional `{{1}}`, `{{2}}` … body
> parameters; `buildCustomerUpdateMessage` in `server/services/customerUpdates.ts`
> documents the order for each type.

Files: `server/services/customerUpdates.ts`, `server/services/whatsapp.ts`

## 7. Customer Quotation

New Main Menu item **Quotations**. Created by Admin, Manager and Sales Executive.

- Customer name, mobile and car details; items with quantity, rate, discount %
  and tax %; totals; expected visit date with a reminder
- **A quotation is inert.** Creating, editing or sending one writes to no other
  collection: no invoice, no stock movement, no payment, no sales figure.
  Verified: raising a quotation for 2 units left stock at 10 and the invoice
  count at 0
- `POST /api/quotations/:id/convert` is the single place it becomes real. It
  raises a `pending_approval` invoice and deducts stock through the same path
  the rest of the app uses. Verified: stock 10 → 8, invoice created
- On conversion, catalogue prices are re-checked. If a price moved since the
  quote, the API returns **409 PRICE_CHANGED** with the differences and the UI
  asks whether to honour the quoted price or bill at the current one — rather
  than silently billing a stale rate
- A converted quotation is locked: no edit, no delete, no second conversion
- Converting needs a registered customer; a walk-in quote says so up front

Totals are computed on the server and never taken from the browser.

Files: `server/models/Quotation.ts`, `server/routes/quotations.ts`,
`client/src/pages/Quotations.tsx`

## 8. E-commerce website product selection

New Main Menu item **Website Products**.

- Per-product "Show on website" switch, plus multi-select bulk publish/hide
- Optional website-specific title, description and price, falling back to the
  catalogue values
- Public storefront feed for the website to consume:
  - `GET /api/public/website/products` (paginated, searchable, by category)
  - `GET /api/public/website/products/:id`
  - `GET /api/public/website/categories`
- The feed returns only flagged products and only storefront-safe fields. Cost,
  supplier and raw stock counts are never exposed — stock appears as a boolean
  `inStock`

Files: `server/routes/website.ts`, `client/src/pages/WebsiteProducts.tsx`,
`Product.showOnWebsite` and friends

---

## Reminders

Every module's reminder is user-configurable, as the brief requires. A sweep
runs in-process every 30 minutes (`REMINDER_SWEEP_INTERVAL_MS`), raises each due
reminder exactly once — `reminderSentAt` is the idempotency marker, so a restart
cannot double-fire — and expires quotations past their validity date.

- `GET /api/reminders` — due reminders
- `POST /api/reminders/run-sweep` — manual sweep (Admin/Manager)
- Editing a reminder's day count re-arms it

Files: `server/services/reminders.ts`

## Permissions

New resources in `ROLE_PERMISSIONS`: `advancePayments`, `inquiries`,
`warrantyClaims`, `quotations`, `website`. Sales Executive can raise inquiries
and quotations but not convert them; conversion needs the `convert` action, held
by Admin and Manager.

## Notes

- New endpoints are paginated with a hard server-side cap and indexed, rather
  than repeating the unbounded-query pattern flagged in `WORKFLOW_AUDIT.md`
- Two audit findings were fixed in passing because this work depended on them:
  the float-equality bug that left fully-paid invoices stuck on `partial`
  (H2), and `customerId?.name` → `fullName`, which had every notification
  addressed to "Unknown Customer" (M3)
- Outbound WhatsApp calls now have a 10s timeout (`WHATSAPP_TIMEOUT_MS`)
- The rest of the audit findings — above all the unauthenticated
  `/api/registration/*` endpoints and client-supplied invoice totals — are
  untouched and still open
