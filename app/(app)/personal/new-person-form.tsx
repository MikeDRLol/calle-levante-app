"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createPerson, type CreatePersonState } from "@/app/(app)/personal/actions";

const initialState: CreatePersonState = null;

export const FUNCTIONS = ["Técnico", "Comercial", "Músico", "Conductor", "Montaje", "Otro"];

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

export function NewPersonForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPerson, initialState);
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
        Nueva persona
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Nueva persona</h2>
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nombre
          </label>
          <input id="name" name="name" required placeholder="Sergio Pérez" className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Funciones</label>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 py-1">
            {FUNCTIONS.map((f) => (
              <label key={f} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  name="functions"
                  value={f}
                  className="size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
                />
                {f}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Teléfono
          </label>
          <input id="phone" name="phone" placeholder="Opcional" className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input id="email" name="email" type="email" placeholder="Opcional" className={inputClass} />
        </div>

        {state?.error ? (
          <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Creando..." : "Crear persona"}
          </button>
        </div>
      </form>
    </div>
  );
}
