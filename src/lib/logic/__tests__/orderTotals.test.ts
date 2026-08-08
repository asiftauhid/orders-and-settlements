import { describe, expect, it } from "vitest";
import { computeOrderTotals } from "../orderTotals";

describe("computeOrderTotals", () => {
  it("computes subtotal as sum of quantity x unit price", () => {
    // The assignment's sample scenario: 2 x $500 = $1000
    const result = computeOrderTotals([
      { quantity: 2, unitPriceCents: 50000 },
    ]);

    expect(result.subtotalCents).toBe(100000);
  });

  it("sums across multiple line items", () => {
    const result = computeOrderTotals([
      { quantity: 2, unitPriceCents: 50000 }, // $1000
      { quantity: 3, unitPriceCents: 1000 }, // $30
      { quantity: 1, unitPriceCents: 999 }, // $9.99
    ]);

    expect(result.subtotalCents).toBe(100000 + 3000 + 999);
  });

  it("sets total equal to subtotal (no tax/discount in this assignment)", () => {
    const result = computeOrderTotals([
      { quantity: 1, unitPriceCents: 12345 },
    ]);

    expect(result.totalCents).toBe(result.subtotalCents);
  });

  it("returns zero for an empty list (validation prevents this in practice)", () => {
    const result = computeOrderTotals([]);

    expect(result.subtotalCents).toBe(0);
    expect(result.totalCents).toBe(0);
  });
});
