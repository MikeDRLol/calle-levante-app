"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { updateEvent, type UpdateEventState } from "@/app/(app)/eventos/[id]/actions";

const EVENT_TYPES = [
  { value: "boda", label: "Boda" },
  { value: "concierto", label: "Concierto" },
  { value: "dj", label: "DJ" },
  { value: "verbena", label: "Verbena" },
  { value: "comunion", label: "Comunión" },
  { value: "otro", label: "Otro" },
];

const EVENT_STATUSES = [
  { value: "draft", label: "Borrador" },
  { value: "confirmed", label: "Confirmado" },
  { value: "in_progress", label: "En curso" },
  { value: "completed", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
];

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type EventData = {
  id: string;
  name: string;
  event_type: string;
  status: string;
  start_at: string;
  end_at: string;
  venue_name: string | null;
  venue_address: string | null;
  total_amount: number | null;
  notes: string | null;
};

export function EditEventForm({ event }: { event: EventData }) {
  const [open, setOpen] = useState(false);
  const initialState: UpdateEventState = null;
  const action = updateEvent.bind(null, event.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        <Pencil className="size-3.5" aria-hidden />
        Editar
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Editar evento</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <X className="size-4" />
        </button>
      </div>

      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nombre
          </label>
          <input id="name" name="name" required defaultValue={event.name} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="event_type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Tipo
          </label>
          <select id="event_type" name="event_type" required defaultValue={event.event_type} className={inputClass}>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Estado
          </label>
          <select id="status" name="status" required defaultValue={event.status} className={inputClass}>
            {EVENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="total_amount" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Importe acordado (€)
          </label>
          <input
            id="total_amount"
            name="total_amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={event.total_amount ?? ""}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="start_at" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Inicio
          </label>
          <input
            id="start_at"
            name="start_at"
            type="datetime-local"
            required
            defaultValue={toDatetimeLocal(event.start_at)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="end_at" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Fin
          </label>
          <input
            id="end_at"
            name="end_at"
            type="datetime-local"
            required
            defaultValue={toDatetimeLocal(event.end_at)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="venue_name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Lugar
          </label>
          <input
            id="venue_name"
            name="venue_name"
            defaultValue={event.venue_name ?? ""}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="venue_address" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Dirección
          </label>
          <input
            id="venue_address"
            name="venue_address"
            defaultValue={event.venue_address ?? ""}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notas
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={event.notes ?? ""}
            className={inputClass}
          />
        </div>

        {state?.error ? (
          <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}

        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
