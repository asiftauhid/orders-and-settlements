import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Order } from "@/lib/models/Order";
import { recordPaymentSchema } from "@/lib/validation";
import { validatePaymentAmount, validateRefundAmount } from "@/lib/logic/payments";
import { serializeOrder } from "@/lib/serialize";
import { errorResponse } from "@/lib/api-errors";
import { syncStatusHistory } from "@/lib/statusHistorySync";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse(401, "Authentication required");
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return errorResponse(404, "Order not found");
  }

  const body = await request.json().catch(() => null);
  const parsed = recordPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { type, amountCents, date, note } = parsed.data;
  const isRefund = type === "refund";

  await connectDB();

  const order = await Order.findOne({ _id: id, userId: session.user.id });
  if (!order) {
    return errorResponse(404, "Order not found");
  }

  // Fast, clear rejection for the common (non-concurrent) case, using the
  // order state as we just read it.
  const precheck = isRefund
    ? validateRefundAmount(amountCents, order)
    : validatePaymentAmount(amountCents, order);
  if (!precheck.ok) {
    return errorResponse(400, precheck.error, {
      maxAllowedCents: precheck.maxAllowedCents,
    });
  }

  // Atomic write: the filter re-checks "does this still fit the invariant"
  // (payment <= remaining balance, or refund <= amount paid) at the exact
  // instant of the write, against whatever the document's current state is
  // in MongoDB — not the possibly-stale copy we read above. If a concurrent
  // request already changed the balance between our read and this write,
  // this filter no longer matches and MongoDB returns null instead of
  // applying the update. This is what actually prevents a race-condition
  // over-payment/over-refund (see README's "Concurrency" section).
  const balanceExpr = isRefund
    ? // Refund: new amountPaidCents (after subtracting) must stay >= 0.
      { $gte: [{ $subtract: ["$amountPaidCents", amountCents] }, 0] }
    : // Payment: new amountPaidCents (after adding) must not exceed total.
      {
        $lte: [{ $add: ["$amountPaidCents", amountCents] }, "$totalCents"],
      };

  const updated = await Order.findOneAndUpdate(
    {
      _id: id,
      userId: session.user.id,
      $expr: balanceExpr,
    },
    {
      $push: {
        payments: { type, amountCents, date, note },
      },
      $inc: { amountPaidCents: isRefund ? -amountCents : amountCents },
    },
    { new: true, runValidators: true },
  );

  if (!updated) {
    // Lost the race: another payment/refund landed between our precheck
    // and this write. Re-fetch to report the now-current (changed) limit
    // rather than the stale number from the precheck above.
    const latest = await Order.findOne({ _id: id, userId: session.user.id });
    const maxAllowedCents = latest
      ? isRefund
        ? latest.amountPaidCents
        : latest.totalCents - latest.amountPaidCents
      : 0;
    return errorResponse(
      400,
      isRefund
        ? `Refund exceeds the amount paid on this order. Maximum allowed is $${(
            maxAllowedCents / 100
          ).toFixed(2)}`
        : `Payment exceeds the remaining balance. Maximum allowed is $${(
            maxAllowedCents / 100
          ).toFixed(2)}`,
      { maxAllowedCents },
    );
  }

  // A payment/refund can move status between pending/partially_paid/paid/
  // overdue — log it if it did.
  await syncStatusHistory(updated);

  return Response.json({ order: serializeOrder(updated) }, { status: 201 });
}
