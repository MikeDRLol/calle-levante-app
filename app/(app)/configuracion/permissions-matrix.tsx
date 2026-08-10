"use client";

import { useState, useTransition } from "react";
import { togglePermission } from "@/app/(app)/configuracion/actions";

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  manager: "Manager",
  commercial: "Comercial",
  technician: "Técnico",
  accounting: "Contabilidad",
  client: "Cliente",
};

const PERMISSION_LABELS: Record<string, string> = {
  "locations.edit_structure": "Editar estructura del almacén",
  "organization.manage_permissions": "Gestionar estos permisos",
};

export type PermissionRow = {
  id: string;
  role: string;
  permission_key: string;
  allowed: boolean;
};

export function PermissionsMatrix({ permissions }: { permissions: PermissionRow[] }) {
  const permissionKeys = Array.from(new Set(permissions.map((p) => p.permission_key)));
  const roles = Array.from(new Set(permissions.map((p) => p.role)));

  const byRoleAndKey = new Map(permissions.map((p) => [`${p.role}:${p.permission_key}`, p]));

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Rol</th>
            {permissionKeys.map((key) => (
              <th key={key} className="px-4 py-3 font-medium">
                {PERMISSION_LABELS[key] ?? key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {roles.map((role) => (
            <tr key={role} className="bg-white dark:bg-zinc-950">
              <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                {ROLE_LABELS[role] ?? role}
              </td>
              {permissionKeys.map((key) => {
                const row = byRoleAndKey.get(`${role}:${key}`);
                return (
                  <td key={key} className="px-4 py-3">
                    {row ? <PermissionCheckbox row={row} /> : <span className="text-zinc-300">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PermissionCheckbox({ row }: { row: PermissionRow }) {
  const [allowed, setAllowed] = useState(row.allowed);
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      checked={allowed}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.checked;
        setAllowed(next);
        startTransition(async () => {
          const result = await togglePermission(row.id, next);
          if (result?.error) {
            setAllowed(!next);
          }
        });
      }}
      className="size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
    />
  );
}
