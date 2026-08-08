import Link from "next/link";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Order } from "@/lib/models/Order";
import { serializeOrder } from "@/lib/serialize";
import { formatCents } from "@/lib/logic/money";
import type { OrderStatus } from "@/lib/logic/orderStatus";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusFilter } from "./StatusFilter";
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

  let serialized = orders.map(serializeOrder);
  if (statusFilter) {
    serialized = serialized.filter((order) => order.status === statusFilter);
  }

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

      <StatusFilter current={statusFilter} />

      <details className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Export CSV
        </summary>
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <ExportPanel />
        </div>
      </details>

      {serialized.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          {statusFilter
            ? "No orders match this filter."
            : "No orders yet, please create your first one."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Customer
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  Total
                </th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  Paid
                </th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  Due
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Due date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {serialized.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {order.customer}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCents(order.totalCents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCents(order.amountPaidCents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCents(order.amountDueCents)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {new Date(order.dueDate).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
