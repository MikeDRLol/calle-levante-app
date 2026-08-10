import Link from "next/link";
import { Receipt, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/organization";
import { currencyFormatter, dateFormatter } from "@/lib/utils/format";

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  bizum: "Bizum",
  card: "Tarjeta",
  other: "Otro",
};

type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  notes: string | null;
  events: { id: string; name: string; clients: { name: string } | null } | null;
};

export default async function FacturasPage() {
  const supabase = await createClient();
  const organizationId = await getActiveOrganizationId(supabase);

  const { data: payments } = organizationId
    ? await supabase
        .from("event_payments")
        .select("id, amount, method, paid_at, notes, events(id, name, clients(name))")
        .order("paid_at", { ascending: false })
    : { data: null };

  const rows = (payments ?? []) as unknown as PaymentRow[];
  const total = rows.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Facturas" description="Facturación y documentos" />

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Esto es un registro de los cobros ya recibidos por evento, no facturas con validez fiscal.
          Emitir facturas homologadas (Verifactu) requiere integrar un proveedor externo — todavía no
          está construido (ver <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">ADR-008</code>).
        </p>
      </div>

      {!organizationId ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tu usuario todavía no pertenece a ninguna organización.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <Receipt className="size-6 text-zinc-400" aria-hidden />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Todavía no hay cobros registrados. Se añaden desde la ficha de cada evento.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {rows.length} cobro{rows.length === 1 ? "" : "s"}
            </p>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Total: {currencyFormatter.format(total)}
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 font-medium">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((payment) => (
                  <tr key={payment.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {dateFormatter.format(new Date(payment.paid_at))}
                    </td>
                    <td className="px-4 py-3">
                      {payment.events ? (
                        <Link
                          href={`/eventos/${payment.events.id}`}
                          className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                        >
                          {payment.events.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {payment.events?.clients?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {METHOD_LABELS[payment.method] ?? payment.method}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium text-zinc-900 dark:text-zinc-50">
                      {currencyFormatter.format(payment.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
