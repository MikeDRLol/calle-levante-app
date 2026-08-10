"use client";

import { useActionState } from "react";
import { updateClient, type UpdateClientState } from "@/app/(app)/clientes/[id]/actions";

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

type ClientData = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export function EditClientForm({ client }: { client: ClientData }) {
  const action = updateClient.bind(null, client.id);
  const initialState: UpdateClientState = null;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Nombre
        </label>
        <input id="name" name="name" required defaultValue={client.name} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact_name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Persona de contacto
        </label>
        <input
          id="contact_name"
          name="contact_name"
          defaultValue={client.contact_name ?? ""}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Teléfono
        </label>
        <input id="phone" name="phone" defaultValue={client.phone ?? ""} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
        </label>
        <input id="email" name="email" type="email" defaultValue={client.email ?? ""} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Notas
        </label>
        <textarea id="notes" name="notes" rows={3} defaultValue={client.notes ?? ""} className={inputClass} />
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
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
