"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

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

const RESOURCE_TYPES = [
  { value: "material", label: "Material" },
  { value: "tool", label: "Herramienta" },
  { value: "equipment", label: "Equipo" },
  { value: "vehicle", label: "Vehículo" },
];

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

type Row = { id: number; resourceType: string; category: string; quantity: string };

let nextId = 0;

export function KitItemRows() {
  const [rows, setRows] = useState<Row[]>([
    { id: nextId++, resourceType: "material", category: "", quantity: "1" },
  ]);

  function addRow() {
    setRows((prev) => [...prev, { id: nextId++, resourceType: "material", category: "", quantity: "1" }]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const needsCategory = (type: string) => ["material", "tool", "equipment"].includes(type);

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[1fr_1fr_5rem_auto] items-center gap-2">
          <select
            name="item_type"
            value={row.resourceType}
            onChange={(e) => updateRow(row.id, { resourceType: e.target.value })}
            className={inputClass}
          >
            {RESOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {needsCategory(row.resourceType) ? (
            <select
              name="item_category"
              value={row.category}
              onChange={(e) => updateRow(row.id, { category: e.target.value })}
              required
              className={inputClass}
            >
              <option value="" disabled>
                Categoría
              </option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input type="hidden" name="item_category" value="" />
          )}

          <input
            name="item_quantity"
            type="number"
            min="1"
            value={row.quantity}
            onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
            className={inputClass}
          />

          <button
            type="button"
            onClick={() => removeRow(row.id)}
            disabled={rows.length === 1}
            aria-label="Quitar línea"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-red-400"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="mt-1 flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        <Plus className="size-4" aria-hidden />
        Añadir línea
      </button>
    </div>
  );
}
