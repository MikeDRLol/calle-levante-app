import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
};

export function PageHeader({ title, description, icon: Icon }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {Icon ? <Icon className="h-6 w-6" /> : null}
        {title}
      </h1>
      {description ? (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      ) : null}
    </header>
  );
}
