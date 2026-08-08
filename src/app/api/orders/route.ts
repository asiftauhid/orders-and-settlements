import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Order } from "@/lib/models/Order";
import { createOrderSchema } from "@/lib/validation";
import { computeOrderTotals } from "@/lib/logic/orderTotals";
import { computeStatus, type OrderStatus } from "@/lib/logic/orderStatus";
import { serializeOrder } from "@/lib/serialize";
import { errorResponse } from "@/lib/api-errors";

const VALID_STATUSES: OrderStatus[] = [
  "pending",
  "partially_paid",
  "paid",
  "overdue",
];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse(401, "Authentication required");
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  if (
    statusFilter &&
    !VALID_STATUSES.includes(statusFilter as OrderStatus)
  ) {
    return errorResponse(
      400,
      `Invalid status filter. Must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  await connectDB();

  // Status is derived, not stored, so we can't filter in the DB query —
  // fetch this user's orders and filter after serializing. Fine at this
  // scale (a user's own order list); would need a different approach
  // (e.g. a stored+indexed status field) if this needed to paginate
  // across a huge number of orders.
  const orders = await Order.find({ userId: session.user.id }).sort({
    createdAt: -1,
  });

  let serialized = orders.map(serializeOrder);
  if (statusFilter) {
    serialized = serialized.filter((order) => order.status === statusFilter);
  }

  return Response.json({ orders: serialized });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse(401, "Authentication required");
  }

  const body = await request.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const { subtotalCents, totalCents } = computeOrderTotals(
    parsed.data.lineItems,
  );

  const initialStatus = computeStatus({
    totalCents,
    amountPaidCents: 0,
    dueDate: parsed.data.dueDate,
  });

  const order = await Order.create({
    userId: session.user.id,
    customer: parsed.data.customer,
    dueDate: parsed.data.dueDate,
    lineItems: parsed.data.lineItems,
    payments: [],
    subtotalCents,
    totalCents,
    amountPaidCents: 0,
    statusHistory: [{ status: initialStatus, changedAt: new Date() }],
  });

  return Response.json({ order: serializeOrder(order) }, { status: 201 });
}
