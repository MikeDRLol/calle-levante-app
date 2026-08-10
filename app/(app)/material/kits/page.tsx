import Link from "next/link";
import { ArrowLeft, Package2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { NewKitForm } from "@/app/(app)/material/kits/new-kit-form";
import { DeleteKitButton } from "@/app/(app)/material/kits/delete-kit-button";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  material: "Material",
  tool: "Herramienta",
  equipment: "Equipo",
  vehicle: "Vehículo",
};

export default async function KitsPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  const { data: kits } = organizationId
    ? await supabase
        .from("kits")
        .select("id, name, event_type, kit_items(id, resource_category, resource_type, quantity)")
        .order("name", { ascending: true })
    : { data: null };

  return (
    <div className="flex flex-1 flex-col">
      <Link
        href="/material"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Material
      </Link>

      <PageHeader
        title="Packs de material"
        description="Plantillas reutilizables para aplicar a un evento de una vez"
      />

      {!organizationId ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tu usuario todavía no pertenece a ninguna organización.
          </p>
        </div>
      ) : (
        <>
          <NewKitForm />

          {!kits || kits.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
              <Package2 className="size-6 text-zinc-400" aria-hidden />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Todavía no hay packs. Crea el primero arriba.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {kits.map((kit) => (
                <div
                  key={kit.id}
                  className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{kit.name}</p>
                      {kit.event_type ? (
                        <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                          {kit.event_type}
                        </p>
                      ) : null}
                    </div>
                    <DeleteKitButton kitId={kit.id} />
                  </div>

                  <ul className="flex flex-col gap-1">
                    {kit.kit_items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300"
                      >
                        <span>
                          {item.resource_category ?? RESOURCE_TYPE_LABELS[item.resource_type]}
                        </span>
                        <span className="tabular-nums text-zinc-400">×{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
