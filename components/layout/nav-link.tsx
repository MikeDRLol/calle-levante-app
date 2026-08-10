"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

type NavLinkProps = {
  item: NavItem;
  onNavigate?: () => void;
  collapsed?: boolean;
};

export function NavLink({ item, onNavigate, collapsed }: NavLinkProps) {
  const pathname = usePathname();
  const isActive =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.title : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon
        className={cn(
          "size-5 shrink-0",
          isActive
            ? "text-white dark:text-zinc-900"
            : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300",
        )}
        aria-hidden
      />
      {!collapsed ? <span className="truncate">{item.title}</span> : null}
    </Link>
  );
}
