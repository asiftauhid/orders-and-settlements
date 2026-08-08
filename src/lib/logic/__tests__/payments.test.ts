import { describe, expect, it } from "vitest";
import {
  getRemainingBalanceCents,
  validatePaymentAmount,
  validateRefundAmount,
} from "../payments";

describe("payment allocation — the assignment's sample scenario", () => {
  it("walks through: $1000 order -> $400 payment -> $600 payment -> reject $1", () => {
    let order = { totalCents: 100000, amountPaidCents: 0 };
    expect(getRemainingBalanceCents(order)).toBe(100000);

    // Record payment of $400
    const first = validatePaymentAmount(40000, order);
    expect(first.ok).toBe(true);
    order = { ...order, amountPaidCents: order.amountPaidCents + 40000 };
    expect(getRemainingBalanceCents(order)).toBe(60000);

    // Record payment of $600 -> fully paid
    const second = validatePaymentAmount(60000, order);
    expect(second.ok).toBe(true);
    order = { ...order, amountPaidCents: order.amountPaidCents + 60000 };
    expect(getRemainingBalanceCents(order)).toBe(0);

    // Attempt another $1 payment -> rejected
    const third = validatePaymentAmount(100, order);
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.maxAllowedCents).toBe(0);
      expect(third.error).toMatch(/exceeds the remaining balance/i);
    }
  });
});

describe("validatePaymentAmount", () => {
  const order = { totalCents: 100000, amountPaidCents: 40000 };

  it("rejects amounts below 1 cent ($0.01)", () => {
    const result = validatePaymentAmount(0, order);
    expect(result.ok).toBe(false);
  });

  it("rejects negative amounts", () => {
    const result = validatePaymentAmount(-500, order);
    expect(result.ok).toBe(false);
  });

  it("accepts a payment that exactly matches the remaining balance", () => {
    const result = validatePaymentAmount(60000, order);
    expect(result.ok).toBe(true);
  });

  it("rejects a payment of even 1 cent over the remaining balance", () => {
    const result = validatePaymentAmount(60001, order);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.maxAllowedCents).toBe(60000);
    }
  });

  it("rejects any payment on an already fully-paid order, with maxAllowed 0", () => {
    const paidOrder = { totalCents: 100000, amountPaidCents: 100000 };
    const result = validatePaymentAmount(1, paidOrder);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.maxAllowedCents).toBe(0);
    }
  });
});

describe("validateRefundAmount", () => {
  const order = { totalCents: 100000, amountPaidCents: 40000 };

  it("rejects amounts below 1 cent", () => {
    const result = validateRefundAmount(0, order);
    expect(result.ok).toBe(false);
  });

  it("accepts a refund that exactly matches the amount paid", () => {
    const result = validateRefundAmount(40000, order);
    expect(result.ok).toBe(true);
  });

  it("rejects a refund of even 1 cent more than the amount paid", () => {
    const result = validateRefundAmount(40001, order);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.maxAllowedCents).toBe(40000);
    }
  });

  it("rejects any refund on an order with nothing paid yet, with maxAllowed 0", () => {
    const unpaidOrder = { totalCents: 100000, amountPaidCents: 0 };
    const result = validateRefundAmount(1, unpaidOrder);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.maxAllowedCents).toBe(0);
    }
  });

  it("supports a full payment-then-refund-then-repayment cycle", () => {
    let order = { totalCents: 100000, amountPaidCents: 0 };

    // Pay in full.
    expect(validatePaymentAmount(100000, order).ok).toBe(true);
    order = { ...order, amountPaidCents: 100000 };

    // Refund it all.
    expect(validateRefundAmount(100000, order).ok).toBe(true);
    order = { ...order, amountPaidCents: 0 };
    expect(getRemainingBalanceCents(order)).toBe(100000);

    // Can pay again from scratch.
    expect(validatePaymentAmount(100000, order).ok).toBe(true);
  });
});
