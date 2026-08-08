"use client";

import { useState } from "react";
import type { OrderStatus } from "@/lib/logic/orderStatus";

const VALID_STATUSES: OrderStatus[] = [
  "pending",
  "partially_paid",
  "paid",
  "overdue",
];

interface Filters {
  status: string;
  dueFrom: string;
  dueTo: string;
  createdFrom: string;
  createdTo: string;
}

const EMPTY_FILTERS: Filters = {
  status: "",
  dueFrom: "",
  dueTo: "",
  createdFrom: "",
  createdTo: "",
};

function buildQueryString(filters: Filters, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, value);
    }
  }
  return params.toString();
}

function filtersAreDefault(filters: Filters): boolean {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).every(
    (key) => filters[key] === EMPTY_FILTERS[key],
  );
}

function ResetIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function ExportPanel() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPreview(null);
  }

  function handleReset() {
    setFilters(EMPTY_FILTERS);
    setPreview(null);
    setError(null);
  }

  const isDefault = filtersAreDefault(filters);

  async function handlePreview() {
    setIsLoading(true);
    setError(null);

    const response = await fetch(
      `/api/orders/export?${buildQueryString(filters, { format: "json" })}`,
    );
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error?.message ?? "Something went wrong. Please try again.");
      setIsLoading(false);
      return;
    }

    setPreview(data);
    setIsLoading(false);
  }

  const downloadHref = `/api/orders/export?${buildQueryString(filters)}`;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="grid gap-3 sm:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Status
          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">Any</option>
            {VALID_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Due from
          <input
            type="date"
            value={filters.dueFrom}
            onChange={(event) => updateFilter("dueFrom", event.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Due to
          <input
            type="date"
            value={filters.dueTo}
            onChange={(event) => updateFilter("dueTo", event.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Created from
          <input
            type="date"
            value={filters.createdFrom}
            onChange={(event) => updateFilter("createdFrom", event.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Created to
          <input
            type="date"
            value={filters.createdTo}
            onChange={(event) => updateFilter("createdTo", event.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleReset}
          disabled={isDefault}
          title="Reset filters"
          aria-label="Reset filters"
          className="rounded-md border border-zinc-300 p-2 text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:disabled:hover:bg-transparent"
        >
          <ResetIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={isLoading}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {isLoading ? "Loading…" : "Preview"}
        </button>
        <a
          href={downloadHref}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Download CSV
        </a>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {preview && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {preview.rows.length === 0
              ? "No orders match these filters."
              : `${preview.rows.length} matching order${preview.rows.length === 1 ? "" : "s"}.`}
          </p>
          {preview.rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    {preview.headers.map((header) => (
                      <th
                        key={header}
                        className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {preview.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
