"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import {
  addChecklistItem,
  toggleChecklistItem,
  type AddChecklistItemState,
} from "@/app/(app)/eventos/[id]/actions";

type ChecklistItem = {
  id: string;
  label: string;
  is_checked: boolean;
  source: string;
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  rider: "Rider",
  kit: "Kit",
  material: "Material",
};

export function EventChecklist({
  eventId,
  organizationId,
  items,
}: {
  eventId: string;
  organizationId: string;
  items: ChecklistItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const addAction = addChecklistItem.bind(null, eventId, organizationId);
  const initialState: AddChecklistItemState = null;
  const [state, formAction, addPending] = useActionState(addAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !addPending && !state?.error) {
      formRef.current?.reset();
    }
    wasPending.current = addPending;
  }, [addPending, state]);

  const checkedCount = items.filter((i) => i.is_checked).length;
  const total = items.length;
  const progress = total === 0 ? 0 : Math.round((checkedCount / total) * 100);

  return (
    <div className="flex flex-1 flex-col rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Checklist de carga
          </h2>
          <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
            {checkedCount}/{total} ({progress}%)
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
          Sin ítems todavía. Añade uno abajo o aplica un Kit al evento.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <input
                type="checkbox"
                checked={item.is_checked}
                disabled={isPending}
                onChange={(e) => {
                  const checked = e.target.checked;
                  startTransition(() => {
                    toggleChecklistItem(item.id, eventId, checked);
                  });
                }}
                className="size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
              />
              <span
                className={`flex-1 text-sm ${item.is_checked ? "text-zinc-400 line-through dark:text-zinc-600" : "text-zinc-900 dark:text-zinc-50"}`}
              >
                {item.label}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {SOURCE_LABELS[item.source] ?? item.source}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        <input
          name="label"
          placeholder="Añadir ítem (ej. confirmar acceso al recinto)"
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600"
        />
        <button
          type="submit"
          disabled={addPending}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="size-4" aria-hidden />
          Añadir
        </button>
      </form>
      {state?.error ? (
        <p className="px-4 pb-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </div>
  );
}
