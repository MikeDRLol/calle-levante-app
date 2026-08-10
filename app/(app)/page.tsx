import Link from "next/link";
import { CalendarClock, Music2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EventStatusBadge } from "@/components/events/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { eventDateFormatter } from "@/lib/utils/format";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  if (!organizationId) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Dashboard" description="Resumen general del negocio" />
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tu usuario todavía no pertenece a ninguna organización.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = addDays(todayStart, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const monthStart = startOfMonth(now);
  const monthEnd = addMonths(monthStart, 1);

  const [{ count: todayCount }, { count: weekCount }, { count: monthCount }, { data: upcoming }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("start_at", todayStart.toISOString())
        .lt("start_at", todayEnd.toISOString()),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("start_at", weekStart.toISOString())
        .lt("start_at", weekEnd.toISOString()),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("start_at", monthStart.toISOString())
        .lt("start_at", monthEnd.toISOString()),
      supabase
        .from("events")
        .select("id, name, event_type, status, start_at, venue_name, clients(name)")
        .gte("start_at", now.toISOString())
        .order("start_at", { ascending: true })
        .limit(5),
    ]);

  const stats = [
    { label: "Eventos hoy", value: todayCount ?? 0 },
    { label: "Esta semana", value: weekCount ?? 0 },
    { label: "Este mes", value: monthCount ?? 0 },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title="Dashboard" description="Resumen general del negocio" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Próximos eventos
            </h2>
          </div>
          <Link
            href="/eventos"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Ver todos
          </Link>
        </div>

        {!upcoming || upcoming.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
            <Music2 className="size-6 text-zinc-400" aria-hidden />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No hay eventos próximos.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {upcoming.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                    {event.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {(event.clients as unknown as { name: string } | null)?.name ??
                      event.venue_name ??
                      "—"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">
                    {eventDateFormatter.format(new Date(event.start_at))}
                  </span>
                  <EventStatusBadge status={event.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
