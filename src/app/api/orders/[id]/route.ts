import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Order, type IOrder } from "@/lib/models/Order";
import { updateOrderSchema } from "@/lib/validation";
import { computeOrderTotals } from "@/lib/logic/orderTotals";
import { serializeOrder } from "@/lib/serialize";
import { errorResponse } from "@/lib/api-errors";
import { syncStatusHistory } from "@/lib/statusHistorySync";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const LOCKED_MESSAGE =
  "This order has recorded payments and is locked. Only new payments may be added.";

/**
 * Looks up an order scoped to the current user. Returns null both when the
 * order doesn't exist AND when it belongs to someone else — deliberately
 * indistinguishable, so the API never reveals whether another user's order
 * id exists (a 404 either way, not a 403).
 */
async function findOwnedOrder(
  id: string,
  userId: string,
): Promise<InstanceType<typeof Order> | null> {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }
  return Order.findOne({ _id: id, userId });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse(401, "Authentication required");
  }

  const { id } = await params;
  await connectDB();

  const order = await findOwnedOrder(id, session.user.id);
  if (!order) {
    return errorResponse(404, "Order not found");
  }

  // Status can change purely from time passing (pending -> overdue), with
  // no write ever happening. Reading the order is our only chance to
  // notice that and log it — see statusHistorySync.ts.
  await syncStatusHistory(order);

  return Response.json({ order: serializeOrder(order) });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse(401, "Authentication required");
  }

  const { id } = await params;
  await connectDB();

  const order = await findOwnedOrder(id, session.user.id);
  if (!order) {
    return errorResponse(404, "Order not found");
  }

  if (order.payments.length > 0) {
    return errorResponse(409, LOCKED_MESSAGE);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { subtotalCents, totalCents } = computeOrderTotals(
    parsed.data.lineItems,
  );

  order.customer = parsed.data.customer;
  order.dueDate = parsed.data.dueDate;
  // Mongoose casts these plain objects into subdocuments and assigns each
  // a fresh `_id` automatically.
  order.lineItems = parsed.data.lineItems as unknown as IOrder["lineItems"];
  order.subtotalCents = subtotalCents;
  order.totalCents = totalCents;
  await order.save();
  // A due-date edit can move status between pending/overdue (only unlocked,
  // unpaid orders reach here, so this can't affect paid/partially_paid).
  await syncStatusHistory(order);

  return Response.json({ order: serializeOrder(order) });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse(401, "Authentication required");
  }

  const { id } = await params;
  await connectDB();

  const order = await findOwnedOrder(id, session.user.id);
  if (!order) {
    return errorResponse(404, "Order not found");
  }

  if (order.payments.length > 0) {
    return errorResponse(
      409,
      "This order has recorded payments and cannot be deleted — payment history must be preserved.",
    );
  }

  await order.deleteOne();

  return new Response(null, { status: 204 });
}
