import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { EventStatusBadge } from "@/components/events/status-badge";
import { ResourceStatusBadge } from "@/components/resources/status-badge";
import { EventChecklist } from "@/app/(app)/eventos/[id]/checklist";
import { EditEventForm } from "@/app/(app)/eventos/[id]/edit-event-form";
import { EventPayments } from "@/app/(app)/eventos/[id]/payments";
import { AddResourceForm } from "@/app/(app)/eventos/[id]/add-resource-form";
import { AddPersonnelForm } from "@/app/(app)/eventos/[id]/add-personnel-form";
import { ApplyKitForm } from "@/app/(app)/eventos/[id]/apply-kit-form";
import { RemoveBookingButton } from "@/app/(app)/eventos/[id]/remove-booking-button";
import {
  SettlementSection,
  type Participant,
  type Expense,
  type Transfer,
} from "@/app/(app)/eventos/[id]/settlement-section";
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
      "id, name, event_type, status, start_at, end_at, venue_name, venue_address, notes, total_amount, client_id, clients(name, phone, email)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    notFound();
  }

  const [{ data: checklistItems }, { data: bookings }, { data: payments }, { data: clients }, { data: kits }] = await Promise.all([
    supabase
      .from("event_checklist_items")
      .select("id, label, is_checked, source")
      .eq("event_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("resource_bookings")
      .select("id, resources(id, name, resource_type, status)")
      .eq("event_id", id),
    supabase
      .from("event_payments")
      .select("id, amount, method, paid_at, notes")
      .eq("event_id", id)
      .order("paid_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name", { ascending: true }),
    supabase.from("kits").select("id, name").order("name", { ascending: true }),
  ]);

  const client = event.clients as unknown as {
    name: string;
    phone: string | null;
    email: string | null;
  } | null;

  const bookedResourceIds = new Set(
    (bookings ?? [])
      .map((b) => (b.resources as unknown as { id: string } | null)?.id)
      .filter((v): v is string => Boolean(v)),
  );

  const { data: candidateResources } = await supabase
    .from("resources")
    .select("id, name, resource_type")
    .eq("status", "available")
    .in("resource_type", ["material", "tool", "equipment", "vehicle"]);

  const unbookedCandidates = (candidateResources ?? []).filter(
    (r) => !bookedResourceIds.has(r.id),
  );

  let availableCandidates: { id: string; name: string; resource_type: string }[] = [];

  if (unbookedCandidates.length > 0) {
    const { data: availability } = await supabase.rpc(
      "fn_check_resource_availability",
      {
        p_resource_ids: unbookedCandidates.map((r) => r.id),
        p_start_at: event.start_at,
        p_end_at: event.end_at,
      },
    );

    type AvailabilityRow = { resource_id: string; is_available: boolean };
    const availableIds = new Set(
      ((availability ?? []) as AvailabilityRow[])
        .filter((a) => a.is_available)
        .map((a) => a.resource_id),
    );
    availableCandidates = unbookedCandidates.filter((r) => availableIds.has(r.id));
  }

  const { data: candidatePeople } = await supabase
    .from("resources")
    .select("id, name")
    .eq("status", "available")
    .eq("resource_type", "person");

  const unbookedPeopleCandidates = (candidatePeople ?? []).filter(
    (r) => !bookedResourceIds.has(r.id),
  );

  let availablePeopleCandidates: { id: string; name: string }[] = [];

  if (unbookedPeopleCandidates.length > 0) {
    const { data: peopleAvailability } = await supabase.rpc("fn_check_resource_availability", {
      p_resource_ids: unbookedPeopleCandidates.map((r) => r.id),
      p_start_at: event.start_at,
      p_end_at: event.end_at,
    });

    type AvailabilityRow = { resource_id: string; is_available: boolean };
    const availablePeopleIds = new Set(
      ((peopleAvailability ?? []) as AvailabilityRow[])
        .filter((a) => a.is_available)
        .map((a) => a.resource_id),
    );
    availablePeopleCandidates = unbookedPeopleCandidates.filter((r) => availablePeopleIds.has(r.id));
  }

  const materialBookings = (bookings ?? []).filter(
    (b) => (b.resources as unknown as { resource_type: string } | null)?.resource_type !== "person",
  );
  const personnelBookings = (bookings ?? []).filter(
    (b) => (b.resources as unknown as { resource_type: string } | null)?.resource_type === "person",
  );

  const [
    { data: people },
    { data: settlementParticipants },
    { data: expenses },
    { data: transfers },
  ] = await Promise.all([
    supabase.from("resources").select("id, name").eq("resource_type", "person").order("name", { ascending: true }),
    supabase
      .from("event_settlement_participants")
      .select("id, resource_id, amount_owed, resources(name)")
      .eq("event_id", id),
    supabase
      .from("event_expenses")
      .select("id, description, amount, expense_date, paid_by_resource_id, resources(name)")
      .eq("event_id", id)
      .order("expense_date", { ascending: false }),
    supabase
      .from("settlement_transfers")
      .select(
        "id, amount, status, from_resource_id, to_resource_id, from:resources!settlement_transfers_from_resource_id_fkey(name), to:resources!settlement_transfers_to_resource_id_fkey(name)",
      )
      .eq("event_id", id)
      .order("created_at", { ascending: true }),
  ]);

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

      <EditEventForm
        event={{
          id: event.id,
          name: event.name,
          event_type: event.event_type,
          status: event.status,
          start_at: event.start_at,
          end_at: event.end_at,
          venue_name: event.venue_name,
          venue_address: event.venue_address,
          total_amount: event.total_amount,
          notes: event.notes,
          client_id: event.client_id,
        }}
        clients={clients ?? []}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Material y recursos asignados
          </p>

          {materialBookings.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nada reservado todavía.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {materialBookings.map((booking) => {
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
                    <div className="flex items-center gap-2">
                      <ResourceStatusBadge status={resource.status} />
                      <RemoveBookingButton bookingId={booking.id} eventId={event.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <ApplyKitForm eventId={event.id} kits={kits ?? []} />

          <AddResourceForm
            eventId={event.id}
            organizationId={organizationId}
            candidates={availableCandidates}
          />
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Personal asignado
          </p>

          {personnelBookings.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nadie asignado todavía.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {personnelBookings.map((booking) => {
                const resource = booking.resources as unknown as {
                  id: string;
                  name: string;
                  status: string;
                } | null;
                if (!resource) return null;
                return (
                  <li key={booking.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{resource.name}</span>
                    <RemoveBookingButton bookingId={booking.id} eventId={event.id} />
                  </li>
                );
              })}
            </ul>
          )}

          <AddPersonnelForm
            eventId={event.id}
            organizationId={organizationId}
            candidates={availablePeopleCandidates}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EventChecklist
          eventId={event.id}
          organizationId={organizationId}
          items={checklistItems ?? []}
        />

        <EventPayments
          eventId={event.id}
          organizationId={organizationId}
          totalAmount={event.total_amount}
          payments={payments ?? []}
        />
      </div>

      <SettlementSection
        eventId={event.id}
        organizationId={organizationId}
        people={people ?? []}
        participants={(settlementParticipants ?? []) as unknown as Participant[]}
        expenses={(expenses ?? []) as unknown as Expense[]}
        transfers={(transfers ?? []) as unknown as Transfer[]}
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
