// Shown instantly on navigation to /dashboard (including status-filter
// links) while the Server Component re-fetches orders, so clicks feel
// immediate instead of freezing the page for the DB round-trip.
export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 animate-pulse px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-9 w-28 rounded-md bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-7 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </div>

      <div className="mt-4 h-11 rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />

      <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-12 border-b border-zinc-200 bg-zinc-100 last:border-0 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  );
}
