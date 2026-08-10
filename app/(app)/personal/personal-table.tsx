"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { ResourceStatusBadge } from "@/components/resources/status-badge";
import { updatePerson, type UpdatePersonState } from "@/app/(app)/personal/actions";
import { FUNCTIONS } from "@/app/(app)/personal/new-person-form";

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

const STATUSES = [
  { value: "available", label: "Disponible" },
  { value: "in_use", label: "En un evento" },
  { value: "out_of_service", label: "De baja" },
  { value: "retired", label: "Ya no colabora" },
];

export type PersonRow = {
  id: string;
  name: string;
  status: string;
  people_details: { phone: string | null; email: string | null; functions: string[] | null } | null;
};

export function PersonalTable({ people }: { people: PersonRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Funciones</th>
            <th className="px-4 py-3 font-medium">Teléfono</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {people.map((person) =>
            editingId === person.id ? (
              <EditRow key={person.id} person={person} onClose={() => setEditingId(null)} />
            ) : (
              <tr
                key={person.id}
                className="bg-white transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{person.name}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {person.people_details?.functions?.join(", ") ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {person.people_details?.phone ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {person.people_details?.email ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <ResourceStatusBadge status={person.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditingId(person.id)}
                    aria-label="Editar"
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function EditRow({ person, onClose }: { person: PersonRow; onClose: () => void }) {
  const action = updatePerson.bind(null, person.id);
  const initialState: UpdatePersonState = null;
  const [state, formAction, pending] = useActionState(action, initialState);
  const wasPending = useRef(false);
  const currentFunctions = new Set(person.people_details?.functions ?? []);

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
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Editar persona</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cancelar"
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input name="name" required defaultValue={person.name} placeholder="Nombre" className={inputClass} />
            <input
              name="phone"
              defaultValue={person.people_details?.phone ?? ""}
              placeholder="Teléfono"
              className={inputClass}
            />
            <input
              name="email"
              type="email"
              defaultValue={person.people_details?.email ?? ""}
              placeholder="Email"
              className={inputClass}
            />
            <select name="status" required defaultValue={person.status} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {FUNCTIONS.map((f) => (
              <label key={f} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  name="functions"
                  value={f}
                  defaultChecked={currentFunctions.has(f)}
                  className="size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
                />
                {f}
              </label>
            ))}
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
