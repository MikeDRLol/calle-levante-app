const EVENT_TYPES = [
  { value: "boda", label: "Boda" },
  { value: "concierto", label: "Concierto" },
  { value: "dj", label: "DJ" },
  { value: "verbena", label: "Verbena" },
  { value: "comunion", label: "Comunión" },
  { value: "otro", label: "Otro" },
];

const EVENT_STATUSES = [
  { value: "draft", label: "Borrador" },
  { value: "confirmed", label: "Confirmado" },
  { value: "in_progress", label: "En curso" },
  { value: "completed", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
];

export const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

export function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type EventData = {
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
  client_id?: string | null;
};

export type Client = { id: string; name: string };

export function EventFormFields({
  event,
  clients,
  compact = false,
}: {
  event: EventData;
  clients: Client[];
  compact?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 gap-4 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Nombre
        </label>
        <input id="name" name="name" required defaultValue={event.name} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="event_type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Tipo
        </label>
        <select id="event_type" name="event_type" required defaultValue={event.event_type} className={inputClass}>
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Estado
        </label>
        <select id="status" name="status" required defaultValue={event.status} className={inputClass}>
          {EVENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="client_id" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Cliente
        </label>
        <select id="client_id" name="client_id" defaultValue={event.client_id ?? ""} className={inputClass}>
          <option value="">Sin cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="total_amount" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Importe acordado (€)
        </label>
        <input
          id="total_amount"
          name="total_amount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={event.total_amount ?? ""}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="start_at" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Inicio
        </label>
        <input
          id="start_at"
          name="start_at"
          type="datetime-local"
          required
          defaultValue={toDatetimeLocal(event.start_at)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="end_at" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Fin
        </label>
        <input
          id="end_at"
          name="end_at"
          type="datetime-local"
          required
          defaultValue={toDatetimeLocal(event.end_at)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="venue_name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Lugar
        </label>
        <input id="venue_name" name="venue_name" defaultValue={event.venue_name ?? ""} className={inputClass} />
      </div>

      {!compact ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="venue_address" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Dirección
          </label>
          <input
            id="venue_address"
            name="venue_address"
            defaultValue={event.venue_address ?? ""}
            className={inputClass}
          />
        </div>
      ) : null}

      {!compact ? (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notas
          </label>
          <textarea id="notes" name="notes" rows={2} defaultValue={event.notes ?? ""} className={inputClass} />
        </div>
      ) : null}
    </div>
  );
}
