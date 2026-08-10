const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmado",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  confirmed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

export function EventStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
