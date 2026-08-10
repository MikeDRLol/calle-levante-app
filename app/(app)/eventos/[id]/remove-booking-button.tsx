"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { removeResourceBooking } from "@/app/(app)/eventos/[id]/actions";

export function RemoveBookingButton({
  bookingId,
  eventId,
}: {
  bookingId: string;
  eventId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => removeResourceBooking(bookingId, eventId))}
      aria-label="Quitar"
      className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-60 dark:hover:bg-zinc-800 dark:hover:text-red-400"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}
