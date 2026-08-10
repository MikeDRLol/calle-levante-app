"use client";

import { useActionState } from "react";
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

type MaterialData = {
  id: string;
  name: string;
  status: string;
  category: string | null;
  serial_number: string | null;
};

export function EditMaterialForm({ material }: { material: MaterialData }) {
  const action = updateMaterial.bind(null, material.id);
  const initialState: UpdateMaterialState = null;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Nombre
        </label>
        <input id="name" name="name" required defaultValue={material.name} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Categoría
        </label>
        <select id="category" name="category" required defaultValue={material.category ?? ""} className={inputClass}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="serial_number" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Número de serie
        </label>
        <input
          id="serial_number"
          name="serial_number"
          defaultValue={material.serial_number ?? ""}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Estado
        </label>
        <select id="status" name="status" required defaultValue={material.status} className={inputClass}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
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
