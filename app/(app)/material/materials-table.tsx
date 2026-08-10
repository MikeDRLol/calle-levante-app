"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil, X } from "lucide-react";
import { ResourceStatusBadge } from "@/components/resources/status-badge";
import { updateMaterial, type UpdateMaterialState } from "@/app/(app)/material/[id]/actions";

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

const CATEGORIES = [
  "Audio",
  "Luces",
  "Cableado",
  "Backline",
  "DJ",
  "Vídeo",
  "Escenario",
  "Consumibles",
  "Otros",
];

const STATUSES = [
  { value: "available", label: "Disponible" },
  { value: "in_use", label: "En uso" },
  { value: "in_repair", label: "En reparación" },
  { value: "out_of_service", label: "Fuera de servicio" },
  { value: "retired", label: "Retirado" },
];

export type MaterialRow = {
  id: string;
  name: string;
  status: string;
  materials_details: { category: string | null; serial_number: string | null } | null;
};

export function MaterialsTable({ resources }: { resources: MaterialRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Material</th>
            <th className="px-4 py-3 font-medium">Categoría</th>
            <th className="px-4 py-3 font-medium">Nº de serie</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {resources.map((resource) =>
            editingId === resource.id ? (
              <EditRow key={resource.id} resource={resource} onClose={() => setEditingId(null)} />
            ) : (
              <tr
                key={resource.id}
                className="bg-white transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                  <Link href={`/material/${resource.id}`} className="hover:underline">
                    {resource.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {resource.materials_details?.category ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {resource.materials_details?.serial_number ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <ResourceStatusBadge status={resource.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditingId(resource.id)}
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

function EditRow({
  resource,
  onClose,
}: {
  resource: MaterialRow;
  onClose: () => void;
}) {
  const action = updateMaterial.bind(null, resource.id);
  const initialState: UpdateMaterialState = null;
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
      <td colSpan={5} className="p-4">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Editar material
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input name="name" required defaultValue={resource.name} placeholder="Nombre" className={inputClass} />
            <select
              name="category"
              required
              defaultValue={resource.materials_details?.category ?? ""}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              name="serial_number"
              defaultValue={resource.materials_details?.serial_number ?? ""}
              placeholder="Nº de serie"
              className={inputClass}
            />
            <select name="status" required defaultValue={resource.status} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
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
