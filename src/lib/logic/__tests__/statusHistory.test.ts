import { describe, expect, it } from "vitest";
import { computeNextStatusHistory } from "../statusHistory";

describe("computeNextStatusHistory", () => {
  it("appends an entry when history is empty", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const result = computeNextStatusHistory([], "pending", now);
    expect(result).toEqual([{ status: "pending", changedAt: now }]);
  });

  it("returns the same array reference when status hasn't changed", () => {
    const history = [
      { status: "pending" as const, changedAt: new Date("2026-01-01T00:00:00Z") },
    ];
    const result = computeNextStatusHistory(
      history,
      "pending",
      new Date("2026-01-02T00:00:00Z"),
    );
    expect(result).toBe(history);
  });

  it("appends a new entry when status changed", () => {
    const history = [
      { status: "pending" as const, changedAt: new Date("2026-01-01T00:00:00Z") },
    ];
    const now = new Date("2026-01-05T00:00:00Z");
    const result = computeNextStatusHistory(history, "overdue", now);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ status: "overdue", changedAt: now });
    // Original history array is untouched.
    expect(history).toHaveLength(1);
  });

  it("supports a full pending -> partially_paid -> paid -> partially_paid (after refund) sequence", () => {
    let history: { status: "pending" | "partially_paid" | "paid" | "overdue"; changedAt: Date }[] = [];
    history = computeNextStatusHistory(history, "pending", new Date("2026-01-01T00:00:00Z"));
    history = computeNextStatusHistory(history, "partially_paid", new Date("2026-01-02T00:00:00Z"));
    history = computeNextStatusHistory(history, "paid", new Date("2026-01-03T00:00:00Z"));
    history = computeNextStatusHistory(history, "partially_paid", new Date("2026-01-04T00:00:00Z"));

    expect(history.map((entry) => entry.status)).toEqual([
      "pending",
      "partially_paid",
      "paid",
      "partially_paid",
    ]);
  });
});
