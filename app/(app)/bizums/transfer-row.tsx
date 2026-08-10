"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { markTransferPaid } from "@/app/(app)/eventos/[id]/settlement-actions";
import { currencyFormatter } from "@/lib/utils/format";

export type BizumRow = {
  id: string;
  amount: number;
  status: string;
  event: { id: string; name: string } | null;
  from: { name: string } | null;
  to: { name: string } | null;
};

export function TransferRow({ transfer }: { transfer: BizumRow }) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr className="bg-white dark:bg-zinc-950">
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{transfer.event?.name ?? "—"}</td>
      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{transfer.from?.name ?? "—"}</td>
      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{transfer.to?.name ?? "—"}</td>
      <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-50">
        {currencyFormatter.format(transfer.amount)}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(() => markTransferPaid(transfer.id, transfer.event?.id ?? ""))
          }
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          <Check className="size-3.5" aria-hidden />
          Marcar pagado
        </button>
      </td>
    </tr>
  );
}
