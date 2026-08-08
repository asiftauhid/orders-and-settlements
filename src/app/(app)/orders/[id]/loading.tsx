// Shown instantly when navigating to an order's detail page while the
// Server Component fetches that order, so the click feels immediate
// instead of freezing the previous page for the DB round-trip.
export default function OrderDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 animate-pulse px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="h-7 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-4 dark:border-zinc-800">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-3 w-14 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-5 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>

      <div className="mb-8 h-40 rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      <div className="h-32 rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
    </div>
  );
}
