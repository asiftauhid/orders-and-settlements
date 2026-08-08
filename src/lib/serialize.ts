import type { IOrder } from "@/lib/models/Order";
import { computeStatus } from "@/lib/logic/orderStatus";

/**
 * Converts a Mongoose Order document into a plain, JSON-friendly object for
 * API responses: string ids instead of ObjectIds, ISO date strings, and the
 * `status`/`amountDueCents`/`isLocked` fields computed fresh on every read
 * rather than trusted from the database.
 */
export function serializeOrder(order: IOrder) {
  const status = computeStatus({
    totalCents: order.totalCents,
    amountPaidCents: order.amountPaidCents,
    dueDate: order.dueDate,
  });

  return {
    id: order._id.toString(),
    customer: order.customer,
    dueDate: order.dueDate.toISOString(),
    lineItems: order.lineItems.map((item) => ({
      id: item._id.toString(),
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    payments: order.payments.map((payment) => ({
      id: payment._id.toString(),
      type: payment.type,
      amountCents: payment.amountCents,
      date: payment.date.toISOString(),
      note: payment.note ?? null,
      createdAt: payment.createdAt.toISOString(),
    })),
    subtotalCents: order.subtotalCents,
    totalCents: order.totalCents,
    amountPaidCents: order.amountPaidCents,
    amountDueCents: order.totalCents - order.amountPaidCents,
    statusHistory: order.statusHistory.map((entry) => ({
      status: entry.status,
      changedAt: entry.changedAt.toISOString(),
    })),
    status,
    // Once an order has any payment, the frontend should treat it as
    // read-only (aside from adding further payments) — this mirrors the
    // same rule the API enforces in PATCH/DELETE below.
    isLocked: order.payments.length > 0,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export type SerializedOrder = ReturnType<typeof serializeOrder>;
