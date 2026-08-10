import { PageHeader } from "@/components/ui/page-header";
import { NewMaterialForm } from "@/app/(app)/material/new-material-form";
import { MaterialsTable, type MaterialRow } from "@/app/(app)/material/materials-table";
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
            <MaterialsTable resources={resources as unknown as MaterialRow[]} />
          )}
        </>
      )}
    </div>
  );
}
