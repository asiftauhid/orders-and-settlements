import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface ILineItem {
  _id: Types.ObjectId;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export type PaymentType = "payment" | "refund";

export interface IPayment {
  _id: Types.ObjectId;
  type: PaymentType;
  amountCents: number;
  date: Date;
  note?: string;
  createdAt: Date;
}

export type OrderStatusName = "pending" | "partially_paid" | "paid" | "overdue";

export interface IStatusHistoryEntry {
  status: OrderStatusName;
  changedAt: Date;
}

export interface IOrder extends Document {
  userId: Types.ObjectId;
  customer: string;
  dueDate: Date;
  lineItems: ILineItem[];
  payments: IPayment[];
  subtotalCents: number;
  totalCents: number;
  amountPaidCents: number;
  statusHistory: IStatusHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// Whole-number cents only
function isNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0;
}

const LineItemSchema = new Schema<ILineItem>({
  description: { type: String, required: true, trim: true },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: "quantity must be a whole number",
    },
  },
  unitPriceCents: {
    type: Number,
    required: true,
    validate: {
      validator: isNonNegativeInteger,
      message: "unitPriceCents must be a non-negative whole number of cents",
    },
  },
});

const PaymentSchema = new Schema<IPayment>({
  // "refund" entries represent money returned to the customer. Both types
  // store a positive amountCents; the sign/direction is carried by `type`,
  // not by a negative number, so amounts are never ambiguous to read or
  // validate.
  type: {
    type: String,
    enum: ["payment", "refund"],
    required: true,
    default: "payment",
  },
  amountCents: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: "amountCents must be a whole number of cents",
    },
  },
  date: { type: Date, required: true },
  note: { type: String, trim: true },
  createdAt: { type: Date, default: () => new Date() },
});

const StatusHistorySchema = new Schema<IStatusHistoryEntry>(
  {
    status: {
      type: String,
      required: true,
      enum: ["pending", "partially_paid", "paid", "overdue"],
    },
    changedAt: { type: Date, required: true },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customer: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true },
    lineItems: {
      type: [LineItemSchema],
      required: true,
      validate: {
        validator: (items: ILineItem[]) => items.length >= 1,
        message: "An order must have at least one line item",
      },
    },
    payments: { type: [PaymentSchema], default: [] },
    subtotalCents: {
      type: Number,
      required: true,
      validate: isNonNegativeInteger,
    },
    totalCents: {
      type: Number,
      required: true,
      validate: isNonNegativeInteger,
    },
    // Net amount paid: sum of payments minus sum of refunds. Kept as a
    // single stored counter (rather than summed from `payments` on every
    // read) so the atomic $inc-based concurrency control in the payments
    // route works for both payments (+amount) and refunds (-amount).
    amountPaidCents: {
      type: Number,
      required: true,
      default: 0,
      validate: isNonNegativeInteger,
    },
    // Audit log of status transitions (stretch goal). Appended to whenever
    // the derived status actually changes — see src/lib/statusHistorySync.ts
    // for why this needs to be checked on reads too, not just writes.
    statusHistory: { type: [StatusHistorySchema], default: [] },
  },
  { timestamps: true },
);

export const Order: Model<IOrder> =
  (mongoose.models.Order as Model<IOrder>) ||
  mongoose.model<IOrder>("Order", OrderSchema);
