import Link from "next/link";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { currencyFormatter, eventDateFormatter } from "@/lib/utils/format";

export default async function LiquidacionesPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  const [{ data: events }, { data: participants }, { data: transfers }] = organizationId
    ? await Promise.all([
        supabase
          .from("events")
          .select("id, name, event_type, start_at")
          .order("start_at", { ascending: false }),
        supabase.from("event_settlement_participants").select("event_id, amount_owed"),
        supabase.from("settlement_transfers").select("event_id, amount, status"),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  const summaries = (events ?? [])
    .map((event) => {
      const eventParticipants = (participants ?? []).filter((p) => p.event_id === event.id);
      const eventTransfers = (transfers ?? []).filter((t) => t.event_id === event.id);
      const pendingTotal = eventTransfers
        .filter((t) => t.status === "pending")
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        event,
        participantCount: eventParticipants.length,
        pendingCount: eventTransfers.filter((t) => t.status === "pending").length,
        pendingTotal,
      };
    })
    .filter((s) => s.participantCount > 0);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Liquidaciones" description="Liquidaciones y pagos a terceros" />

      {!organizationId ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tu usuario todavía no pertenece a ninguna organización.
          </p>
        </div>
      ) : summaries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <Wallet className="size-6 text-zinc-400" aria-hidden />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Todavía no hay liquidaciones. Añade participantes en la ficha de un evento para empezar una.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Evento</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Participantes</th>
                <th className="px-4 py-3 font-medium">Bizums pendientes</th>
                <th className="px-4 py-3 font-medium">Total pendiente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {summaries.map(({ event, participantCount, pendingCount, pendingTotal }) => (
                <tr
                  key={event.id}
                  className="bg-white transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <td className="px-4 py-3">
                    <Link href={`/eventos/${event.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                      {event.name}
                    </Link>
                    <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">{event.event_type}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {eventDateFormatter.format(new Date(event.start_at))}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{participantCount}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{pendingCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`tabular-nums font-medium ${pendingTotal > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                    >
                      {currencyFormatter.format(pendingTotal)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
