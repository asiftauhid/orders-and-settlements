# Orders and Settlements — Implementation Plan

## Scope discipline

Build exactly what the assignment requirements section asks for — no more. Concretely, we will **not** implement any stretch goals (refunds, audit log, CSV export) or extra polish (no component libraries, no extra pages/features beyond dashboard + order detail + auth). Where the PDF explicitly asks us to just *document* a decision (concurrency approach, editability), we document it in the README rather than over-building it, except where the "minimal correct" implementation is genuinely a one-liner anyway (e.g. the atomic update below is not extra work — it's simply how you'd write a correct payment update in Mongo either way).

## Confirmed stack

- **Framework:** Next.js (App Router, TypeScript) — single project, API routes double as the REST API, deployed on Vercel.
- **Database:** MongoDB Atlas (free M0 cluster) accessed via **Mongoose**.
- **Auth:** Auth.js v5 (`next-auth@beta`) **Credentials provider**, JWT session strategy, bcrypt password hashing. No adapter needed — sessions are stateless JWTs in an httpOnly cookie; we manage the `User` collection ourselves via Mongoose so we control password hashing on signup.
- **Styling:** Tailwind CSS.
- **Testing:** Vitest (fast, ESM-native, pairs well with Next.js) for business-logic unit tests.

## Data model (Mongoose)

Two collections, designed so an order and everything about its payments live in **one document** — this is what makes the concurrency story clean (details below).

`src/lib/models/User.ts`

- `email` (unique, lowercase), `passwordHash`, `createdAt`

`src/lib/models/Order.ts`

- `userId` (ref User, indexed) — enforces "users only see their own data"
- `customer` (string)
- `dueDate` (Date)
- `lineItems: [{ description, quantity, unitPriceCents }]` (embedded subdocuments, **required, min 1 item**)
- `payments: [{ amountCents, date, note, createdAt }]` (embedded subdocuments)
- `subtotalCents`, `totalCents` — computed at write time from line items, stored for cheap reads
- `amountPaidCents` — running total, updated atomically on each payment (see below)
- `createdAt`, `updatedAt`

Line items and payments are **embedded arrays**, not separate collections. Reasoning: they're always read/written together with the order, are bounded in size (an order won't have thousands of payments), and — critically — embedding lets us enforce the "never exceed order total" rule with a single atomic MongoDB operation instead of a multi-document transaction.

**Money as integer cents, not floats.** Every money field is an integer number of cents (`unitPriceCents`, `subtotalCents`, `totalCents`, `amountPaidCents`, `amountCents`) — never a float dollar amount. This avoids floating-point rounding errors compounding across quantity × price × sums × payments, which matters for a finance-adjacent app. The API request/response bodies also use cents; the frontend is the only place that converts to/from a dollar string for display and input (`"$500.00"` ⇄ `50000`), using a single shared helper (`src/lib/logic/money.ts`) so the conversion logic isn't duplicated per form.

## Status derivation — pure function, computed at read time

Status is **never stored**; it's derived on every read via `src/lib/logic/orderStatus.ts`:

```ts
function computeStatus(
  order,
): "pending" | "partially_paid" | "paid" | "overdue" {
  if (order.amountPaidCents >= order.totalCents) return "paid";
  if (new Date() > order.dueDate) return "overdue";
  if (order.amountPaidCents > 0) return "partially_paid";
  return "pending";
}
```

Why derive instead of store: "overdue" is a function of _wall-clock time_, not an event — there's no write that happens when a due date passes, so a stored field would go stale without a cron job. Computing it on every GET is simple and always correct.

Edge cases (documented in README):

- **Overdue but later fully paid** → `paid` wins over `overdue` (checked first).
- **Paid exactly on the due date** → not overdue (strict `>` comparison), still `paid`.

**Zero-total orders are prevented at creation, not handled as a status edge case.** `lineItems` must be a non-empty array (enforced by Zod + Mongoose validation) — an order can't be created with zero line items, so a `totalCents === 0` order can't arise from normal use. This removes the "empty order is vacuously paid" weirdness entirely rather than special-casing it in `computeStatus`.

## Payments & concurrency — atomic conditional update

This directly answers the assignment's "Concurrency" evaluation point.

Recording a payment does **one** atomic Mongo operation:

```ts
Order.findOneAndUpdate(
  {
    _id: orderId,
    userId,
    $expr: { $lte: [{ $add: ["$amountPaidCents", amountCents] }, "$totalCents"] }, // fits within remaining balance
  },
  {
    $push: { payments: { amountCents, date, note, createdAt: new Date() } },
    $inc: { amountPaidCents: amountCents },
  },
  { new: true },
);
```

If two requests race to spend the last of the remaining balance, only one `findOneAndUpdate` can match+apply first (MongoDB guarantees per-document atomicity); the second re-evaluates the filter against the _already-updated_ document and returns `null` if it would overpay. A `null` result → we re-fetch the order and reject with `400` including the actual `maxAllowed` amount (in cents, formatted to dollars for the message).

