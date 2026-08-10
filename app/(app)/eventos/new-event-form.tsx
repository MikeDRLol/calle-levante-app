"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { createEvent, type CreateEventState } from "@/app/(app)/eventos/actions";
import { MaterialPicker } from "@/app/(app)/eventos/material-picker";

const initialState: CreateEventState = null;

const EVENT_TYPES = [
  { value: "boda", label: "Boda" },
  { value: "concierto", label: "Concierto" },
  { value: "dj", label: "DJ" },
  { value: "verbena", label: "Verbena" },
  { value: "comunion", label: "Comunión" },
  { value: "otro", label: "Otro" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "bizum", label: "Bizum" },
  { value: "card", label: "Tarjeta" },
  { value: "other", label: "Otro" },
];

type Client = { id: string; name: string };
type Resource = { id: string; name: string; resource_type: string };
type Person = { id: string; name: string; resource_type: string };
type Kit = { id: string; name: string };

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export function NewEventForm({
  clients,
  resources,
  people,
  kits,
}: {
  clients: Client[];
  resources: Resource[];
  people: Person[];
  kits: Kit[];
}) {
  const [open, setOpen] = useState(false);
  const [useExistingClient, setUseExistingClient] = useState(false);
  const [totalAmount, setTotalAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [pickerKey, setPickerKey] = useState(0);
  const [state, formAction, pending] = useActionState(createEvent, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error && !state?.warning) {
      formRef.current?.reset();
      setUseExistingClient(false);
      setTotalAmount("");
      setDepositAmount("");
      setPickerKey((k) => k + 1);
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  const pendingAmount = useMemo(() => {
    const total = Number(totalAmount);
    const deposit = Number(depositAmount);
    if (!totalAmount || Number.isNaN(total)) return null;
    return total - (depositAmount && !Number.isNaN(deposit) ? deposit : 0);
  }, [totalAmount, depositAmount]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <Plus className="size-4" aria-hidden />
        Nuevo evento
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Nuevo evento
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <X className="size-4" />
        </button>
      </div>

      <form ref={formRef} action={formAction} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="name">
            <input id="name" name="name" required placeholder="Boda García" className={inputClass} />
          </Field>

          <Field label="Tipo" htmlFor="event_type">
            <select id="event_type" name="event_type" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Selecciona un tipo
              </option>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          {useExistingClient ? (
            <Field label="Cliente" htmlFor="client_id">
              <div className="flex items-center gap-2">
                <select id="client_id" name="client_id" defaultValue="" className={`flex-1 ${inputClass}`}>
                  <option value="">Sin cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setUseExistingClient(false)}
                  className="whitespace-nowrap text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Cliente nuevo
                </button>
              </div>
            </Field>
          ) : (
            <Field label="Cliente (nuevo)" htmlFor="new_client_name">
              <div className="flex items-center gap-2">
                <input
                  id="new_client_name"
                  name="new_client_name"
                  placeholder="Familia García"
                  className={`flex-1 ${inputClass}`}
                />
                {clients.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setUseExistingClient(true)}
                    className="whitespace-nowrap text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    Ya existente
                  </button>
                ) : null}
              </div>
            </Field>
          )}

          <Field label="Lugar" htmlFor="venue_name">
            <input
              id="venue_name"
              name="venue_name"
              placeholder="Finca El Rincón (opcional)"
              className={inputClass}
            />
          </Field>

          <Field label="Inicio" htmlFor="start_at">
            <input id="start_at" name="start_at" type="datetime-local" required className={inputClass} />
          </Field>

          <Field label="Fin" htmlFor="end_at">
            <input id="end_at" name="end_at" type="datetime-local" required className={inputClass} />
          </Field>
        </div>

        <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Material y recursos
          </p>

          {kits.length > 0 ? (
            <div className="mb-3 flex flex-col gap-1.5">
              <label htmlFor="kit_id" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Pack (opcional)
              </label>
              <select id="kit_id" name="kit_id" defaultValue="" className={inputClass}>
                <option value="">Sin pack</option>
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {resources.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No hay material disponible ahora mismo.
            </p>
          ) : (
            <MaterialPicker key={pickerKey} resources={resources} name="resource_ids" />
          )}
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Se comprobará que sigue libre para estas fechas justo al crear el evento.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Personal
          </p>
          {people.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No hay nadie dado de alta en{" "}
              <Link href="/personal" className="underline">
                Personal
              </Link>{" "}
              todavía.
            </p>
          ) : (
            <MaterialPicker key={pickerKey} resources={people} name="personnel_ids" />
          )}
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Quien añadas aquí entra automáticamente como participante en la liquidación del evento.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Cobro
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Importe total (€)" htmlFor="total_amount">
              <input
                id="total_amount"
                name="total_amount"
                type="number"
                min="0"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="Opcional"
                className={inputClass}
              />
            </Field>

            <Field label="Señal cobrada (€)" htmlFor="deposit_amount">
              <input
                id="deposit_amount"
                name="deposit_amount"
                type="number"
                min="0"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Opcional"
                className={inputClass}
              />
            </Field>

            <Field label="Método" htmlFor="deposit_method">
              <select id="deposit_method" name="deposit_method" defaultValue="" className={inputClass}>
                <option value="">—</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fecha de la señal" htmlFor="deposit_paid_at">
              <input id="deposit_paid_at" name="deposit_paid_at" type="date" className={inputClass} />
            </Field>
          </div>

          {totalAmount ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              Total <strong>{currencyFormatter.format(Number(totalAmount) || 0)}</strong>
              {" · "}Cobrado{" "}
              <strong>{currencyFormatter.format(Number(depositAmount) || 0)}</strong>
              {" · "}Pendiente{" "}
              <strong className={pendingAmount != null && pendingAmount > 0 ? "text-amber-600 dark:text-amber-400" : ""}>
                {currencyFormatter.format(pendingAmount ?? 0)}
              </strong>
            </p>
          ) : null}
        </div>

        {state?.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}
        {state?.warning ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">{state.warning}</p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Creando..." : "Crear evento"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {children}
    </div>
  );
}
