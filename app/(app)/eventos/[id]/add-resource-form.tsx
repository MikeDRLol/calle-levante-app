"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import {
  addResourceToEvent,
  type AddResourceState,
} from "@/app/(app)/eventos/[id]/actions";

type Candidate = { id: string; name: string; resource_type: string };

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

export function AddResourceForm({
  eventId,
  organizationId,
  candidates,
}: {
  eventId: string;
  organizationId: string;
  candidates: Candidate[];
}) {
  const action = addResourceToEvent.bind(null, eventId, organizationId);
  const initialState: AddResourceState = null;
  const [state, formAction, pending] = useActionState(action, initialState);

  if (candidates.length === 0) {
    return (
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        No hay recursos disponibles para las fechas de este evento ahora mismo.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <form action={formAction} className="flex items-center gap-2">
        <select name="resource_id" required defaultValue="" className={`flex-1 ${inputClass}`}>
          <option value="" disabled>
            Añadir material o recurso disponible…
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          aria-label="Añadir"
          className="flex items-center justify-center rounded-lg bg-zinc-900 p-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </form>
      {state?.error ? (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </div>
  );
}
