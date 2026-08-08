import { describe, expect, it } from "vitest";
import { centsToDollars, dollarsToCents, formatCents } from "../money";

describe("money conversion helpers", () => {
  it("converts dollars to cents", () => {
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(500)).toBe(50000);
  });

  it("rounds to the nearest cent to avoid float drift (e.g. 0.1 + 0.2 issues)", () => {
    expect(dollarsToCents(19.999)).toBe(2000);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30); // would be 29 with naive floor
  });

  it("converts cents back to dollars", () => {
    expect(centsToDollars(1999)).toBe(19.99);
    expect(centsToDollars(50000)).toBe(500);
  });

  it("formats cents as a USD currency string", () => {
    expect(formatCents(1999)).toBe("$19.99");
    expect(formatCents(100000)).toBe("$1,000.00");
    expect(formatCents(0)).toBe("$0.00");
  });
});
