"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this order? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    const response = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error?.message ?? "Something went wrong. Please try again.");
      setIsDeleting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
      >
        {isDeleting ? "Deleting…" : "Delete order"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
