export interface LineItemInput {
  quantity: number;
  unitPriceCents: number;
}

export interface OrderTotals {
  subtotalCents: number;
  totalCents: number;
}

/**
 * Subtotal = sum of (quantity x unit price) across all lines.
 * Total = subtotal for this assignment (no order-level tax/discount).
 * Integer cents in, integer cents out — no floats involved.
 */
export function computeOrderTotals(lineItems: LineItemInput[]): OrderTotals {
  const subtotalCents = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0,
  );

  return {
    subtotalCents,
    totalCents: subtotalCents,
  };
}
