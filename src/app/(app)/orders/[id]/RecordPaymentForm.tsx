"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { centsToDollars, dollarsToCents } from "@/lib/logic/money";

interface RecordPaymentFormProps {
  orderId: string;
  amountDueCents: number;
  amountPaidCents: number;
}

type EntryType = "payment" | "refund";

export function RecordPaymentForm({
  orderId,
  amountDueCents,
  amountPaidCents,
}: RecordPaymentFormProps) {
  const router = useRouter();
  const canPay = amountDueCents > 0;
  const canRefund = amountPaidCents > 0;

  const [type, setType] = useState<EntryType>(canPay ? "payment" : "refund");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!canPay && !canRefund) {
    // Nothing left to do: fully paid, and nothing paid yet to refund.
    return null;
  }

  const maxCents = type === "payment" ? amountDueCents : amountPaidCents;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/orders/${orderId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        amountCents: dollarsToCents(Number(amount) || 0),
        date,
        note: note.trim() || undefined,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // The API's error message already includes the maximum allowed
      // amount inline (e.g. "...Maximum allowed is $55.00") — the
      // `maxAllowedCents` field in the response is there for callers that
      // want the raw number, not for us to also append it to the text.
      setError(data?.error?.message ?? "Something went wrong. Please try again.");
      setIsSubmitting(false);
      return;
    }

    setAmount("");
    setNote("");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {type === "payment" ? "Record a payment" : "Record a refund"}
        </h3>
        {canPay && canRefund && (
          <div className="flex overflow-hidden rounded-md border border-zinc-300 text-xs dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setType("payment")}
              className={`px-2.5 py-1 font-medium ${
                type === "payment"
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              Payment
            </button>
            <button
              type="button"
              onClick={() => setType("refund")}
              className={`px-2.5 py-1 font-medium ${
                type === "refund"
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              Refund
            </button>
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Amount ($)
          <div className="flex gap-1">
            <input
              type="number"
              min={0.01}
              step={0.01}
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="button"
              onClick={() => setAmount(centsToDollars(maxCents).toFixed(2))}
              className="shrink-0 rounded-md border border-zinc-300 px-2 text-xs font-medium whitespace-nowrap text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {type === "payment" ? "Pay in full" : "Refund all"}
            </button>
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Note (optional)
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSubmitting
          ? "Recording…"
          : type === "payment"
            ? "Record payment"
            : "Record refund"}
      </button>
    </form>
  );
}
