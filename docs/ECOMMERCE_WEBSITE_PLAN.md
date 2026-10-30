# E-commerce Website — Plan

An online store for Mauli Car Decor, connected to this CRM so that there is
**one stock figure per product**. A stock change made in the CRM shows on the
website, and an online sale reduces the same stock the CRM counts. The store
never keeps a copy of the stock.

The store is built on the **same tech stack as the JB Ayurveda store**
(`hapeefive`): a Turborepo monorepo with a Next.js 16 storefront, a Fastify
commerce API on Prisma + PostgreSQL, Razorpay / PhonePe / COD payments,
Shiprocket shipping, and Coolify deployment. That codebase's checkout, payment,
shipping and email modules can be reused. The one deliberate difference is
§1: products and stock stay in the CRM.

Builds on requirement 8 of `CRM_Updated_Requirements_v2` ("Show on Website"),
which is already done on the CRM side. See `REQUIREMENTS_V2_IMPLEMENTATION.md` §8.

---

## 1. The core rule: the CRM owns products and stock

```
                 ┌──────────────────────────────────────────────┐
  CRM admin ───▶ │  CRM (Express + MongoDB) — crm.maulicardecor.com
  (stock in,     │   server/services/stock.ts — the ONLY writer  │
   invoices,     │   of Product.stockQty / reservedQty           │
   online-order  │   Products, stock, CRM orders, invoices       │
   fulfilment)   └──────▲───────────────────────────▲───────────┘
                        │ storefront API             │ internal API
                        │ (catalogue, availability)  │ (reserve / commit /
                        │                            │  release, order sync)
                 ┌──────┴──────────────┐   ┌────────┴──────────────────┐
  Shopper ─────▶ │ apps/web (Next.js)  │──▶│ apps/api (Fastify)         │
                 │ shop.maulicardecor  │   │ Prisma + PostgreSQL:       │
                 │ .com                │   │ shoppers, carts, orders,   │
                 └─────────────────────┘   │ payments, shipments, email │
                                           │ NO product or stock tables │
                                           └───┬─────────┬──────────┬───┘
                                        Razorpay   PhonePe   Shiprocket
```

- **One stock field.** `Product.stockQty` in the CRM's MongoDB is the only stock
  figure. The storefront and the commerce API read it through the CRM API and
  never store it.
- **One stock service, whoever the caller.** Every stock change goes through
  `server/services/stock.ts`, whether it comes from an invoice, an inventory
  transaction, a return, an online order or a manual adjustment. Each change is
  an atomic, conditional `$inc` and writes an `InventoryTransaction` row, so
  every figure can be traced.
- **One product catalogue.** Products are created, priced, photographed and
  published only in the CRM (Website Products). JB Ayurveda's API has its own
  product tables; this store **drops them**. The commerce API stores only a
  name/price *snapshot* on each order line, the historical record of what was
  sold. It's never used to decide stock or current prices.
- **One admin panel.** JB Ayurveda has a separate `apps/admin`. Here the CRM is
  the admin: online orders are handled from a CRM tab (§5), so staff never have
  two places to look.
- **The storefront never decides stock.** At checkout the commerce API asks the
  CRM to reserve stock. If the CRM says no, the sale doesn't happen.

That means "the admin updated stock but the site still shows the old number"
can only be a caching problem, never a data problem. §6 handles the caching.

---

## 2. Tech stack

The storefront follows the JB Ayurveda (`hapeefive`) stack. The CRM keeps its
existing stack and is extended.

**Store — new repo (e.g. `digitiohub/maulicardecor-store`), modelled on `hapeefive`**

