import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EventStatusBadge } from "@/components/events/status-badge";
import { EditClientForm } from "@/app/(app)/clientes/[id]/edit-client-form";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { eventDateFormatter } from "@/lib/utils/format";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  if (!organizationId) {
    notFound();
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, contact_name, phone, email, notes")
    .eq("id", id)
    .maybeSingle();

  if (!client) {
    notFound();
  }

  const { data: events } = await supabase
    .from("events")
    .select("id, name, event_type, status, start_at")
    .eq("client_id", id)
    .order("start_at", { ascending: false });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <Link
          href="/clientes"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Clientes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {client.name}
        </h1>
      </div>

      <EditClientForm client={client} />

      <div className="flex flex-1 flex-col rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Eventos ({events?.length ?? 0})
          </h2>
        </div>

        {!events || events.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
            Este cliente todavía no tiene eventos.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/eventos/${event.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {event.name}
                    </p>
                    <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                      {event.event_type} · {eventDateFormatter.format(new Date(event.start_at))}
                    </p>
                  </div>
                  <EventStatusBadge status={event.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
