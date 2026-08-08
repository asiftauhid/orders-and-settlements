import type { IOrder } from "@/lib/models/Order";
import { computeStatus, type OrderStatus } from "@/lib/logic/orderStatus";
import { computeNextStatusHistory } from "@/lib/logic/statusHistory";

/**
 * Appends a status-history entry (and saves) if the order's derived status
 * differs from the last logged entry. Called after every write that could
 * change status (create, edit, payment, refund) AND on plain reads — status
 * can also change purely from time passing (pending -> overdue) with no
 * write happening, so a read is the only chance to notice and log that
 * transition. See README's "Audit log" section for the full tradeoff.
 */
export async function syncStatusHistory(order: IOrder): Promise<OrderStatus> {
  const currentStatus = computeStatus({
    totalCents: order.totalCents,
    amountPaidCents: order.amountPaidCents,
    dueDate: order.dueDate,
  });

  const next = computeNextStatusHistory(order.statusHistory, currentStatus);
  if (next !== order.statusHistory) {
    order.statusHistory = next as IOrder["statusHistory"];
    await order.save();
  }

  return currentStatus;
}
