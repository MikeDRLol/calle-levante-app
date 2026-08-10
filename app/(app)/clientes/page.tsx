import { PageHeader } from "@/components/ui/page-header";
import { NewClientForm } from "@/app/(app)/clientes/new-client-form";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { Users } from "lucide-react";

export default async function ClientesPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  const { data: clients } = organizationId
    ? await supabase
        .from("clients")
        .select("id, name, contact_name, phone, email, events(count)")
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
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Contacto</th>
                    <th className="px-4 py-3 font-medium">Teléfono</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Eventos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {clients.map((client) => {
                    const eventCount =
                      (client.events as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
                    return (
                      <tr key={client.id} className="bg-white dark:bg-zinc-950">
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                          {client.name}
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
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                          {eventCount}
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
