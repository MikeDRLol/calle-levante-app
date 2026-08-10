import { PageHeader } from "@/components/ui/page-header";
import { NewEventForm } from "@/app/(app)/eventos/new-event-form";
import { EventsTable, type EventRow } from "@/app/(app)/eventos/events-table";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { Music2 } from "lucide-react";

export default async function EventosPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  const [{ data: events }, { data: clients }, { data: resources }] = organizationId
    ? await Promise.all([
        supabase
          .from("events")
          .select(
            "id, name, event_type, status, start_at, end_at, venue_name, venue_address, notes, total_amount, client_id, clients(name)",
          )
          .order("start_at", { ascending: true }),
        supabase.from("clients").select("id, name").order("name", { ascending: true }),
        supabase
          .from("resources")
          .select("id, name, resource_type")
          .eq("status", "available")
          .in("resource_type", ["material", "tool", "equipment", "vehicle"])
          .order("name", { ascending: true }),
      ])
    : [{ data: null }, { data: null }, { data: null }];

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

          <NewEventForm clients={clients ?? []} resources={resources ?? []} />

          {!events || events.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
              <Music2 className="size-6 text-zinc-400" aria-hidden />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Todavía no hay eventos. Crea el primero arriba.
              </p>
            </div>
          ) : (
            <EventsTable events={events as unknown as EventRow[]} clients={clients ?? []} />
          )}
        </>
      )}
    </div>
  );
}
