/**
 * All money in this app is stored and computed as integer cents to avoid
 * floating-point rounding errors (e.g. 0.1 + 0.2 !== 0.3 in JS floats).
 * These helpers are the ONLY place dollars <-> cents conversion happens,
 * so the conversion logic isn't duplicated across forms/components.
 */

/** Converts a dollar amount (e.g. 19.99) to integer cents (1999). */
export function dollarsToCents(dollars: number): number {
  if (!Number.isFinite(dollars)) {
    throw new Error("dollars must be a finite number");
  }
  return Math.round(dollars * 100);
}

/** Converts integer cents (1999) to a dollar amount (19.99). */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Formats integer cents as a display string, e.g. 1999 -> "$19.99". */
export function formatCents(cents: number): string {
  return centsToDollars(cents).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
