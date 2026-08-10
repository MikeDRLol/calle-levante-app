import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { NewMaterialForm } from "@/app/(app)/material/new-material-form";
import { ResourceStatusBadge } from "@/components/resources/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { Package } from "lucide-react";

export default async function MaterialPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  const { data: resources } = organizationId
    ? await supabase
        .from("resources")
        .select("id, name, status, materials_details(category, serial_number)")
        .in("resource_type", ["material", "tool", "equipment"])
        .order("name", { ascending: true })
    : { data: null };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Material" description="Inventario y equipamiento" />

      {!organizationId ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tu usuario todavía no pertenece a ninguna organización — no se puede mostrar el inventario.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {resources?.length ?? 0} artículo{resources?.length === 1 ? "" : "s"}
            </p>
          </div>

          <NewMaterialForm />

          {!resources || resources.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
              <Package className="size-6 text-zinc-400" aria-hidden />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Todavía no hay material. Da de alta el primero arriba.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Material</th>
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium">Nº de serie</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {resources.map((resource) => {
                    const details = resource.materials_details as unknown as {
                      category: string | null;
                      serial_number: string | null;
                    } | null;
                    return (
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
                          {details?.category ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                          {details?.serial_number ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <ResourceStatusBadge status={resource.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
