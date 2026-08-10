import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

type SectionPlaceholderProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  children?: ReactNode;
};

export function SectionPlaceholder({
  title,
  description,
  icon,
  children,
}: SectionPlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title={title} description={description} icon={icon} />
      <div className="flex flex-1 flex-col rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
        {children ?? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Contenido pendiente de implementar.
          </p>
        )}
      </div>
    </div>
  );
}
