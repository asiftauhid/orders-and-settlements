# Orders & Settlements

A small full-stack app for creating orders with line items, recording payments
(and refunds) against them, and tracking what's owed — built as a job
application take-home assignment.

Live demo: _add the deployed Vercel URL here after deploying_

## Tech stack

- **Next.js** (App Router, TypeScript) — one project serves both the frontend
  and the REST API (API routes).
- **MongoDB Atlas** via **Mongoose** — orders and their line items/payments
  are embedded in a single document per order (see [Data model](#data-model)).
- **Auth.js v5** (`next-auth@beta`), Credentials provider (email + password),
  JWT sessions in an httpOnly cookie, `bcryptjs` for password hashing.
- **Tailwind CSS** for styling.
- **Zod** for request validation.
- **Vitest** for unit tests of the pure business logic.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in MONGODB_URI and AUTH_SECRET, see below
npm run seed                 # optional — creates a demo user + sample orders
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up for a new
account, or log in with the seeded demo account (see below).

### Environment variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string, including the database name (e.g. `.../orders-and-settlements?retryWrites=true...`). |
| `AUTH_SECRET` | Used by Auth.js to sign/verify session JWTs. Generate with `openssl rand -base64 32`. |

### Seeding demo data

`npm run seed` creates one demo user and four orders that cover every status
plus a refund, so there's something to look at immediately:

| Customer | Scenario | Status |
|---|---|---|
| Acme Corp | The assignment's sample scenario: $1000 order, $400 then $600 payments | `paid` |
| Globex Inc | Due in the future, no payments yet | `pending` |
| Initech | Due date already passed, no payments | `overdue` |
| Umbrella Corp | Paid in full, then partially refunded | `partially_paid` |

Login: `demo@example.com` / `password123`.

The script is idempotent — re-running it deletes that demo user's previous
orders first, so it can be run again without accumulating duplicates. It
builds each order's status history by replaying the same pure functions
(`computeStatus`, `computeNextStatusHistory`) the live API uses, so the
seeded data is indistinguishable from what a real user's actions would have
produced.

### Tests

```bash
npm test          # run once
npm run test:watch
```

Unit tests cover the pure logic in `src/lib/logic/`: order totals, status
derivation (all four statuses + edge cases), payment/refund validation
(including the assignment's sample scenario), status-history transitions,
and CSV escaping — plus Zod schema validation. No database or network is
touched by these tests.

## Data model

Two Mongoose collections, designed so an order and everything about its
payments live in **one document**:

**`User`** — `email` (unique, lowercased), `passwordHash`, `createdAt`.

**`Order`** —

- `userId` (ref `User`, indexed) — every query is scoped by this, so a user
  can only ever see or modify their own orders.
- `customer`, `dueDate`
- `lineItems: [{ description, quantity, unitPriceCents }]` — embedded,
  required, **at least one item**.
- `payments: [{ type: "payment" | "refund", amountCents, date, note, createdAt }]`
  — embedded. Both types store a positive `amountCents`; the direction is
  carried by `type`, so amounts are never ambiguous.
- `subtotalCents`, `totalCents` — computed from line items at write time.
- `amountPaidCents` — net paid (payments minus refunds), maintained as a
  running counter updated atomically on each payment/refund (see
  [Concurrency](#payments-refunds--concurrency)).
- `statusHistory: [{ status, changedAt }]` — audit log of status changes
  (stretch goal, see below).
- `createdAt`, `updatedAt`.

Line items and payments are **embedded arrays, not separate collections**.
They're always read/written together with the order, are bounded in size
(an order won't have thousands of payments), and — critically — embedding
lets the "never exceed order total" invariant be enforced with a single
atomic MongoDB operation instead of a multi-document transaction.

**Money is always an integer number of cents, never a float.** Every money
field (`unitPriceCents`, `subtotalCents`, `totalCents`, `amountPaidCents`,
`amountCents`) is an integer. This avoids floating-point rounding errors
compounding across quantity × price × sums × payments. The API request and
response bodies also use cents; the frontend is the only place that converts
to/from a dollar string for display and input, through one shared helper
(`src/lib/logic/money.ts`).

**Zero-total orders are prevented at creation, not handled as a status edge
case.** `lineItems` must be non-empty (enforced by both Zod and a Mongoose
validator), so a `totalCents === 0` order can't arise from normal use — this
removes the "empty order is vacuously paid" ambiguity entirely rather than
special-casing it in the status logic.

## Order status — derived, never stored

Status (`pending` / `partially_paid` / `paid` / `overdue`) is computed fresh
on every read (`src/lib/logic/orderStatus.ts`), never stored on the order
itself:

```ts
function computeStatus(order, now = new Date()) {
  if (order.amountPaidCents >= order.totalCents) return "paid";
  if (now > order.dueDate) return "overdue";
  if (order.amountPaidCents > 0) return "partially_paid";
  return "pending";
}
```

**Why derive instead of store:** "overdue" is a function of wall-clock time,
not an event — no write happens when a due date passes, so a stored field
would silently go stale without a background job. Computing it on every read
is simple and can never be wrong.

**Edge cases:**

- **Overdue but later fully paid → `paid`.** The `paid` check runs first, so
  an order that was overdue before being fully paid correctly shows `paid`,
  not `overdue`.
- **Paid exactly on the due date → not overdue.** The comparison is strict
  `now > dueDate`, so the due date itself is not yet overdue.
- **A refund can move a `paid` order back to `partially_paid`** (or even
  `pending`, if fully refunded) — status is always recomputed from the
  current `amountPaidCents`, it doesn't "remember" having once been paid.

## Payments, refunds & concurrency

Recording a payment or refund is **one atomic MongoDB operation**
(`POST /api/orders/:id/payments`), not a read-then-write:

```ts
Order.findOneAndUpdate(
  {
    _id: orderId,
    userId,
    // payment: fits within remaining balance / refund: doesn't exceed amount paid
    $expr: isRefund
      ? { $gte: [{ $subtract: ["$amountPaidCents", amountCents] }, 0] }
      : { $lte: [{ $add: ["$amountPaidCents", amountCents] }, "$totalCents"] },
  },
  {
    $push: { payments: { type, amountCents, date, note } },
    $inc: { amountPaidCents: isRefund ? -amountCents : amountCents },
  },
  { new: true },
);
```

If two requests race to spend the last of the remaining balance, MongoDB
guarantees only one `findOneAndUpdate` can match-and-apply first; the second
re-evaluates its filter against the *already-updated* document and gets
`null` back instead of over-applying. A `null` result means we lost the
race — we re-fetch the order and reject with `400` and the actual, current
`maxAllowedCents`, rather than a stale number from before the race.

We rely on MongoDB's single-document atomicity rather than explicit locks or
multi-document transactions — this is safe specifically *because* payments
are embedded in the order document, so the entire invariant
(`0 <= amountPaidCents <= totalCents`) is checked and mutated in one atomic
op. If payments were ever split into their own collection (e.g. for scale),
this would need multi-document transactions instead.

**Rules enforced (both as a fast pre-check and inside the atomic filter):**

- A payment can't exceed the remaining balance (`totalCents - amountPaidCents`).
- A refund can't exceed the amount currently paid (`amountPaidCents`) — you
  can't refund money that was never received.
- Amounts must be a positive whole number of cents (no zero/negative
  payments, no fractional cents).
- Multiple payments and refunds are allowed on the same order, in any order.

## Editability lock

Once an order has **any** payment or refund recorded, `customer`, `dueDate`,
and `lineItems` can no longer be edited (`PATCH` → `409`), and the order can
no longer be deleted (`DELETE` → `409`) — only new payments/refunds can be
added.

**Rationale:** editing or deleting an order after money has changed hands
would silently invalidate the payments already validated and recorded
against it (e.g. shrinking the total below what's already been paid, or
losing the payment history entirely on delete). Locking is the simplest way
to guarantee the order's totals and its payment history never disagree.

## Audit log (stretch goal)

`statusHistory` logs every time an order's *derived status* actually
changes, with a timestamp — not a general activity log of every action, just
status transitions (`pending → partially_paid → paid → overdue`, in any
order/combination a refund could produce).

A new entry is appended after any operation that could change status: order
creation, edits, payments, and refunds. The one transition that needs
special handling is **pending → overdue**, since it happens purely from time
passing, with no write ever occurring — we detect and log it *lazily*, on
the next `GET` of that order. This means an overdue transition won't appear
in the log until the order is next viewed (or acted upon) after its due
date passes; it does not appear the instant midnight strikes. This is a
deliberate, documented tradeoff to avoid a cron job for an optional feature.

Payment/refund line items are intentionally **not** duplicated into this
log — they already have their own detailed history (date, type, amount,
note) in the order's `payments` array / the "Payment history" table.

## CSV export (stretch goal)

`GET /api/orders/export` returns the current user's orders as CSV, filtered
by any combination of status, due-date range, and created-date range (all
optional). The same endpoint also supports `?format=json`, returning the
same rows as JSON instead of a file — this powers a "Preview" button on the
dashboard that shows matching orders in a table before you commit to
downloading, so the CSV download and the preview can never disagree about
which orders match a filter (they share one code path).

## REST API

Every response uses one consistent error shape:
`{ "error": { "message": "...", ...context } }` (e.g. payment-rejection
errors also include `maxAllowedCents`), with status codes used consistently:
`400` validation/business-rule violation, `401` unauthenticated, `404` not
found *or* not owned by the current user (deliberately indistinguishable —
the API never reveals whether another user's order id exists), `409`
conflict (locked order, duplicate email).

| Method & path | Description |
|---|---|
| `POST /api/auth/signup` | Create an account (email + password). |
| `POST /api/auth/callback/credentials` (Auth.js) | Log in. |
| `POST /api/auth/signout` (Auth.js) | Log out. |
| `GET /api/orders?status=` | List the current user's orders, with computed status; optional status filter. |
| `POST /api/orders` | Create an order (validates line items, computes subtotal/total server-side). |
| `GET /api/orders/:id` | Order detail — line items, payments, computed status. |
| `PATCH /api/orders/:id` | Edit an order. `409` once it has any payment/refund. |
| `DELETE /api/orders/:id` | Delete an order. `409` once it has any payment/refund. |
| `POST /api/orders/:id/payments` | Record a payment or refund (`{ type: "payment" \| "refund", amountCents, date, note? }`). `400` with `maxAllowedCents` on rejection. |
| `GET /api/orders/export?status=&dueFrom=&dueTo=&createdFrom=&createdTo=&format=` | CSV (default) or JSON (`format=json`) export of matching orders. |

Every `/api/orders*` route is protected by `src/proxy.ts` (Next.js 16's
renamed `middleware.ts`) and additionally scopes every database query by the
session's `userId` inside the route handler itself — never trusting a
client-supplied id.

## Frontend pages

- `/`, `/signup`, `/login` — public.
- `/dashboard` — order list (customer, status, total, paid, due, due date),
  status filter, CSV export panel with preview.
- `/orders/new` — create an order, dynamic line-item rows, live subtotal
  preview.
- `/orders/:id` — line items, payment history (with refunds distinguished),
  status history, record-payment/refund form ("Pay in full" / "Refund all"
  shortcuts), edit form (disabled once locked), delete.

## Assumptions & tradeoffs

- **A user's own order list is fetched in full and filtered/sorted in
  memory** (status filter, CSV export filters) rather than paginated. Status
  is derived, not stored, so it can't be filtered for in the database query
  directly. Fine at the scale of one user's own orders; would need a
  different approach (e.g. a stored, indexed status field recomputed by a
  background job) at a much larger scale.
- **Order total = subtotal.** The assignment doesn't mention tax or
  discounts, so there's no separate concept of them — line items sum
  directly to the total.
- **The overdue transition in the audit log is detected lazily** (documented
  above) rather than via a scheduled job, to keep the optional audit-log
  feature simple.
- **CSV date-range filters use whole days.** A `dueTo`/`createdTo` value
  includes the entirety of that day (the filter's upper bound is the start
  of the *next* day), since the inputs are plain dates without a time
  component.

## What we'd improve for production

- Rate limiting on auth endpoints.
- Pagination for the order list and CSV export once a user has a very large
  number of orders.
- A background job (rather than lazy, read-triggered detection) for the
  pending → overdue audit-log transition.
- Multi-document transactions if payments/refunds were ever split out of
  the order document into their own collection.
- A more general activity log (who changed what, not just status
  transitions) if that became a real requirement rather than an optional
  stretch goal.

## Deployment

1. Create a free MongoDB Atlas (M0) cluster and get its connection string.
2. Push this repo to GitHub and import it into Vercel.
3. Set `MONGODB_URI` and `AUTH_SECRET` as environment variables in Vercel.
4. Deploy, then run `npm run seed` locally against the same `MONGODB_URI`
   (or sign up fresh) to verify the sample scenario end-to-end on the live
   URL.
