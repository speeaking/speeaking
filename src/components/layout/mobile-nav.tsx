"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isNavItemActive, socialNav } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { ViewerSummary } from "@/modules/identity/viewer-summary";

/** Cinco secciones bajo la marca; las etiquetas hacen visible el destino de cada icono. */
export function MobileNav({
  viewer,
  notifications = 0,
  accountMenu,
}: {
  viewer: ViewerSummary;
  notifications?: number;
  accountMenu?: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="border-t border-border/60 md:hidden">
      <ul className="grid h-[60px] grid-cols-5 px-1">
        {socialNav.map((item) => {
          const active = isNavItemActive(pathname, item, viewer?.username);
          const Icon = item.icon;
          const isNotifications = item.href === "/avisos";
          const row = cn(
            "relative flex h-full min-w-0 flex-col items-center justify-center gap-0.5 border-b-[3px] px-1 text-[10px] font-medium transition-colors",
            active
              ? "border-primary font-bold text-primary-text"
              : "border-transparent text-muted-foreground hover:text-foreground",
          );
          return (
            <li key={item.href} className="min-w-0">
              {item.href === "/perfil" && accountMenu ? (
                <div className={row}>
                  {accountMenu}
                  <span>Perfil</span>
                </div>
              ) : (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={
                    isNotifications && notifications
                      ? `Notificaciones (${notifications} sin leer)`
                      : item.label
                  }
                  className={row}
                >
                  <span className="relative">
                    <Icon className="size-6" aria-hidden="true" strokeWidth={active ? 2.5 : 2} />
                    {isNotifications && notifications > 0 ? (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-2 rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-background"
                      >
                        {notifications > 99 ? "99+" : notifications}
                      </span>
                    ) : null}
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
