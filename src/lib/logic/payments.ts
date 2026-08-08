export interface PaymentValidationOrder {
  totalCents: number;
  amountPaidCents: number;
}

export type PaymentValidationResult =
  | { ok: true }
  | { ok: false; error: string; maxAllowedCents: number };

/** How much more can still be paid on this order, in cents. */
export function getRemainingBalanceCents(order: PaymentValidationOrder): number {
  return order.totalCents - order.amountPaidCents;
}

/**
 * Pure validation used by the API route before attempting the atomic DB
 * write, so we can return a fast, clear error without a query. The DB
 * write itself re-checks this same invariant atomically (see the
 * payments route) to stay correct under concurrent requests — this
 * function is the single source of truth for *why* an amount is invalid.
 */
export function validatePaymentAmount(
  amountCents: number,
  order: PaymentValidationOrder,
): PaymentValidationResult {
  const maxAllowedCents = getRemainingBalanceCents(order);

  if (amountCents < 1) {
    return {
      ok: false,
      error: "Payment amount must be at least $0.01",
      maxAllowedCents,
    };
  }

  if (amountCents > maxAllowedCents) {
    return {
      ok: false,
      error: `Payment exceeds the remaining balance. Maximum allowed is $${(
        maxAllowedCents / 100
      ).toFixed(2)}`,
      maxAllowedCents,
    };
  }

  return { ok: true };
}

/**
 * A refund can never exceed the amount currently paid on the order — you
 * can't refund money that was never received. `amountPaidCents` is the net
 * figure (payments minus prior refunds), so this composes correctly with
 * multiple payments/refunds over an order's life.
 */
export function validateRefundAmount(
  amountCents: number,
  order: PaymentValidationOrder,
): PaymentValidationResult {
  const maxAllowedCents = order.amountPaidCents;

  if (amountCents < 1) {
    return {
      ok: false,
      error: "Refund amount must be at least $0.01",
      maxAllowedCents,
    };
  }

  if (amountCents > maxAllowedCents) {
    return {
      ok: false,
      error: `Refund exceeds the amount paid on this order. Maximum allowed is $${(
        maxAllowedCents / 100
      ).toFixed(2)}`,
      maxAllowedCents,
    };
  }

  return { ok: true };
}