| Layer | Choice (as in JB Ayurveda) | Notes for this store |
|---|---|---|
| Monorepo | npm workspaces + Turborepo 2 (`apps/*`, `packages/*`) | Apps: `web`, `api`. No `admin` app (the CRM is the admin) |
| Storefront | Next.js 16 (App Router) + React 19, TypeScript | `apps/web`: SSR/ISR for SEO, on-demand revalidation (§6) |
| Styling | Tailwind CSS, shared `design-system/` tokens | New Mauli Car Decor brand tokens |
| Commerce API | Fastify (TypeScript, `tsc` build) with JSON-schema route validation | `apps/api`: auth, cart, checkout, payments, shipping, email |
| Database | PostgreSQL + Prisma 7 (`prisma migrate deploy` on start) | Shoppers, addresses, carts, orders, payments, shipments, email logs, settings. **No products or stock** |
| Feature toggles | `packages/module-registry` | Turn `payments_razorpay`, `payments_phonepe`, `payments_cod`, `shipping_shiprocket` on or off without a deploy |
| Payments | Razorpay + PhonePe + Cash on Delivery | Credentials kept in settings groups, as in JB Ayurveda |
| Shipping | Shiprocket (create shipment, AWB, tracking webhooks) | Pickup location = the shop |
| Email | Nodemailer (SMTP), settings-driven templates + email log | Order confirmation, shipped, delivered, invoice |
| Shopper auth | JWT sessions | Login by mobile + WhatsApp OTP through the CRM's OTP service (§4) |
| Images | sharp → WebP (`assets:*:webp` scripts), `@fastify/static` | Site assets only; product photos come from the CRM (§8) |
| Tests | Vitest | Plus the concurrency tests in §9 |
| Deploy | Coolify (nixpacks), separate build/start per app | `coolify:build:web` / `coolify:start:api` scripts, same pattern |

**CRM (existing, extended)**

| Layer | Current | Changes for the store |
|---|---|---|
| API server | Node.js + Express 4, TypeScript (esbuild, PM2 app `autocarv7`) | `server/services/stock.ts`; storefront + internal API routes (§7) |
| Database | MongoDB 7 + Mongoose 8 | Single-node replica set; `StockReservation`; new fields on `Product`, `Order`, `InventoryTransaction` |
| Admin UI | React 18 + Vite 5, wouter, TanStack Query 5, Tailwind 3, shadcn/ui | Online Orders tab; Website Products additions |
| Messaging | WhatsApp Cloud API (`server/services/whatsapp.ts`) | Order templates; OTP for shopper login |
| Scheduling | In-process scheduler (`server/services/reminders.ts`) | Reservation expiry sweep |
| Security | — | Service API key for `apps/api` → CRM calls; `express-rate-limit`; CORS allow-list |

---

## 3. Prerequisite fixes in the CRM (Phase 0, must ship first)

An audit of every place that writes `stockQty` found four places that read the
stock, work out a new number in code, and write it back
(`stockQty: newStock`). With one counter user this rarely bites. With a website
selling at the same time, two writes can overlap and one is silently lost, so
stock drifts and oversells.

| Location | Problem | Fix |
|---|---|---|
| `POST /api/orders` (`server/routes.ts`, ~L2608) | Read-modify-write; **no stock check**, so stock can go negative | Use `stock.deduct()` (conditional `$inc`); reject with 409 if short |
| `POST /api/inventory-transactions` (~L2743) | Read-modify-write for IN/OUT/RETURN/ADJUSTMENT | IN/OUT/RETURN → `$inc`; ADJUSTMENT → `stock.setAbsolute()` with an optimistic check against the stock the admin saw |
| `PATCH /api/product-returns/:id` (~L2905) | Read-modify-write | `stock.add()` |
| `PATCH /api/products/:id` (~L1324) | `...req.body` lets `stockQty` be overwritten with no ledger row | Strip `stockQty` from product edits; stock only changes via inventory transactions |

`applyInvoiceStockAdjustment` / `reverseInvoiceStockAdjustment` already use a
conditional `$inc`. They move into the service unchanged.

**New `server/services/stock.ts`** (single entry point):

```ts
deduct(items, { reason, refType, refId, userId })   // all-or-nothing, rolls back partials
add(items, { reason, refType, refId, userId })
setAbsolute(productId, qty, { expectedCurrent, reason, userId }) // stock-take
reserve(cartItems, { holdMinutes, externalRef })  → reservationId  // §5
commitReservation(reservationId, { refType, refId })   // reserved → sold
releaseReservation(reservationId)                      // expired / cancelled
available(product) = stockQty - reservedQty
```

Every call recomputes `status` (`getProductStockStatus`), runs
`checkAndNotifyLowStock`, writes `InventoryTransaction` with `previousStock` /
`newStock` / `source` (`crm` | `website`), and fires the stock-changed hook (§6).

**MongoDB: switch to a single-node replica set.** `docker/docker-compose.db.yml`
runs a standalone `mongo:7`, and a standalone server can't do multi-document
transactions. A replica set is a one-flag change (`--replSet rs0` plus
`rs.initiate()`), and it lets "deduct stock + create order + log" commit or fail
as one unit instead of relying on manual rollback. It also enables change
streams (§6). Back up first per `VPS_MONGODB_BACKUP_RUNBOOK.md`.

