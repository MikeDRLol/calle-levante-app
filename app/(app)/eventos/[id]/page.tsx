import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { EventStatusBadge } from "@/components/events/status-badge";
import { ResourceStatusBadge } from "@/components/resources/status-badge";
import { EventChecklist } from "@/app/(app)/eventos/[id]/checklist";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { eventDateFormatter } from "@/lib/utils/format";

export default async function EventDetailPage({
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

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, name, event_type, status, start_at, end_at, venue_name, venue_address, notes, clients(name, phone, email)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    notFound();
  }

  const [{ data: checklistItems }, { data: bookings }] = await Promise.all([
    supabase
      .from("event_checklist_items")
      .select("id, label, is_checked, source")
      .eq("event_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("resource_bookings")
      .select("id, resources(id, name, resource_type, status)")
      .eq("event_id", id),
  ]);

  const client = event.clients as unknown as {
    name: string;
    phone: string | null;
    email: string | null;
  } | null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <Link
          href="/eventos"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Eventos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {event.name}
            </h1>
            <p className="mt-1 text-sm capitalize text-zinc-500 dark:text-zinc-400">
              {event.event_type} · {eventDateFormatter.format(new Date(event.start_at))}
              {" — "}
              {eventDateFormatter.format(new Date(event.end_at))}
            </p>
          </div>
          <EventStatusBadge status={event.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoCard label="Cliente">
          {client ? (
            <>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{client.name}</p>
              {client.phone ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{client.phone}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin cliente asignado</p>
          )}
        </InfoCard>

        <InfoCard label="Lugar">
          {event.venue_name ? (
            <div className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{event.venue_name}</p>
                {event.venue_address ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{event.venue_address}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin definir</p>
          )}
        </InfoCard>

        <InfoCard label="Material y recursos asignados">
          {!bookings || bookings.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nada reservado todavía.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {bookings.map((booking) => {
                const resource = booking.resources as unknown as {
                  id: string;
                  name: string;
                  status: string;
                } | null;
                if (!resource) return null;
                return (
                  <li key={booking.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {resource.name}
                    </span>
                    <ResourceStatusBadge status={resource.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </InfoCard>
      </div>

      <EventChecklist
        eventId={event.id}
        organizationId={organizationId}
        items={checklistItems ?? []}
      />
    </div>
  );
}

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      {children}
    </div>
  );
}
