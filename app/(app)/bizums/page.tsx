import Link from "next/link";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TransferRow, type BizumRow } from "@/app/(app)/bizums/transfer-row";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { currencyFormatter, dateFormatter } from "@/lib/utils/format";

export default async function BizumsPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  const { data: transfers } = organizationId
    ? await supabase
        .from("settlement_transfers")
        .select(
          "id, amount, status, paid_at, created_at, event:events(id, name), from:resources!settlement_transfers_from_resource_id_fkey(name), to:resources!settlement_transfers_to_resource_id_fkey(name)",
        )
        .order("created_at", { ascending: false })
    : { data: null };

  const rows = (transfers ?? []) as unknown as (BizumRow & { paid_at: string | null; created_at: string })[];
  const pending = rows.filter((t) => t.status === "pending");
  const paid = rows.filter((t) => t.status === "paid");

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Bizums" description="Transferencias de liquidación pendientes y pagadas" />

      {!organizationId ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tu usuario todavía no pertenece a ninguna organización.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {pending.length} pendiente{pending.length === 1 ? "" : "s"}
            </p>
          </div>

          {pending.length === 0 ? (
            <div className="mb-8 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
              <CreditCard className="size-6 text-zinc-400" aria-hidden />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No hay bizums pendientes. Se generan al recalcular la liquidación de un evento.
              </p>
            </div>
          ) : (
            <div className="mb-8 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Evento</th>
                    <th className="px-4 py-3 font-medium">Paga</th>
                    <th className="px-4 py-3 font-medium">Cobra</th>
                    <th className="px-4 py-3 font-medium">Importe</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {pending.map((t) => (
                    <TransferRow key={t.id} transfer={t} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {paid.length > 0 ? (
            <>
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Historial ({paid.length})
              </p>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Evento</th>
                      <th className="px-4 py-3 font-medium">Paga</th>
                      <th className="px-4 py-3 font-medium">Cobra</th>
                      <th className="px-4 py-3 font-medium">Importe</th>
                      <th className="px-4 py-3 font-medium">Pagado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {paid.map((t) => (
                      <tr key={t.id} className="bg-white dark:bg-zinc-950">
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                          {t.event ? (
                            <Link href={`/eventos/${t.event.id}`} className="hover:underline">
                              {t.event.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{t.from?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{t.to?.name ?? "—"}</td>
                        <td className="px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">
                          {currencyFormatter.format(t.amount)}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                          {t.paid_at ? dateFormatter.format(new Date(t.paid_at)) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