**Security items to close before adding more public surface** (already listed
in `REQUIREMENTS_V2_IMPLEMENTATION.md`):

- `/api/registration/*` endpoints are unauthenticated
- invoice totals are taken from the client

Also tighten CORS. `server/index.ts` uses `origin: true, credentials: true`,
which reflects any origin. Allow-list the CRM and storefront domains.

---

## 4. The store apps

### `apps/web`: storefront (Next.js 16)

| Route | Content | Rendering |
|---|---|---|
| `/` | Hero, featured categories, featured products, store info | ISR, 5 min |
| `/category/[slug]` | Product grid, filters: brand, car make/model (`modelCompatibility`), price, in stock | ISR, 60 s |
| `/product/[slug]` | Gallery, price/MRP/discount, **live stock badge**, compatibility, warranty, add to cart | ISR + live stock fetch |
| `/search?q=` | Search across name, brand, category, compatible model | dynamic |
| `/cart` | Lines with **live availability** per line | client, live |
| `/checkout` | Contact, address or store pickup, Razorpay / PhonePe / COD | dynamic, live |
| `/checkout/verify` | Payment return page (as in JB Ayurveda) | dynamic |
| `/account`, `/account/orders/[number]` | Order history, status, Shiprocket tracking | dynamic, logged in |
| `/login` | Mobile + WhatsApp OTP | dynamic |
| `/contact`, policies | Static | static |

Catalogue data comes from the CRM's storefront API (§7), fetched server-side
with cache tags so the CRM can revalidate exactly the pages it changed.

**"Shop by car"** filter: use `VehicleMaster` / `shared/vehicleData.ts` (brand →
model) against `Product.modelCompatibility`. For a car-accessories store, this
is the main way people browse.

### `apps/api`: commerce API (Fastify + Prisma + PostgreSQL)

Reuse JB Ayurveda's modules for checkout, payment clients (Razorpay, PhonePe),
Shiprocket, email and settings, with these changes:

- **Remove product, category and inventory tables and routes.** Wherever the JB
  code reads a product, call the CRM catalogue API instead.
- **Checkout** calls the CRM's `reserve` before creating the payment. Payment
  success calls `commit`; failure or timeout calls `release` (§5).
- **Prices** are computed on the server from the CRM's current
  `websitePrice ?? sellingPrice` at checkout. The cart's prices are
  display-only.

**Data it owns (PostgreSQL):** `Customer` (shopper account, linked to a CRM
`RegistrationCustomer` by mobile number), `Address`, `Cart`, `Order` +
`OrderItem` (CRM product ID, qty, price snapshot), `Payment`, `Shipment`,
`EmailLog`, `Setting`.

**Shopper login:** mobile number + WhatsApp OTP sent through the CRM's existing
OTP service (internal API), then a JWT session from `apps/api`. A shopper is
matched to (or created as) a CRM `RegistrationCustomer` by mobile number, so
online and walk-in history are one customer in the CRM.

---

## 5. Orders and stock reservation (no overselling)

The website must never sell stock that a counter sale has just taken, and the
other way round.

```
Add to cart        → nothing reserved (cart shows live availability)
Place order        → apps/api: CRM reserve(cart, 15 min)
                       ├─ ok   → reservedQty += qty (atomic, only if available ≥ qty)
                       └─ short→ 409 with per-line availability; cart updates
Razorpay / PhonePe → signature-verified webhook/callback to apps/api
  paid               → apps/api: CRM commit(reservationId, order)
                         CRM: stockQty -= qty, reservedQty -= qty (one transaction)
                              CRM Order created (source: website), InventoryTransaction OUT
Payment fails /    → CRM release(): reservedQty -= qty
15 min passes        (sweep in the CRM scheduler; apps/api also releases on failure)
COD                → reserve → staff confirm in CRM → commit
Cancel / return    → CRM stock.add() back, ledger row; refund via the gateway in apps/api
```

- `Product.reservedQty` (new, default 0) plus a `StockReservation` collection
  (`items`, `expiresAt`, `status`, `externalOrderNumber`).
  **Available = `stockQty − reservedQty`**, and the website and the CRM's sale
  screens both use it.
- The CRM's own invoice/order flows check *available*, not `stockQty`, so a
  counter sale can't take an item that's held in someone's checkout.
