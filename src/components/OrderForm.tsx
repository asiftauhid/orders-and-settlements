"use client";

import { useState, type FormEvent } from "react";
import { dollarsToCents, formatCents } from "@/lib/logic/money";
import { computeOrderTotals } from "@/lib/logic/orderTotals";

interface LineItemFormValue {
  description: string;
  quantity: string;
  unitPrice: string; // dollars, exactly as typed (e.g. "19.99") — converted to cents only on submit
}

export interface OrderFormValues {
  customer: string;
  dueDate: string; // yyyy-mm-dd, matches <input type="date">
  lineItems: LineItemFormValue[];
}

export interface OrderFormPayload {
  customer: string;
  dueDate: string;
  lineItems: { description: string; quantity: number; unitPriceCents: number }[];
}

interface OrderFormProps {
  initialValues?: OrderFormValues;
  submitLabel: string;
  onSubmit: (payload: OrderFormPayload) => Promise<string | null>;
}

const EMPTY_LINE_ITEM: LineItemFormValue = {
  description: "",
  quantity: "1",
  unitPrice: "",
};

export function OrderForm({ initialValues, submitLabel, onSubmit }: OrderFormProps) {
  const [customer, setCustomer] = useState(initialValues?.customer ?? "");
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? "");
  const [lineItems, setLineItems] = useState<LineItemFormValue[]>(
    initialValues?.lineItems ?? [{ ...EMPTY_LINE_ITEM }],
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateLineItem(index: number, patch: Partial<LineItemFormValue>) {
    setLineItems((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function addLineItem() {
    setLineItems((items) => [...items, { ...EMPTY_LINE_ITEM }]);
  }

  function removeLineItem(index: number) {
    setLineItems((items) => items.filter((_, i) => i !== index));
  }

  // Live preview only — the real, authoritative total is always computed
  // server-side from the same computeOrderTotals function on submit.
  const previewTotals = computeOrderTotals(
    lineItems.map((item) => ({
      quantity: Number(item.quantity) || 0,
      unitPriceCents: item.unitPrice ? dollarsToCents(Number(item.unitPrice)) : 0,
    })),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload: OrderFormPayload = {
      customer,
      dueDate,
      lineItems: lineItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPriceCents: dollarsToCents(Number(item.unitPrice) || 0),
      })),
    };

    const errorMessage = await onSubmit(payload);

    if (errorMessage) {
      setError(errorMessage);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Customer
          <input
            type="text"
            required
            value={customer}
            onChange={(event) => setCustomer(event.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Due date
          <input
            type="date"
            required
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Line items
          </h2>
          <button
            type="button"
            onClick={addLineItem}
            className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            + Add line item
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {lineItems.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_72px_112px_auto] items-end gap-2"
            >
              <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                Description
                <input
                  type="text"
                  required
                  value={item.description}
                  onChange={(event) =>
                    updateLineItem(index, { description: event.target.value })
                  }
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                Qty
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={item.quantity}
                  onChange={(event) =>
                    updateLineItem(index, { quantity: event.target.value })
                  }
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                Unit price ($)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  value={item.unitPrice}
                  onChange={(event) =>
                    updateLineItem(index, { unitPrice: event.target.value })
                  }
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
              <button
                type="button"
                onClick={() => removeLineItem(index)}
                disabled={lineItems.length === 1}
                className="mb-1.5 text-sm text-red-600 hover:underline disabled:opacity-30 disabled:hover:no-underline dark:text-red-400"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Order total
        </span>
        <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {formatCents(previewTotals.totalCents)}
        </span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
