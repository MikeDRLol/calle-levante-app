"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil, X } from "lucide-react";
import { updateClient, type UpdateClientState } from "@/app/(app)/clientes/[id]/actions";

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

export type ClientRow = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  events: { count: number }[] | null;
};

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Contacto</th>
            <th className="px-4 py-3 font-medium">Teléfono</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Eventos</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {clients.map((client) => {
            const eventCount = client.events?.[0]?.count ?? 0;
            return editingId === client.id ? (
              <EditRow key={client.id} client={client} onClose={() => setEditingId(null)} />
            ) : (
              <tr
                key={client.id}
                className="bg-white transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                  <Link href={`/clientes/${client.id}`} className="hover:underline">
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {client.contact_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {client.phone ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {client.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{eventCount}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditingId(client.id)}
                    aria-label="Editar"
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EditRow({
  client,
  onClose,
}: {
  client: ClientRow;
  onClose: () => void;
}) {
  const action = updateClient.bind(null, client.id);
  const initialState: UpdateClientState = null;
  const [state, formAction, pending] = useActionState(action, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      onClose();
    }
    wasPending.current = pending;
  }, [pending, state, onClose]);

  return (
    <tr className="bg-zinc-50 dark:bg-zinc-900">
      <td colSpan={6} className="p-4">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Editar cliente
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cancelar"
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="size-4" />
            </button>
          </div>

          <input type="hidden" name="notes" defaultValue={client.notes ?? ""} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input name="name" required defaultValue={client.name} placeholder="Nombre" className={inputClass} />
            <input
              name="contact_name"
              defaultValue={client.contact_name ?? ""}
              placeholder="Contacto"
              className={inputClass}
            />
            <input name="phone" defaultValue={client.phone ?? ""} placeholder="Teléfono" className={inputClass} />
            <input
              name="email"
              type="email"
              defaultValue={client.email ?? ""}
              placeholder="Email"
              className={inputClass}
            />
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
              {pending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}
