export type OrderStatus = "pending" | "partially_paid" | "paid" | "overdue";

export interface OrderStatusInput {
  totalCents: number;
  amountPaidCents: number;
  dueDate: Date;
}

/**
 * Status is derived, never stored. "overdue" depends on wall-clock time
 * (not an event we write to the DB), so computing it fresh on every read
 * is the only way it can never go stale.
 *
 * Precedence matters: `paid` is checked first, so an order that was
 * overdue but has since been fully paid correctly shows as `paid`,
 * not `overdue`.
 *
 * `now` is a parameter (defaulting to the real clock) so this stays a
 * pure, easily-testable function instead of reaching for `Date.now()`
 * internally.
 */
export function computeStatus(
  order: OrderStatusInput,
  now: Date = new Date(),
): OrderStatus {
  if (order.amountPaidCents >= order.totalCents) {
    return "paid";
  }
  if (now > order.dueDate) {
    return "overdue";
  }
  if (order.amountPaidCents > 0) {
    return "partially_paid";
  }
  return "pending";
}
