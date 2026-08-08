import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

// `(app)` is a route group — the parentheses keep it out of the URL, so
// this layout applies to /dashboard and /orders/* without changing their paths.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <Link
            href="/dashboard"
            className="font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Orders and Settlements
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
