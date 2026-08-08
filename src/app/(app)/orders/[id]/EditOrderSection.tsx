"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OrderForm, type OrderFormPayload, type OrderFormValues } from "@/components/OrderForm";

interface EditOrderSectionProps {
  orderId: string;
  initialValues: OrderFormValues;
}

export function EditOrderSection({ orderId, initialValues }: EditOrderSectionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
      >
        Edit order
      </button>
    );
  }

  async function handleUpdate(payload: OrderFormPayload) {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return data?.error?.message ?? "Something went wrong. Please try again.";
    }

    setIsEditing(false);
    router.refresh();
    return null;
  }

  return (
    <div className="w-full rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Edit order
        </h3>
        <button
          onClick={() => setIsEditing(false)}
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          Cancel
        </button>
      </div>
      <OrderForm
        initialValues={initialValues}
        submitLabel="Save changes"
        onSubmit={handleUpdate}
      />
    </div>
  );
}
