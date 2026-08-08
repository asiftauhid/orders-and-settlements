import { describe, expect, it } from "vitest";
import { computeStatus } from "../orderStatus";

const FIXED_NOW = new Date("2026-01-15T00:00:00Z");
const FUTURE_DUE_DATE = new Date("2026-01-22T00:00:00Z"); // 7 days out
const PAST_DUE_DATE = new Date("2026-01-01T00:00:00Z");

describe("computeStatus", () => {
  it("is pending when no payments have been recorded", () => {
    const status = computeStatus(
      { totalCents: 100000, amountPaidCents: 0, dueDate: FUTURE_DUE_DATE },
      FIXED_NOW,
    );

    expect(status).toBe("pending");
  });

  it("is partially_paid when some but not all has been paid", () => {
    // Assignment sample scenario, step 2: $400 paid on a $1000 order
    const status = computeStatus(
      { totalCents: 100000, amountPaidCents: 40000, dueDate: FUTURE_DUE_DATE },
      FIXED_NOW,
    );

    expect(status).toBe("partially_paid");
  });

  it("is paid when amount paid equals the total", () => {
    // Assignment sample scenario, step 3: $400 + $600 = $1000 paid in full
    const status = computeStatus(
      { totalCents: 100000, amountPaidCents: 100000, dueDate: FUTURE_DUE_DATE },
      FIXED_NOW,
    );

    expect(status).toBe("paid");
  });

  it("is overdue when past the due date and not fully paid", () => {
    const status = computeStatus(
      { totalCents: 100000, amountPaidCents: 0, dueDate: PAST_DUE_DATE },
      FIXED_NOW,
    );

    expect(status).toBe("overdue");
  });

  it("is overdue when past due date even with a partial payment", () => {
    const status = computeStatus(
      { totalCents: 100000, amountPaidCents: 40000, dueDate: PAST_DUE_DATE },
      FIXED_NOW,
    );

    expect(status).toBe("overdue");
  });

  it("edge case: paid wins over overdue — an order paid in full after its due date is `paid`, not `overdue`", () => {
    const status = computeStatus(
      { totalCents: 100000, amountPaidCents: 100000, dueDate: PAST_DUE_DATE },
      FIXED_NOW,
    );

    expect(status).toBe("paid");
  });

  it("edge case: is not overdue exactly on the due date (strict greater-than)", () => {
    const status = computeStatus(
      { totalCents: 100000, amountPaidCents: 0, dueDate: FIXED_NOW },
      FIXED_NOW,
    );

    expect(status).toBe("pending");
  });
});
