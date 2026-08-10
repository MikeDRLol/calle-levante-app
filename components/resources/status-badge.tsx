const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  in_use: "En uso",
  in_repair: "En reparación",
  out_of_service: "Fuera de servicio",
  retired: "Retirado",
};

const STATUS_STYLES: Record<string, string> = {
  available:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  in_use: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  in_repair:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  out_of_service: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  retired: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function ResourceStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.available}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
