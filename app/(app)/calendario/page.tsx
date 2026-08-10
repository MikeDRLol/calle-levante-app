import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EventStatusBadge } from "@/components/events/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function parseMonth(param: string | undefined) {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [year, month] = param.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function toMonthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildGrid(monthStart: Date) {
  const firstDayOffset = (monthStart.getDay() + 6) % 7; // lunes = 0
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstDayOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const MONTH_LABEL = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
const TIME_LABEL = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const monthStart = parseMonth(monthParam);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  const prevMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  const days = buildGrid(monthStart);
  const gridStart = days[0];
  const gridEnd = days[days.length - 1];
  const gridEndExclusive = new Date(gridEnd);
  gridEndExclusive.setDate(gridEndExclusive.getDate() + 1);

  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  const { data: events } = organizationId
    ? await supabase
        .from("events")
        .select("id, name, event_type, status, start_at")
        .gte("start_at", gridStart.toISOString())
        .lt("start_at", gridEndExclusive.toISOString())
        .order("start_at", { ascending: true })
    : { data: null };

  type CalendarEvent = {
    id: string;
    name: string;
    event_type: string;
    status: string;
    start_at: string;
  };

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of (events ?? []) as CalendarEvent[]) {
    const key = toDateKey(new Date(event.start_at));
    const list = eventsByDay.get(key) ?? [];
    list.push(event);
    eventsByDay.set(key, list);
  }

  const today = toDateKey(new Date());

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Calendario" description="Agenda y planificación" />
        <div className="mb-8 flex items-center gap-1">
          <Link
            href={`/calendario?month=${toMonthParam(prevMonth)}`}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <span className="min-w-40 text-center text-sm font-medium capitalize text-zinc-900 dark:text-zinc-50">
            {MONTH_LABEL.format(monthStart)}
          </span>
          <Link
            href={`/calendario?month=${toMonthParam(nextMonth)}`}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      {!organizationId ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tu usuario todavía no pertenece a ninguna organización.
          </p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-7 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="bg-zinc-50 px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
            >
              {label}
            </div>
          ))}

          {days.map((day) => {
            const key = toDateKey(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            const inMonth = day.getMonth() === monthStart.getMonth();
            const isToday = key === today;

            return (
              <div
                key={key}
                className={`flex min-h-28 flex-col gap-1 bg-white p-1.5 dark:bg-zinc-950 ${inMonth ? "" : "opacity-40"}`}
              >
                <span
                  className={`self-start rounded-full px-1.5 text-xs ${isToday ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  {day.getDate()}
                </span>
                <div className="flex flex-col gap-0.5">
                  {dayEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={`/eventos/${event.id}`}
                      className="truncate rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      title={`${event.name} · ${TIME_LABEL.format(new Date(event.start_at))}`}
                    >
                      {TIME_LABEL.format(new Date(event.start_at))} {event.name}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {events && events.length > 0 ? (
        <div className="mt-6 flex flex-col gap-2">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Eventos de este mes</p>
          <ul className="flex flex-col gap-1.5">
            {events
              .filter((e) => new Date(e.start_at) >= monthStart && new Date(e.start_at) < monthEnd)
              .map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/eventos/${event.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{event.name}</span>
                    <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
                      <span>{TIME_LABEL.format(new Date(event.start_at))}</span>
                      <EventStatusBadge status={event.status} />
                    </div>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
