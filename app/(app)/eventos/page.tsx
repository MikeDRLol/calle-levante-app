import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { NewEventForm } from "@/app/(app)/eventos/new-event-form";
import { EventStatusBadge } from "@/components/events/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { eventDateFormatter } from "@/lib/utils/format";
import { Music2 } from "lucide-react";

export default async function EventosPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  const [{ data: events }, { data: clients }] = organizationId
    ? await Promise.all([
        supabase
          .from("events")
          .select("id, name, event_type, status, start_at, end_at, venue_name, clients(name)")
          .order("start_at", { ascending: true }),
        supabase.from("clients").select("id, name").order("name", { ascending: true }),
      ])
    : [{ data: null }, { data: null }];

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Eventos" description="Gestión de eventos musicales" />

      {!organizationId ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tu usuario todavía no pertenece a ninguna organización — no se pueden mostrar eventos.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {events?.length ?? 0} evento{events?.length === 1 ? "" : "s"}
            </p>
          </div>

          <NewEventForm clients={clients ?? []} />

          {!events || events.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
              <Music2 className="size-6 text-zinc-400" aria-hidden />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Todavía no hay eventos. Crea el primero arriba.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Evento</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Lugar</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      className="bg-white transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/eventos/${event.id}`} className="block">
                          <p className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                            {event.name}
                          </p>
                          <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                            {event.event_type}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {(event.clients as unknown as { name: string } | null)?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {event.venue_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {eventDateFormatter.format(new Date(event.start_at))}
                      </td>
                      <td className="px-4 py-3">
                        <EventStatusBadge status={event.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
