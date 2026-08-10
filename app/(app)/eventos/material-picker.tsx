"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

export type Resource = { id: string; name: string; resource_type: string };

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

export function MaterialPicker({
  resources,
  name = "resource_ids",
}: {
  resources: Resource[];
  name?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Resource[]>([]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const selectedIds = new Set(selected.map((r) => r.id));
    return resources
      .filter((r) => !selectedIds.has(r.id) && r.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, resources, selected]);

  function addResource(r: Resource) {
    setSelected((prev) => [...prev, r]);
    setQuery("");
  }

  function removeResource(id: string) {
    setSelected((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div>
      {selected.map((r) => (
        <input key={r.id} type="hidden" name={name} value={r.id} />
      ))}

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          aria-hidden
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar material por nombre…"
          className={inputClass}
        />
        {results.length > 0 ? (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => addResource(r)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {r.name}
                  <span className="text-xs capitalize text-zinc-400">{r.resource_type}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {query.trim() && results.length === 0 ? (
          <p className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Sin resultados disponibles para &quot;{query}&quot;.
          </p>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((r) => (
            <span
              key={r.id}
              className="flex items-center gap-1 rounded-full bg-zinc-100 py-1 pl-2.5 pr-1.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {r.name}
              <button
                type="button"
                onClick={() => removeResource(r.id)}
                aria-label={`Quitar ${r.name}`}
                className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
