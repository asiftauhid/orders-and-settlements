import type { OrderStatus } from "@/lib/logic/orderStatus";

export interface StatusHistoryEntry {
  status: OrderStatus;
  changedAt: Date;
}

/**
 * Pure decision of whether a new status-history entry should be appended.
 * Returns the *same* array reference when nothing changed (so callers can
 * cheaply check `result !== history` to decide whether a write is needed),
 * or a new array with one entry appended when the status actually changed.
 *
 * `now` is a parameter (not `Date.now()` internally) to keep this testable,
 * matching the same pattern as `computeStatus`.
 */
export function computeNextStatusHistory(
  history: StatusHistoryEntry[],
  currentStatus: OrderStatus,
  now: Date = new Date(),
): StatusHistoryEntry[] {
  const last = history[history.length - 1];
  if (last && last.status === currentStatus) {
    return history;
  }
  return [...history, { status: currentStatus, changedAt: now }];
}
