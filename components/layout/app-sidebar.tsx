"use client";

import { LogOut, Music2, X } from "lucide-react";
import { appConfig, mainNavItems } from "@/config/navigation";
import { NavLink } from "@/components/layout/nav-link";
import { logout } from "@/app/login/actions";
import { cn } from "@/lib/utils/cn";

type AppSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed?: boolean;
};

export function AppSidebar({
  mobileOpen,
  onMobileClose,
  collapsed = false,
}: AppSidebarProps) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-zinc-900/50 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onMobileClose}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-950 lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-20" : "lg:w-72",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-zinc-200 px-4 dark:border-zinc-800",
            collapsed ? "justify-center lg:px-2" : "justify-between",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center gap-2",
              collapsed && "lg:justify-center",
            )}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <Music2 className="size-5" aria-hidden />
            </div>
            {!collapsed ? (
              <div className="min-w-0 lg:block">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {appConfig.name}
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {appConfig.tagline}
                </p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 lg:hidden dark:hover:bg-zinc-800"
            onClick={onMobileClose}
            aria-label="Cerrar menú"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {mainNavItems.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  onNavigate={onMobileClose}
                  collapsed={collapsed}
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-zinc-200 px-3 py-4 dark:border-zinc-800">
          <form action={logout}>
            <button
              type="submit"
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
                collapsed && "justify-center px-2",
              )}
              title={collapsed ? "Cerrar sesión" : undefined}
            >
              <LogOut
                className="size-5 shrink-0 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                aria-hidden
              />
              {!collapsed ? <span className="truncate">Cerrar sesión</span> : null}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
