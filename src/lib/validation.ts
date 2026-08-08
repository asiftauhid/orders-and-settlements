import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  unitPriceCents: z
    .number()
    .int("Unit price must be a whole number of cents")
    .min(0, "Unit price cannot be negative"),
});

export const createOrderSchema = z.object({
  customer: z.string().trim().min(1, "Customer name is required"),
  dueDate: z.coerce.date({ message: "Enter a valid due date" }),
  lineItems: z
    .array(lineItemSchema)
    .min(1, "An order must have at least one line item"),
});

// Editing an order only allows changing the same fields it was created
// with — status/totals/payments are never client-writable.
export const updateOrderSchema = createOrderSchema;

export const recordPaymentSchema = z.object({
  type: z.enum(["payment", "refund"]).default("payment"),
  amountCents: z
    .number()
    .int("Amount must be a whole number of cents")
    .min(1, "Amount must be at least $0.01"),
  date: z.coerce.date({ message: "Enter a valid date" }),
  note: z.string().trim().max(500).optional(),
});

const optionalDateParam = z
  .coerce.date()
  .refine((date) => !Number.isNaN(date.getTime()), "Enter a valid date")
  .optional();

// Query params for the CSV export endpoint. Every field is optional and
// independently combinable: a due-date range, a created-date range, and/or
// a status filter can all be applied together.
export const exportOrdersQuerySchema = z.object({
  status: z.enum(["pending", "partially_paid", "paid", "overdue"]).optional(),
  dueFrom: optionalDateParam,
  dueTo: optionalDateParam,
  createdFrom: optionalDateParam,
  createdTo: optionalDateParam,
});
