"use client";

import { Menu } from "lucide-react";

type AppHeaderProps = {
  onMenuOpen: () => void;
  title?: string;
};

export function AppHeader({ onMenuOpen, title }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80 lg:px-6">
      <button
        type="button"
        className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
        onClick={onMenuOpen}
        aria-label="Abrir menú"
      >
        <Menu className="size-5" />
      </button>
      {title ? (
        <p className="truncate text-sm font-medium text-zinc-500 lg:hidden dark:text-zinc-400">
          {title}
        </p>
      ) : null}
    </header>
  );
}