- Mark an order paid only from the gateway's signature-verified
  webhook/callback, never from the browser redirect. Make webhook handling
  idempotent by the gateway payment ID, and `commit` idempotent by reservation
  ID.

**Who owns what for an online order**

| Concern | Owner |
|---|---|
| Stock, reservations, product data | CRM |
| Staff view and actions (confirm, pack, ship, cancel) | CRM **Online Orders** tab |
| Payment capture/refund, Shiprocket shipment and tracking, shopper emails | `apps/api` |
| Shopper-facing order status | `apps/api` (mirrors CRM actions) |

- The CRM's existing `Order` model already has `items`, `paymentStatus`,
  `deliveryStatus` (`pending → processing → shipped → delivered / cancelled`),
  `shippingAddress` and `trackingNumber`. Add `source: 'crm' | 'website'`,
  `externalOrderNumber`, `paymentGateway`, `reservationId`,
  `fulfilment: 'delivery' | 'pickup'` and `customerMobile`.
- When staff act in the Online Orders tab, the CRM calls `apps/api` (internal
  API). "Ship" creates the Shiprocket shipment there; the AWB and tracking
  status flow back to the CRM order.
- **Generate invoice** from a paid online order through the existing CRM
  invoice flow (GST/HSN), marked as already stock-adjusted so stock isn't
  deducted twice. Online payments land in the invoice `payments[]` ledger, so
  the dashboard's Sales/UPI/Card figures include online sales.
- Customer messages: email from `apps/api` (Nodemailer, as in JB Ayurveda), and
  WhatsApp from the CRM's `customerUpdates.ts` with new kinds `order_placed`,
  `order_shipped` and `order_delivered` (each needs a Meta-approved template).

---

## 6. Keeping the website's view fresh

There's only one stock figure (§1). This section makes sure cached pages catch
up within seconds.

1. **Live where it matters.** The product page stock badge, the cart and
   checkout always call the CRM's availability endpoint (no cache). Customers
   can't buy against a stale number.
2. **On-demand revalidation.** The stock service's changed-hook (and product
   edits / "Show on website" toggles) POSTs the affected product IDs to
   `apps/web`'s `/api/revalidate` with a shared secret. Next.js re-renders just
   those product and category pages. If that call fails, nothing breaks: ISR
   expires in 60 s anyway.
3. **Optional later:** a MongoDB change stream on `products` (needs the replica
   set from §3) instead of the hook, which also catches any write that bypasses
   the service.

Result: when the admin updates stock in the CRM, the website shows it in
seconds. When a sale happens on the website, the CRM's Products/Inventory
screens show it immediately, because they read the same document.

---

## 7. API surface

**CRM → public storefront API** (read-only, cacheable, CORS-locked to the store
domain). Existing, kept: `GET /api/public/website/products`, `/products/:id`,
`/categories`. These return only `showOnWebsite` products and only
storefront-safe fields. Additions:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/public/website/products/by-slug/:slug` | Product page lookup |
| GET | `/api/public/website/availability?ids=` | Live `available` per product (capped, e.g. "10+"), uncached |
| GET | `/api/public/website/vehicles` | Brand → model list for "shop by car" |

**CRM ↔ `apps/api` internal API** (server-to-server only, `X-Service-Key`
header, not reachable from browsers):

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/internal/stock/reserve` | Reserve a cart; 409 with per-line availability if short |
| POST | `/api/internal/stock/commit` | Paid → deduct stock, create the CRM order (idempotent) |
| POST | `/api/internal/stock/release` | Payment failed / cancelled |
| POST | `/api/internal/prices` | Current server prices for a cart (checkout totals) |
| POST | `/api/internal/otp/send`, `/otp/verify` | Shopper login via the CRM's WhatsApp OTP |
| POST | `/api/internal/customers/upsert` | Link a shopper to a `RegistrationCustomer` |
| (apps/api) | `/internal/orders/:number/status` | CRM staff actions → payment refund / Shiprocket |

**`apps/api` → browser:** the JB Ayurveda-style routes for auth, cart,
addresses, checkout/payment-init, payment callbacks, orders and tracking.

Show exact counts only when stock is low (e.g. "Only 3 left"). Otherwise just
"In stock", so competitors can't scrape inventory levels.

---

## 8. CRM changes summary

