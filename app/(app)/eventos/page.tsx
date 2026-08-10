import { PageHeader } from "@/components/ui/page-header";
import { NewEventForm } from "@/app/(app)/eventos/new-event-form";
import { createClient } from "@/lib/supabase/server";
import { Music2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmado",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  confirmed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function EventosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: events } = membership
    ? await supabase
        .from("events")
        .select("id, name, event_type, status, start_at, end_at, venue_name, clients(name)")
        .order("start_at", { ascending: true })
    : { data: null };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Eventos" description="Gestión de eventos musicales" />

      {!membership ? (
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

          <NewEventForm />

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
                    <tr key={event.id} className="bg-white dark:bg-zinc-950">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {event.name}
                        </p>
                        <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                          {event.event_type}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {(event.clients as unknown as { name: string } | null)?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {event.venue_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {dateFormatter.format(new Date(event.start_at))}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[event.status] ?? STATUS_STYLES.draft}`}
                        >
                          {STATUS_LABELS[event.status] ?? event.status}
                        </span>
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
