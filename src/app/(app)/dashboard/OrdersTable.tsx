"use client";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCents } from "@/lib/logic/money";
import type { OrderStatus } from "@/lib/logic/orderStatus";
import { StatusBadge } from "@/components/StatusBadge";
import type { SerializedOrder } from "@/lib/serialize";

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

// Small dot that only renders while its parent <Link> navigation is
// pending, so clicking into an order gives instant visual feedback even
// though the destination still needs a real server fetch.
function PendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-400 align-middle dark:bg-zinc-500" />
  );
}

export function OrdersTable({
  orders,
  initialStatus,
}: {
  orders: SerializedOrder[];
  initialStatus?: OrderStatus;
}) {
  // All orders are fetched once on the server; filtering here is a plain
  // in-memory operation, so switching filters is instant instead of
  // round-tripping to the DB for data we already have.
  const [status, setStatus] = useState<OrderStatus | undefined>(initialStatus);
  const router = useRouter();

  function selectStatus(next: OrderStatus | undefined) {
    setStatus(next);
    // Keep the URL shareable/bookmarkable, but don't block the UI on it —
    // the table above already updated from local state.
    router.replace(next ? `/dashboard?status=${next}` : "/dashboard", {
      scroll: false,
    });
  }

  const filtered = status
    ? orders.filter((order) => order.status === status)
    : orders;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <FilterPill isActive={!status} onClick={() => selectStatus(undefined)}>
          All
        </FilterPill>
        {STATUS_OPTIONS.map((option) => (
          <FilterPill
            key={option.value}
            isActive={status === option.value}
            onClick={() => selectStatus(option.value)}
          >
            {option.label}
          </FilterPill>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          {status ? "No orders match this filter." : "No orders yet, please create your first one."}
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
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${order.id}`}
                      className="inline-flex items-center font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {order.customer}
                      <PendingDot />
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
    </>
  );
}

function FilterPill({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        isActive
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
          : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      }`}
    >
      {children}
    </button>
  );
}
