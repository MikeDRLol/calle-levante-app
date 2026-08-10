"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createEvent, type CreateEventState } from "@/app/(app)/eventos/actions";

const initialState: CreateEventState = null;

const EVENT_TYPES = [
  { value: "boda", label: "Boda" },
  { value: "concierto", label: "Concierto" },
  { value: "dj", label: "DJ" },
  { value: "verbena", label: "Verbena" },
  { value: "comunion", label: "Comunión" },
  { value: "otro", label: "Otro" },
];

export function NewEventForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createEvent,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <Plus className="size-4" aria-hidden />
        Nuevo evento
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Nuevo evento
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <X className="size-4" />
        </button>
      </div>

      <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="name">
          <input
            id="name"
            name="name"
            required
            placeholder="Boda García"
            className={inputClass}
          />
        </Field>

        <Field label="Tipo" htmlFor="event_type">
          <select id="event_type" name="event_type" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Selecciona un tipo
            </option>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Cliente" htmlFor="client_name">
          <input
            id="client_name"
            name="client_name"
            placeholder="Familia García (opcional)"
            className={inputClass}
          />
        </Field>

        <Field label="Lugar" htmlFor="venue_name">
          <input
            id="venue_name"
            name="venue_name"
            placeholder="Finca El Rincón (opcional)"
            className={inputClass}
          />
        </Field>

        <Field label="Inicio" htmlFor="start_at">
          <input
            id="start_at"
            name="start_at"
            type="datetime-local"
            required
            className={inputClass}
          />
        </Field>

        <Field label="Fin" htmlFor="end_at">
          <input
            id="end_at"
            name="end_at"
            type="datetime-local"
            required
            className={inputClass}
          />
        </Field>

        {state?.error ? (
          <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Creando..." : "Crear evento"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {children}
    </div>
  );
}
