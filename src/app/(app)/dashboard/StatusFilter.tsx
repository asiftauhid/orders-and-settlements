import Link from "next/link";
import type { OrderStatus } from "@/lib/logic/orderStatus";

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

export function StatusFilter({ current }: { current?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterPill href="/dashboard" isActive={!current}>
        All
      </FilterPill>
      {STATUS_OPTIONS.map((option) => (
        <FilterPill
          key={option.value}
          href={`/dashboard?status=${option.value}`}
          isActive={current === option.value}
        >
          {option.label}
        </FilterPill>
      ))}
    </div>
  );
}

function FilterPill({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        isActive
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
          : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      }`}
    >
      {children}
    </Link>
  );
}
