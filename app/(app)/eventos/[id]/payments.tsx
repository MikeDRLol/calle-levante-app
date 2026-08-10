"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { addPayment, type AddPaymentState } from "@/app/(app)/eventos/[id]/actions";

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  bizum: "Bizum",
  card: "Tarjeta",
  other: "Otro",
};

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type Payment = {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  notes: string | null;
};

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

export function EventPayments({
  eventId,
  organizationId,
  totalAmount,
  payments,
}: {
  eventId: string;
  organizationId: string;
  totalAmount: number | null;
  payments: Payment[];
}) {
  const [open, setOpen] = useState(false);
  const action = addPayment.bind(null, eventId, organizationId);
  const initialState: AddPaymentState = null;
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const pending_ = totalAmount != null ? totalAmount - paid : null;

  return (
    <div className="flex flex-1 flex-col rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Cobros</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <Plus className="size-4" aria-hidden />
          Registrar pago
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Stat label="Total" value={totalAmount != null ? currencyFormatter.format(totalAmount) : "—"} />
        <Stat label="Cobrado" value={currencyFormatter.format(paid)} />
        <Stat
          label="Pendiente"
          value={pending_ != null ? currencyFormatter.format(pending_) : "—"}
          highlight={pending_ != null && pending_ > 0}
        />
      </div>

      {open ? (
        <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-4">
          <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Importe" className={inputClass} />
          <select name="method" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Método
            </option>
            {Object.entries(METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input name="paid_at" type="date" required className={inputClass} />
          <input name="notes" placeholder="Notas (opcional)" className={inputClass} />
          {state?.error ? (
            <p className="col-span-2 text-sm text-red-600 dark:text-red-400 sm:col-span-4">
              {state.error}
            </p>
          ) : null}
          <div className="col-span-2 sm:col-span-4">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {pending ? "Guardando..." : "Guardar pago"}
            </button>
          </div>
        </form>
      ) : null}

      {payments.length === 0 ? (
        <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">Sin pagos registrados.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {currencyFormatter.format(p.amount)}{" "}
                  <span className="font-normal text-zinc-500 dark:text-zinc-400">
                    · {METHOD_LABELS[p.method] ?? p.method}
                  </span>
                </p>
                {p.notes ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{p.notes}</p>
                ) : null}
              </div>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {dateFormatter.format(new Date(p.paid_at))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${highlight ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-50"}`}
      >
        {value}
      </p>
    </div>
  );
}
