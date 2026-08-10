"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteKit } from "@/app/(app)/material/kits/actions";

export function DeleteKitButton({ kitId }: { kitId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm("¿Borrar este pack? No afecta a los eventos donde ya se aplicó.")) {
          startTransition(() => deleteKit(kitId));
        }
      }}
      aria-label="Borrar pack"
      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-60 dark:hover:bg-zinc-800 dark:hover:text-red-400"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}
