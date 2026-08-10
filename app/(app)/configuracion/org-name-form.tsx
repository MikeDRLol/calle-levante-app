"use client";

import { useActionState } from "react";
import { updateOrganizationName, type UpdateOrgState } from "@/app/(app)/configuracion/actions";

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600";

export function OrgNameForm({ organizationId, name }: { organizationId: string; name: string }) {
  const action = updateOrganizationName.bind(null, organizationId);
  const initialState: UpdateOrgState = null;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Nombre de la organización
        </label>
        <input id="name" name="name" required defaultValue={name} className={inputClass} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Guardando..." : "Guardar"}
      </button>
      {state?.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}
    </form>
  );
}
