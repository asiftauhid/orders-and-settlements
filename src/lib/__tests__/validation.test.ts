import { describe, expect, it } from "vitest";
import {
  createOrderSchema,
  exportOrdersQuerySchema,
  recordPaymentSchema,
  signupSchema,
} from "../validation";

describe("createOrderSchema", () => {
  const validOrder = {
    customer: "Acme Corp",
    dueDate: "2026-02-01",
    lineItems: [{ description: "Widget", quantity: 2, unitPriceCents: 50000 }],
  };

  it("accepts a valid order", () => {
    const result = createOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("rejects an order with no line items (prevents the zero-total edge case)", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, lineItems: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a line item with quantity less than 1", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      lineItems: [{ description: "Widget", quantity: 0, unitPriceCents: 50000 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a line item with a non-integer unit price (must be whole cents)", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      lineItems: [{ description: "Widget", quantity: 1, unitPriceCents: 19.99 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing customer name", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, customer: "" });
    expect(result.success).toBe(false);
  });
});

describe("recordPaymentSchema", () => {
  it("accepts a valid payment", () => {
    const result = recordPaymentSchema.safeParse({
      amountCents: 40000,
      date: "2026-01-15",
      note: "Wire transfer",
    });
    expect(result.success).toBe(true);
  });

  it("allows an omitted note", () => {
    const result = recordPaymentSchema.safeParse({
      amountCents: 40000,
      date: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an amount below 1 cent", () => {
    const result = recordPaymentSchema.safeParse({
      amountCents: 0,
      date: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });

  it("defaults type to \"payment\" when omitted", () => {
    const result = recordPaymentSchema.safeParse({
      amountCents: 40000,
      date: "2026-01-15",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("payment");
    }
  });

  it("accepts an explicit \"refund\" type", () => {
    const result = recordPaymentSchema.safeParse({
      type: "refund",
      amountCents: 10000,
      date: "2026-01-15",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("refund");
    }
  });

  it("rejects an invalid type", () => {
    const result = recordPaymentSchema.safeParse({
      type: "chargeback",
      amountCents: 10000,
      date: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });
});

describe("exportOrdersQuerySchema", () => {
  it("accepts an empty query (no filters)", () => {
    const result = exportOrdersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a combination of status and date-range filters", () => {
    const result = exportOrdersQuerySchema.safeParse({
      status: "overdue",
      dueFrom: "2026-01-01",
      dueTo: "2026-01-31",
      createdFrom: "2025-12-01",
      createdTo: "2025-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = exportOrdersQuerySchema.safeParse({ status: "cancelled" });
    expect(result.success).toBe(false);
  });

  it("rejects an unparseable date", () => {
    const result = exportOrdersQuerySchema.safeParse({ dueFrom: "not-a-date" });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({ email: "not-an-email", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects a password under 8 characters", () => {
    const result = signupSchema.safeParse({ email: "a@example.com", password: "short" });
    expect(result.success).toBe(false);
  });

  it("lowercases and trims the email", () => {
    const result = signupSchema.safeParse({ email: "  User@Example.com  ", password: "password123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });
});