- `server/services/stock.ts` (new); all stock writers refactored onto it (§3)
- `Product`: `reservedQty`, `slug`, `websiteImages`, optional `featured`, SEO fields
- `StockReservation` model (new); expiry sweep added to `server/services/reminders.ts`'s scheduler
- `Order`: `source`, `externalOrderNumber`, payment, fulfilment and reservation fields
- `InventoryTransaction`: `source` (`crm` | `website`), `refType` / `refId`
- Internal API with service-key auth and rate limiting (§7)
- Website Products page: image upload for the storefront, slug, featured toggle, a preview link
- Orders page: Online Orders tab with the fulfilment workflow
- Dashboard: an online-sales figure in the Business Overview, using the existing period filter

**Product images:** confirm how `Product.images` is stored today. If it's
base64 in MongoDB, move storefront images to file storage (the VPS disk behind
a `/media` route, or S3-compatible storage), generating resized WebP variants
with sharp (the same tool JB Ayurveda uses). A product listing can't serve
multi-MB base64 strings.

---

## 9. Phased delivery

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Foundations** (CRM) | Stock service + refactor of the 4 writers; replica set; CORS allow-list; close the `/api/registration/*` auth gap | 50 parallel deduct requests on stock 10 → exactly 10 succeed, stock 0, 10 ledger rows; existing invoice/inventory flows unchanged |
| **1. Repo + catalogue** | New monorepo from the `hapeefive` structure (product tables removed); `apps/web` home, category, product, search, shop-by-car; CRM image pipeline; revalidation hook | Toggling "Show on website" or changing stock in the CRM shows on the site within ~5 s |
| **2. Cart & checkout** | `apps/api` + PostgreSQL; internal reserve/commit/release; Razorpay, PhonePe, COD; OTP login | A test payment completes end to end; abandoned checkout releases stock after 15 min; a counter sale can't take a reserved unit |
| **3. Fulfilment** | CRM Online Orders tab; Shiprocket shipments and tracking; invoice from order; email + WhatsApp order updates; dashboard online-sales figure | Staff take an online order from placed → delivered entirely in the CRM, with one stock deduction |
| **4. Launch** | SEO (sitemap, product structured data, OG images), analytics, policies (shipping, returns, privacy), load test, backups verified for both databases | Live on `shop.maulicardecor.com` |

---

## 10. Deployment

- **Store:** Coolify, as for JB Ayurveda. Three resources: `apps/web` (Next.js),
  `apps/api` (Fastify, runs `prisma migrate deploy` on start) and a managed
  PostgreSQL with backups enabled. Domains: `shop.maulicardecor.com` (web) and
  `api.shop.maulicardecor.com` (API).
- **CRM:** stays where it runs today (PM2 `autocarv7`, `crm.maulicardecor.com`).
  `apps/api` reaches its internal API over HTTPS with the service key, or over
  the private network if both run on the same server.
- **Env vars**
  - CRM: `STOREFRONT_URL`, `STOREFRONT_REVALIDATE_SECRET`,
    `STORE_SERVICE_KEY`, `STORE_API_URL`, `RESERVATION_HOLD_MINUTES`
    (default 15), `CORS_ORIGINS`
  - `apps/api`: `DATABASE_URL`, `JWT_SECRET`, `CRM_API_URL`,
    `CRM_SERVICE_KEY`, `NEXT_PUBLIC_APP_URL`. Razorpay, PhonePe, Shiprocket
    and SMTP credentials go in the settings tables (as in JB Ayurveda), not env
  - `apps/web`: `NEXT_PUBLIC_API_URL`, `CRM_PUBLIC_API_URL`,
    `REVALIDATE_SECRET`, `NEXT_PUBLIC_SITE_URL`

---

## 11. Decisions needed from the business

1. **Domain:** `shop.maulicardecor.com` or the root `maulicardecor.com`?
2. **Fulfilment:** home delivery (Shiprocket), store pickup, or both? Delivery
   area (Mumbai only / pan-India) and shipping charges?
3. **Payments:** Razorpay and/or PhonePe merchant accounts (business KYC).
   Allow Cash on Delivery, and up to what order value?
4. **Pricing:** same as the counter (`sellingPrice`) by default, with
   `websitePrice` as an override where needed. Confirm.
5. **Services online:** sell only products, or also let customers book
   installation / service slots (would create a CRM service visit)?
6. **Returns policy** for online orders.
7. **Product content:** who uploads website photos and descriptions? Products
   only appear once flagged in Website Products.
