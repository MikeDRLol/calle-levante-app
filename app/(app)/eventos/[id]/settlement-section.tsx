"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Plus, X, RefreshCw, Check } from "lucide-react";
import {
  addSettlementParticipant,
  removeParticipant,
  updateParticipantAmount,
  addExpense,
  removeExpense,
  recalculateSettlement,
  markTransferPaid,
  type AddParticipantState,
  type AddExpenseState,
} from "@/app/(app)/eventos/[id]/settlement-actions";
import { currencyFormatter, dateFormatter } from "@/lib/utils/format";

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

export type Person = { id: string; name: string };
export type Participant = {
  id: string;
  resource_id: string;
  amount_owed: number;
  resources: { name: string } | null;
};
export type Expense = {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  paid_by_resource_id: string | null;
  resources: { name: string } | null;
};
export type Transfer = {
  id: string;
  amount: number;
  status: string;
  from_resource_id: string;
  to_resource_id: string;
  from: { name: string } | null;
  to: { name: string } | null;
};

export function SettlementSection({
  eventId,
  organizationId,
  people,
  participants,
  expenses,
  transfers,
}: {
  eventId: string;
  organizationId: string;
  people: Person[];
  participants: Participant[];
  expenses: Expense[];
  transfers: Transfer[];
}) {
  const pending = transfers.filter((t) => t.status === "pending");
  const paid = transfers.filter((t) => t.status === "paid");

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Liquidación
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ParticipantsBlock eventId={eventId} organizationId={organizationId} people={people} participants={participants} />
        <ExpensesBlock eventId={eventId} organizationId={organizationId} people={people} expenses={expenses} />
      </div>

      <TransfersBlock eventId={eventId} pending={pending} paid={paid} />
    </div>
  );
}

function ParticipantsBlock({
  eventId,
  organizationId,
  people,
  participants,
}: {
  eventId: string;
  organizationId: string;
  people: Person[];
  participants: Participant[];
}) {
  const initialState: AddParticipantState = null;
  const action = addSettlementParticipant.bind(null, eventId, organizationId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Participantes</h3>

      {participants.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin participantes todavía.</p>
      ) : (
        <ul className="mb-2 flex flex-col gap-1.5">
          {participants.map((p) => (
            <ParticipantRow key={p.id} eventId={eventId} participant={p} />
          ))}
        </ul>
      )}

      {people.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No hay personas dadas de alta (recursos de tipo &quot;person&quot;) en la organización.
        </p>
      ) : (
        <form ref={formRef} action={formAction} className="flex items-center gap-2">
          <select name="resource_id" required defaultValue="" className={`flex-1 ${inputClass}`}>
            <option value="" disabled>
              Persona…
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            name="amount_owed"
            type="number"
            step="0.01"
            placeholder="Importe"
            className={`w-28 ${inputClass}`}
          />
          <button
            type="submit"
            disabled={pending}
            aria-label="Añadir participante"
            className="flex items-center justify-center rounded-lg bg-zinc-900 p-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </form>
      )}
      {state?.error ? <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{state.error}</p> : null}
    </div>
  );
}

function ParticipantRow({ eventId, participant }: { eventId: string; participant: Participant }) {
  const [amount, setAmount] = useState(String(participant.amount_owed));
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-sm text-zinc-700 dark:text-zinc-300">
        {participant.resources?.name ?? "—"}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step="0.01"
          value={amount}
          disabled={isPending}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => {
            const value = Number(amount);
            if (!Number.isNaN(value) && value !== participant.amount_owed) {
              startTransition(() => updateParticipantAmount(participant.id, eventId, value));
            }
          }}
          className={`w-24 py-1 text-right ${inputClass}`}
        />
        <button
          type="button"
          onClick={() => startTransition(() => removeParticipant(participant.id, eventId))}
          aria-label="Quitar participante"
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </li>
  );
}

function ExpensesBlock({
  eventId,
  organizationId,
  people,
  expenses,
}: {
  eventId: string;
  organizationId: string;
  people: Person[];
  expenses: Expense[];
}) {
  const initialState: AddExpenseState = null;
  const action = addExpense.bind(null, eventId, organizationId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  const [isRemoving, startTransition] = useTransition();

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Gastos</h3>

      {expenses.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin gastos todavía.</p>
      ) : (
        <ul className="mb-2 flex flex-col gap-1.5">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-700 dark:text-zinc-300">
                {e.description}
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {" "}
                  · {dateFormatter.format(new Date(e.expense_date))}
                  {e.resources ? ` · adelantado por ${e.resources.name}` : ""}
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                  {currencyFormatter.format(e.amount)}
                </span>
                <button
                  type="button"
                  disabled={isRemoving}
                  onClick={() => startTransition(() => removeExpense(e.id, eventId))}
                  aria-label="Quitar gasto"
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input name="description" placeholder="Descripción" className={`flex-1 ${inputClass}`} />
          <input name="amount" type="number" min="0.01" step="0.01" placeholder="€" className={`w-24 ${inputClass}`} />
        </div>
        <div className="flex gap-2">
          <select name="paid_by_resource_id" defaultValue="" className={`flex-1 ${inputClass}`}>
            <option value="">Lo adelantó la empresa</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input name="expense_date" type="date" className={inputClass} />
          <button
            type="submit"
            disabled={pending}
            aria-label="Añadir gasto"
            className="flex items-center justify-center rounded-lg bg-zinc-900 p-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </form>
      {state?.error ? <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{state.error}</p> : null}
    </div>
  );
}

function TransfersBlock({
  eventId,
  pending,
  paid,
}: {
  eventId: string;
  pending: Transfer[];
  paid: Transfer[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Transferencias (Bizums)</h3>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => recalculateSettlement(eventId))}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} aria-hidden />
          Recalcular liquidación
        </button>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sin transferencias pendientes. Pulsa &quot;Recalcular liquidación&quot; tras añadir participantes o gastos.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {pending.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-700 dark:text-zinc-300">
                {t.from?.name ?? "—"} <span className="text-zinc-400">→</span> {t.to?.name ?? "—"}
              </span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-50">
                  {currencyFormatter.format(t.amount)}
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => markTransferPaid(t.id, eventId))}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  <Check className="size-3.5" aria-hidden />
                  Pagado
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {paid.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-zinc-500 dark:text-zinc-400">
            {paid.length} transferencia{paid.length === 1 ? "" : "s"} ya pagada{paid.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {paid.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>
                  {t.from?.name ?? "—"} → {t.to?.name ?? "—"}
                </span>
                <span className="tabular-nums">{currencyFormatter.format(t.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

