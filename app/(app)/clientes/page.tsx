import { PageHeader } from "@/components/ui/page-header";
import { NewClientForm } from "@/app/(app)/clientes/new-client-form";
import { ClientsTable, type ClientRow } from "@/app/(app)/clientes/clients-table";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { Users } from "lucide-react";

export default async function ClientesPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  const { data: clients } = organizationId
    ? await supabase
        .from("clients")
        .select("id, name, contact_name, phone, email, notes, events(count)")
        .order("name", { ascending: true })
    : { data: null };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Clientes" description="Base de datos de clientes" />

      {!organizationId ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tu usuario todavía no pertenece a ninguna organización — no se pueden mostrar clientes.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {clients?.length ?? 0} cliente{clients?.length === 1 ? "" : "s"}
            </p>
          </div>

          <NewClientForm />

          {!clients || clients.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
              <Users className="size-6 text-zinc-400" aria-hidden />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Todavía no hay clientes. Crea el primero arriba.
              </p>
            </div>
          ) : (
            <ClientsTable clients={clients as unknown as ClientRow[]} />
          )}
        </>
      )}
    </div>
  );
}
