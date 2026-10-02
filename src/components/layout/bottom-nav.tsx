"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserAvatar } from "@/components/brand/user-avatar";
import { isNavItemActive, socialNav } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { ViewerSummary } from "@/modules/identity/viewer-summary";
import { CreateMenu } from "./create-menu";

/** El «+» elevado del centro. */
const createTile =
  "grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg ring-4 shadow-primary/30 ring-background transition-transform active:scale-95";

/**
 * Barra inferior móvil. "Crear" va al centro, elevada, porque es la puerta a Sube y vende; con
 * sesión abre sus opciones ahí mismo (ADR-068) y sin sesión lleva a entrar. Cada pestaña sigue
 * activa en sus pantallas hijas (`/c/*` en Descubrir, el carrito en Comprar…) y Perfil muestra el
 * avatar de quien navega.
 */
export function BottomNav({ viewer }: { viewer: ViewerSummary }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-glass pb-safe backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {socialNav.map((item) => {
          const active = isNavItemActive(pathname, item, viewer?.username);
          const Icon = item.icon;
          const isCreate = item.href === "/crear";
          const isProfile = item.href === "/perfil";

          if (isCreate && viewer) {
            const Plus = item.icon;
            return (
              <li key={item.href} className="flex justify-center">
                <CreateMenu
                  side="top"
                  align="center"
                  trigger={
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      className="-mt-5 flex min-h-11 min-w-16 flex-col items-center justify-center rounded-xl px-2 py-1"
                    >
                      <span className={createTile}>
                        <Plus className="size-6" strokeWidth={2.5} />
                      </span>
                    </Link>
                  }
                />
              </li>
            );
          }

          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // Mínimo 44 px de ancho y alto para el dedo, aunque la etiqueta sea corta.
                  "flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors",
                  active && "font-bold text-foreground",
                  isCreate && "-mt-5",
                )}
              >
                {isCreate ? (
                  <span className={createTile}>
                    <Icon className="size-6" strokeWidth={2.5} />
                  </span>
                ) : isProfile && viewer ? (
                  <UserAvatar
                    name={viewer.displayName}
                    seed={viewer.username ?? viewer.displayName}
                    src={viewer.avatarUrl}
                    className={cn(
                      "size-6 text-[9px]",
                      active && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
                    )}
                  />
                ) : (
                  <Icon className="size-6" strokeWidth={active ? 2.5 : 2} />
                )}
                <span className={cn(isCreate && "sr-only")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
