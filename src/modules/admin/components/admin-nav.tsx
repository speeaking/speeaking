"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_AI_HREF, adminNav } from "../nav";

/** Barra lateral de /admin en escritorio. */
export function AdminSideNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administración">
      <ul className="flex flex-col gap-1">
        {adminNav.map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;
          const isAi = item.href === ADMIN_AI_HREF;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  active && "bg-secondary text-foreground",
                )}
              >
                <Icon className="size-[18px]" />
                {item.label}
                {isAi ? (
                  <span className="ml-auto rounded-full bg-ai px-1.5 py-px text-[10px] font-bold text-ai-foreground">
                    IA
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Pestañas desplazables de /admin en móvil. */
export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administración" className="scrollbar-none overflow-x-auto md:hidden">
      <ul className="flex w-max gap-2 px-4 pb-3">
        {adminNav.map((item) => {
          const active = isNavItemActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors",
                  active && "border-foreground bg-foreground text-background",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
