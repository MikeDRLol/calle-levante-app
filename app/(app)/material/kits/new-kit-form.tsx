"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createKit, type CreateKitState } from "@/app/(app)/material/kits/actions";
import { KitItemRows } from "@/app/(app)/material/kits/kit-item-rows";

const initialState: CreateKitState = null;

const EVENT_TYPES = [
  { value: "", label: "Cualquiera" },
  { value: "boda", label: "Boda" },
  { value: "concierto", label: "Concierto" },
  { value: "dj", label: "DJ" },
  { value: "verbena", label: "Verbena" },
  { value: "comunion", label: "Comunión" },
  { value: "otro", label: "Otro" },
];

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

export function NewKitForm() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(createKit, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      formRef.current?.reset();
      setFormKey((k) => k + 1);
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
        Nuevo pack
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Nuevo pack</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <X className="size-4" />
        </button>
      </div>

      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nombre
            </label>
            <input id="name" name="name" required placeholder="Boda Premium" className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="event_type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tipo de evento
            </label>
            <select id="event_type" name="event_type" defaultValue="" className={inputClass}>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Material del pack</p>
          <KitItemRows key={formKey} />
        </div>

        {state?.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Creando..." : "Crear pack"}
          </button>
        </div>
      </form>
    </div>
  );
}
