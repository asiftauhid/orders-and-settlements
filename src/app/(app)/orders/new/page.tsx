"use client";

import { useRouter } from "next/navigation";
import { OrderForm, type OrderFormPayload } from "@/components/OrderForm";

export default function NewOrderPage() {
  const router = useRouter();

  async function handleCreate(payload: OrderFormPayload) {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return data?.error?.message ?? "Something went wrong. Please try again.";
    }

    router.push(`/orders/${data.order.id}`);
    router.refresh();
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        New order
      </h1>
      <OrderForm submitLabel="Create order" onSubmit={handleCreate} />
    </div>
  );
}
