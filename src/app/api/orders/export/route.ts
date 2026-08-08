import type { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Order } from "@/lib/models/Order";
import { exportOrdersQuerySchema } from "@/lib/validation";
import { serializeOrder } from "@/lib/serialize";
import { centsToDollars } from "@/lib/logic/money";
import { toCsv } from "@/lib/csv";
import { errorResponse } from "@/lib/api-errors";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const CSV_HEADERS = [
  "Customer",
  "Status",
  "Due Date",
  "Subtotal",
  "Total",
  "Amount Paid",
  "Amount Due",
  "Created At",
];

/** Query params carry dates without a time component, meaning "through the
 * end of that day" for an upper bound — so the Mongo filter uses an
 * exclusive `$lt` on the *next* day rather than `$lte` on the given date
 * (which would exclude that whole day due to the stored time-of-day). */
function endOfDayExclusive(date: Date): Date {
  return new Date(date.getTime() + ONE_DAY_MS);
}

/**
 * Shared by both the CSV download and the JSON preview (used by the
 * dashboard's "Preview" button) so the two can never drift out of sync on
 * which orders match a given filter.
 */
async function findMatchingOrderRows(
  userId: string,
  query: z.infer<typeof exportOrdersQuerySchema>,
) {
  await connectDB();

  const filter: Record<string, unknown> = { userId };
  if (query.dueFrom || query.dueTo) {
    filter.dueDate = {
      ...(query.dueFrom ? { $gte: query.dueFrom } : {}),
      ...(query.dueTo ? { $lt: endOfDayExclusive(query.dueTo) } : {}),
    };
  }
  if (query.createdFrom || query.createdTo) {
    filter.createdAt = {
      ...(query.createdFrom ? { $gte: query.createdFrom } : {}),
      ...(query.createdTo ? { $lt: endOfDayExclusive(query.createdTo) } : {}),
    };
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 });

  // Status is derived, not stored, so this filter (like the dashboard's)
  // is applied after serializing rather than in the DB query.
  let serialized = orders.map(serializeOrder);
  if (query.status) {
    serialized = serialized.filter((order) => order.status === query.status);
  }

  const rows = serialized.map((order) => [
    order.customer,
    order.status,
    order.dueDate.slice(0, 10),
    centsToDollars(order.subtotalCents).toFixed(2),
    centsToDollars(order.totalCents).toFixed(2),
    centsToDollars(order.amountPaidCents).toFixed(2),
    centsToDollars(order.amountDueCents).toFixed(2),
    order.createdAt.slice(0, 10),
  ]);

  return rows;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse(401, "Authentication required");
  }

  const { searchParams } = new URL(request.url);
  const parsed = exportOrdersQuerySchema.safeParse({
    status: searchParams.get("status") || undefined,
    dueFrom: searchParams.get("dueFrom") || undefined,
    dueTo: searchParams.get("dueTo") || undefined,
    createdFrom: searchParams.get("createdFrom") || undefined,
    createdTo: searchParams.get("createdTo") || undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const rows = await findMatchingOrderRows(session.user.id, parsed.data);

  // `?format=json` powers the dashboard's "Preview" button — same filters,
  // same rows, just returned as JSON for rendering instead of as a file
  // download. Anything other than "json" (including omitted) downloads
  // the actual CSV file.
  if (searchParams.get("format") === "json") {
    return Response.json({ headers: CSV_HEADERS, rows });
  }

  const csv = toCsv(CSV_HEADERS, rows);
  const filename = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
