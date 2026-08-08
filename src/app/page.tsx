import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 text-center dark:bg-black">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Orders and Settlements
        </h1>
        <p className="mt-2 max-w-md text-zinc-600 dark:text-zinc-400">
          Create orders, record payments, and track what&apos;s due.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
