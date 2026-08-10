"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil, X } from "lucide-react";
import { EventStatusBadge } from "@/components/events/status-badge";
import { updateEvent, type UpdateEventState } from "@/app/(app)/eventos/[id]/actions";
import { EventFormFields, type EventData, type Client } from "@/app/(app)/eventos/event-form-fields";
import { eventDateFormatter } from "@/lib/utils/format";

export type EventRow = {
  id: string;
  name: string;
  event_type: string;
  status: string;
  start_at: string;
  end_at: string;
  venue_name: string | null;
  venue_address: string | null;
  total_amount: number | null;
  notes: string | null;
  client_id: string | null;
  clients: { name: string } | null;
};

export function EventsTable({ events, clients }: { events: EventRow[]; clients: Client[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Evento</th>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Lugar</th>
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {events.map((event) =>
            editingId === event.id ? (
              <EditRow
                key={event.id}
                event={event}
                clients={clients}
                onClose={() => setEditingId(null)}
              />
            ) : (
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
                  {event.clients?.name ?? "—"}
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
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditingId(event.id)}
                    aria-label="Editar"
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function EditRow({
  event,
  clients,
  onClose,
}: {
  event: EventData;
  clients: Client[];
  onClose: () => void;
}) {
  const action = updateEvent.bind(null, event.id);
  const initialState: UpdateEventState = null;
  const [state, formAction, pending] = useActionState(action, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      onClose();
    }
    wasPending.current = pending;
  }, [pending, state, onClose]);

  return (
    <tr className="bg-zinc-50 dark:bg-zinc-900">
      <td colSpan={6} className="p-4">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Editar evento
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cancelar"
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="size-4" />
            </button>
          </div>

          <EventFormFields event={event} clients={clients} compact />

          {state?.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          ) : null}

          <div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {pending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}
