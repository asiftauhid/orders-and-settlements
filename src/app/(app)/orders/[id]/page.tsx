import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Order } from "@/lib/models/Order";
import { serializeOrder } from "@/lib/serialize";
import { formatCents, centsToDollars } from "@/lib/logic/money";
import { StatusBadge } from "@/components/StatusBadge";
import { RecordPaymentForm } from "./RecordPaymentForm";
import { EditOrderSection } from "./EditOrderSection";
import { DeleteOrderButton } from "./DeleteOrderButton";

export default async function OrderDetailPage(props: PageProps<"/orders/[id]">) {
  const { id } = await props.params;

  const session = await auth();
  if (!session?.user) {
    return null; // proxy.ts guarantees this route is never reached unauthenticated
  }

  await connectDB();

  // Invalid id format and "not found" both surface as the same 404 page —
  // same reasoning as the API: never reveal whether an id belongs to
  // someone else.
  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  const order = await Order.findOne({ _id: id, userId: session.user.id });
  if (!order) {
    notFound();
  }

  const serialized = serializeOrder(order);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {serialized.customer}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Due {new Date(serialized.dueDate).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={serialized.status} />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 p-4 text-center sm:grid-cols-4 dark:border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Subtotal</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {formatCents(serialized.subtotalCents)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Order total</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {formatCents(serialized.totalCents)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Paid</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {formatCents(serialized.amountPaidCents)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Due</p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {formatCents(serialized.amountDueCents)}
          </p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Line items
        </h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  Description
                </th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  Qty
                </th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  Unit price
                </th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  Line total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {serialized.lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2">{item.description}</td>
                  <td className="px-4 py-2 text-right">{item.quantity}</td>
                  <td className="px-4 py-2 text-right">
                    {formatCents(item.unitPriceCents)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCents(item.quantity * item.unitPriceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Payment history
        </h2>
        {serialized.payments.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No payments recorded yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                    Type
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {serialized.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-2">
                      {new Date(payment.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      {payment.type === "refund" ? (
                        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                          Refund
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                          Payment
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${
                        payment.type === "refund"
                          ? "text-red-700 dark:text-red-400"
                          : ""
                      }`}
                    >
                      {payment.type === "refund" ? "−" : ""}
                      {formatCents(payment.amountCents)}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {payment.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8">
        <RecordPaymentForm
          orderId={serialized.id}
          amountDueCents={serialized.amountDueCents}
          amountPaidCents={serialized.amountPaidCents}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Status history
        </h2>
        <ul className="flex flex-col gap-2">
          {[...serialized.statusHistory].reverse().map((entry, index) => (
            <li
              key={`${entry.status}-${entry.changedAt}-${index}`}
              className="flex items-center gap-3 text-sm"
            >
              <StatusBadge status={entry.status} />
              <span className="text-zinc-500 dark:text-zinc-400">
                {new Date(entry.changedAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-start justify-between gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        {serialized.isLocked ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {serialized.status === "paid"
              ? "This order is fully paid."
              : "This order has recorded payments, so it's locked. Only new payments can be added."}
          </p>
        ) : (
          <>
            <EditOrderSection
              orderId={serialized.id}
              initialValues={{
                customer: serialized.customer,
                dueDate: serialized.dueDate.slice(0, 10),
                lineItems: serialized.lineItems.map((item) => ({
                  description: item.description,
                  quantity: String(item.quantity),
                  unitPrice: centsToDollars(item.unitPriceCents).toFixed(2),
                })),
              }}
            />
            <DeleteOrderButton orderId={serialized.id} />
          </>
        )}
      </section>
    </div>
  );
}
