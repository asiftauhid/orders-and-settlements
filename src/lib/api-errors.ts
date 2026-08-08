/**
 * Every API error in this app uses this same shape: { error: { message, ...context } }.
 * The optional context (e.g. `maxAllowedCents`) lets a client build an
 * actionable message instead of just showing generic error text.
 */
export function errorResponse(
  status: number,
  message: string,
  context?: Record<string, unknown>,
) {
  return Response.json({ error: { message, ...context } }, { status });
}
