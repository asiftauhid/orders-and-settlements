# Orders & Settlements

A small full-stack web application for users to create orders with line items, recording payments and refunds against them, and tracking what's owed and their status through the dashboard.

[Live Demo →](https://orders-and-settlements-five.vercel.app/)

---

### Contents

- [Walkthrough video](#walkthrough-video)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Data model](#data-model)
- [Order status](#order-status)
- [Payments, refunds, and concurrency](#payments-refunds-and-concurrency)
- [Some Other Features](#some-other-features)
- [REST API](#rest-api)
- [Frontend pages](#frontend-pages)
- [Assumptions and tradeoffs](#assumptions-and-tradeoffs)
- [What I'd change for production](#what-id-change-for-production)
- [Deployed URL](#deployed-url)

## Walkthrough video

[Watch the Full walkthrough Video (Google Drive) →](https://drive.google.com/file/d/1O2IfymrHphSXqpwt2zrIOxPZoTibdeCl/view?usp=sharing)

| Timestamp | Section                                      |
| --------- | -------------------------------------------- |
| 0:00      | Tech stack, File System, and README overview |
| 3:50      | REST API and Postman Demo                    |
| 5:35      | Unit Testing                                 |
| 6:15      | Live Application Demo                        |

---

## Tech stack

| Layer      | Choice                                                  |
| ---------- | ------------------------------------------------------- |
| Framework  | Next.js (App Router, TypeScript)                        |
| Database   | MongoDB Atlas + Mongoose                                |
| Auth       | Auth.js v5 (Credentials provider, JWT sessions, bcrypt) |
| Styling    | Tailwind CSS                                            |
| Validation | Zod                                                     |
| Testing    | Vitest                                                  |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in MONGODB_URI and AUTH_SECRET
npm run seed                 # optional: demo user + sample orders
npm run test                 # optional: runs the test suite
npm run dev
```

**Environment variables**

| Variable      | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| `MONGODB_URI` | MongoDB Atlas connection string.                             |
| `AUTH_SECRET` | Signs session JWTs. Generate with `openssl rand -base64 32`. |

> **Demo data**: `npm run seed` gives you a demo login (`demo@example.com` /
> `password123`) with four orders that cover every status plus a refund, so
> there's something to look at right away.
>
> **Tests**: `npm test` covers the core logic in `src/lib/logic/`: totals,
> status rules, payment and refund validation, status history, CSV
> formatting, and the Zod schemas.

## Data model

Only two main collections. And an order and all of its payments live in one Mongo document.

| Collection | Fields                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `User`     | `email`, `passwordHash`, `createdAt`                                                                                              |
| `Order`    | `userId`, `customer`, `dueDate`, `lineItems[]`, `payments[]`, `subtotalCents`, `totalCents`, `amountPaidCents`, `statusHistory[]` |

```
lineItems:     [{ description, quantity, unitPriceCents }]
payments:      [{ type: "payment" | "refund", amountCents, date, note }]
statusHistory: [{ status, changedAt }]
```

Keeping line items and payments inside the order (instead of their own
collections) means the "payments can never exceed the order total" rule
can be checked and applied in a single database write, no transaction
needed.

And Money is always stored as integer cents to avoid rounding issues,
and every order needs at least one line item, so a 0 item order can't happen.

## Order status

Status isn't stored. It's calculated fresh every time an order is read with the following logic:

```ts
function computeStatus(order, now = new Date()) {
  if (order.amountPaidCents >= order.totalCents) return "paid";
  if (now > order.dueDate) return "overdue";
  if (order.amountPaidCents > 0) return "partially_paid";
  return "pending";
}
```

"Overdue" depends on the current date, so storing it would mean it could go stale. So, calculating it on each read means it's always correct.

> 1. An order that's overdue but gets fully paid shows as `paid`, not
>    `overdue`.
> 2. An order that is `parcially_paid` and `overdue`, it'll show as `overdue`.
> 3. A refund can turn a `paid` order back into `partially_paid`, since the paid
>    amount actually dropped.

## Payments, refunds, and concurrency

The naive approach is: read the order, check the balance in code, then save.
That breaks if two payments arrive at once. Because both can read the same
remaining balance and both write, causing an overpayment.

Instead, I used one MongoDB operation that **checks the balance and applies
the payment together**. MongoDB won't apply the update unless the amount
still fits at that exact moment.

```ts
Order.findOneAndUpdate(
  {
    _id: orderId,
    userId,
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

If two payments arrive together, MongoDB applies one update first and the
payment is saved and `amountPaidCents` goes up. The other request is then
checked against that updated balance. If it no longer fits, MongoDB skips
the update and it rejects it with the current max allowed amount.

> **Rules:**
>
> - A payment can't make the Total Paid more than the Order Total.
> - A refund can't take the paid amount below zero.
> - Amounts must be positive whole cents.
> - Multiple payments and refunds are allowed, in any order.

<!-- ## Editability lock -->

## Some Other Features:

**Editability lock**: Once an order has a payment or refund on it, editing or deleting it returns a `409`. New payments and refunds can still be added, but editing the order details themselves are frozen. This is mainly to avoid a situation
where someone changes the line items or deletes the order after money has
already changed hands.

<!-- ## Stretch goals -->

**Audit log**: Every status change gets a timestamped entry in
`statusHistory`. Most transitions happen when something is written (eg. payment/refund), but going from `pending` to `overdue` happens purely
because time passed, with no write attached to it. And that one gets updated the next time the order is loaded (based on the exact due date), rather than through a background job.

**CSV export**: `/api/orders/export` can filter by status and by due date or
created date range. Add `?format=json` to get the same data back as JSON
instead of a file, which is what powers the preview table on the dashboard
before you actually download anything.

## REST API

Errors always come back as `{ "error": { "message": "...", ...context } }`.

| Status | Meaning                                                                 |
| ------ | ----------------------------------------------------------------------- |
| `400`  | Bad input or a broken business rule                                     |
| `401`  | Not logged in                                                           |
| `404`  | Doesn't exist, or isn't yours (no probing for other people's order ids) |
| `409`  | Conflict                                                                |

| Method & path                                                                    | What it does                          |
| -------------------------------------------------------------------------------- | ------------------------------------- |
| `POST /api/auth/signup`                                                          | Create an account                     |
| `POST /api/auth/callback/credentials` (Auth.js)                                  | Log in                                |
| `POST /api/auth/signout` (Auth.js)                                               | Log out                               |
| `GET /api/orders?status=`                                                        | List your orders                      |
| `POST /api/orders`                                                               | Create an order                       |
| `GET /api/orders/:id`                                                            | View an order                         |
| `PATCH /api/orders/:id`                                                          | Edit an order (blocked once locked)   |
| `DELETE /api/orders/:id`                                                         | Delete an order (blocked once locked) |
| `POST /api/orders/:id/payments`                                                  | Record a payment or refund            |
| `GET /api/orders/export?status=&dueFrom=&dueTo=&createdFrom=&createdTo=&format=` | Export as CSV or JSON                 |

**Postman notes**

- Base URL: `http://localhost:3000` or the deployed URL.
- Amounts are in **cents** (`50000` = $500.00).
- Replace `:id` with an order id from `POST /api/orders` or `GET /api/orders`.
- Order routes need a session cookie.

| Method & path                         | Example                                                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/signup`               | Body (JSON): `{ "email": "you@example.com", "password": "password123" }`                                                                                 |
| `POST /api/auth/callback/credentials` | Body (form-urlencoded): `email=you@example.com`, `password=password123`, `csrfToken=<token>`, `json=true`. Get `<token>` from `GET /api/auth/csrf`       |
| `POST /api/auth/signout`              | No body. Send session cookie.                                                                                                                            |
| `GET /api/orders`                     | No body. Optional: `?status=overdue` (`pending`, `partially_paid`, `paid`, `overdue`)                                                                    |
| `POST /api/orders`                    | Body (JSON): `{ "customer": "Acme Corp", "dueDate": "2026-03-01", "lineItems": [{ "description": "Widgets", "quantity": 2, "unitPriceCents": 50000 }] }` |
| `GET /api/orders/:id`                 | No body. Example: `GET /api/orders/67890abc...`                                                                                                          |
| `PATCH /api/orders/:id`               | Same JSON body as create. Only works before any payment/refund.                                                                                          |
| `DELETE /api/orders/:id`              | No body. Only works before any payment/refund.                                                                                                           |
| `POST /api/orders/:id/payments`       | Body (JSON): `{ "type": "payment", "amountCents": 40000, "date": "2026-01-15", "note": "Deposit" }` — omit `type` or use `"refund"`                      |
| `GET /api/orders/export`              | No body. Examples: `?format=json`, `?status=paid`, `?dueFrom=2026-01-01&dueTo=2026-01-31`, `?createdFrom=2026-01-01` — all filters optional              |

## Frontend pages

| Route                    | What's there                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `/`, `/signup`, `/login` | Public pages                                                                                                 |
| `/dashboard`             | Your orders, a status filter, and CSV export with preview                                                    |
| `/orders/new`            | Create an order with as many line items as you need                                                          |
| `/orders/:id`            | Line items, payment and status history, a form to record payments or refunds, and edit/delete while unlocked |

## Assumptions and tradeoffs

- Dashboard loads all the orders, and filters it on the server rather than paginating. Would need rethinking at real deployment scale.
- The order total is just the subtotal, no tax or discounts.
- CSV date filters count the whole day, not just a specific moment.

## What I'd change for production

- Rate limiting on login and signup.
- Pagination once order lists get big.
- Feature for invoicing.
- Grouping orders based on the same customers.
- A proper scheduled job under the hood for the overdue check, instead of catching it on read.

## Deployed URL

https://orders-and-settlements-five.vercel.app/
