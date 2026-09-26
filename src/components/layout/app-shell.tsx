import type { ReactNode } from "react";
import { shellGrid } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { NavCommunities, ViewerSummary } from "@/modules/identity/viewer-summary";
import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";
import { TopBar } from "./top-bar";

/**
 * Estructura de la red social (docs/design/rediseno-revista.md → F1).
 * - Móvil: barra superior compacta, contenido y barra inferior.
 * - Escritorio: barra superior y rejilla 232 / 680 / 320 alineadas. Menos de 1280 px oculta la
 *   columna derecha; menos de 1024 px reduce la izquierda a íconos.
 */
export function AppShell({
  children,
  aside,
  viewer,
  communities,
}: {
  children: ReactNode;
  aside?: ReactNode;
  viewer: ViewerSummary;
  communities: NavCommunities;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar viewer={viewer} />
      <div className={cn(shellGrid, "flex-1 md:items-start")}>
        <SideNav viewer={viewer} communities={communities} />
        <main id="contenido" className="min-w-0 pb-24 md:pt-2 md:pb-12">
          {children}
        </main>
        {aside ? (
          // Ocupa todo el alto de la fila para que su contenido pueda quedarse fijo (sticky) al
          // bajar; el scroll propio y el desvanecido los pone la columna misma (SocialAside).
          <aside aria-label="Más para ti" className="hidden self-stretch pt-4 xl:block">
            {aside}
          </aside>
        ) : null}
      </div>
      <BottomNav viewer={viewer} />
    </div>
  );
}