This is documented in the README as: _"We rely on MongoDB's single-document atomicity rather than explicit locks or multi-document transactions — safe here because payments are embedded in the order document, so the entire invariant (amountPaidCents <= totalCents) is checked and mutated in one atomic op."_

## Auth design

- `auth.config.ts` — edge-safe config (pages, callbacks), used by middleware.
- `auth.ts` — full config with Credentials provider; `authorize()` looks up the user via Mongoose, compares bcrypt hash, returns `{ id, email }`. `session: { strategy: 'jwt' }`.
- `src/app/api/auth/signup/route.ts` — custom endpoint: validates email/password with Zod, hashes with bcrypt, creates `User`.
- `middleware.ts` — protects `/dashboard`, `/orders/*`, and all `/api/orders*` routes; redirects unauthenticated browser requests to `/login`, returns `401` JSON for API requests.
- Every order API route additionally scopes queries by `userId` from the session — never trust a client-supplied user id.

## REST API

- `POST /api/auth/signup` — create account
- `POST /api/auth/[...nextauth]` (Auth.js) — login/logout/session
- `GET /api/orders?status=` — list current user's orders (with computed status), optional status filter
- `POST /api/orders` — create order (validates line items, computes subtotal/total server-side)
- `GET /api/orders/:id` — order detail (line items, payments, computed status)
- `PATCH /api/orders/:id` — edit order, **rejected with 409 once `payments.length > 0`** (see editability decision below)
- `DELETE /api/orders/:id` — **also rejected with 409 once `payments.length > 0`**, same rationale as PATCH
- `POST /api/orders/:id/payments` — record payment via the atomic update above; `400` with `{ error, maxAllowed }` on rejection

Consistent error shape everywhere: `{ error: { message, ...context } }` with correct status codes (400 validation/business-rule, 401 unauthenticated, 404 not found/not owned, 409 conflict).

**Editability decision:** once an order has at least one payment, it is locked — `customer`/`dueDate`/`lineItems` can no longer be edited (`PATCH` → 409) and the order can no longer be deleted (`DELETE` → 409); only new payments can be added. Rationale: prevents changing or losing the order that past payments were validated against and recorded against — deleting an order with payment history would silently destroy that financial record. Documented in README as the assumption, with the alternative noted.

## Frontend pages

- `/signup`, `/login`
- `/dashboard` — order list table (customer, status badge, total, paid, due, due date) + status filter
- `/orders/new` — create order form with dynamic line-item rows, live subtotal preview
- `/orders/[id]` — line items, payment history, "record payment" form, edit form (disabled once locked), delete

## Testing

Vitest unit tests for the pure logic in `src/lib/logic/`:

- `computeTotals` — subtotal/total cents math across multiple line items (integer arithmetic, no float rounding)
- `computeStatus` — all four statuses + the overdue-then-paid edge case
- Payment validation — rejects `< 1 cent`, rejects over-payment, accepts exact-total multi-payment (the assignment's sample scenario: $400 + $600 on a $1000 order, then reject $1)
- Order creation validation — rejects an order with an empty `lineItems` array
- Edit/delete lock — rejects `PATCH` and `DELETE` once an order has at least one payment

## Seed script

`scripts/seed.ts` creates one demo user and reproduces the assignment's exact sample scenario order (2×$500 line item, due in 7 days, then $400 + $600 payments applied) — just enough data to immediately see the dashboard and status logic working. Nothing extra.

## Deployment

1. Create MongoDB Atlas free (M0) cluster, get connection string → `MONGODB_URI`.
2. Push repo to GitHub, import into Vercel.
3. Set env vars in Vercel: `MONGODB_URI`, `AUTH_SECRET`, `AUTH_URL`.
4. Verify the deployed URL end-to-end against the sample scenario, put URL in README.

## README

Setup steps, API table, status rules + edge cases, editability decision, concurrency approach, assumptions/tradeoffs, what we'd improve for production (rate limiting, real audit log, pagination, refunds, CSV export, multi-doc transactions if the model ever splits payments into their own collection).

## Build order (step by step, reviewing each stage together)

1. Scaffold Next.js + TypeScript + Tailwind project, connect to MongoDB Atlas, verify connection
2. Write Mongoose models: User, Order (embedded lineItems + payments, cents-based money fields)
3. Write pure business logic: computeTotals, computeStatus, money conversion helpers, Zod validation schemas + unit tests
4. Set up Auth.js v5 Credentials provider, signup route, middleware route protection
5. Build orders CRUD API routes with ownership checks, non-empty line items validation, edit/delete lock after first payment, and consistent error responses
6. Build atomic record-payment endpoint with over-payment rejection and concurrency-safe update
7. Build signup/login pages
8. Build dashboard: order list, status filter
9. Build order create/detail pages: line items, payment history, record-payment form, edit/delete (dollar inputs converted to/from cents)
10. Write minimal seed script reproducing just the assignment's sample scenario; manually verify it end-to-end
11. Finalize unit tests for payment allocation, status transitions, over-payment rejection, empty-line-items rejection, edit/delete lock
12. Write README: setup, API overview, status rules/edge cases, assumptions, concurrency approach
13. Deploy to Vercel + MongoDB Atlas, verify live URL against sample scenario
