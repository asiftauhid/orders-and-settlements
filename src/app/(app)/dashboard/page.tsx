import Link from "next/link";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Order } from "@/lib/models/Order";
import { serializeOrder } from "@/lib/serialize";
import type { OrderStatus } from "@/lib/logic/orderStatus";
import { OrdersTable } from "./OrdersTable";
import { ExportPanel } from "./ExportPanel";

const VALID_STATUSES: OrderStatus[] = [
  "pending",
  "partially_paid",
  "paid",
  "overdue",
];

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const searchParams = await props.searchParams;
  const rawStatus = searchParams.status;
  const statusFilter =
    typeof rawStatus === "string" && VALID_STATUSES.includes(rawStatus as OrderStatus)
      ? (rawStatus as OrderStatus)
      : undefined;

  // proxy.ts already guarantees a session exists for this route; `auth()`
  // here just gets us the user id to scope the query by.
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  await connectDB();
  const orders = await Order.find({ userId: session.user.id }).sort({
    createdAt: -1,
  });

  // Filtering by status happens client-side in <OrdersTable> since we
  // already have every order in hand — no need to round-trip to the DB
  // again just to show a subset of data we already fetched.
  const serialized = orders.map(serializeOrder);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Orders
        </h1>
        <Link
          href="/orders/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New order
        </Link>
      </div>

      <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Export CSV
        </summary>
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <ExportPanel />
        </div>
      </details>

      <div className="mt-4">
        <OrdersTable orders={serialized} initialStatus={statusFilter} />
      </div>
    </div>
  );
}
