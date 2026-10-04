import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { shellGrid, shellMain } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { ConsentBanner } from "@/modules/identity/components/consent-banner";
import { getPendingLegalDocuments } from "@/modules/identity/consent-refresh";
import { acceptUpdatedLegalAction } from "@/modules/identity/privacy-actions";
import { getViewer } from "@/modules/identity/session";
import type { NavCommunities, ViewerSummary } from "@/modules/identity/viewer-summary";
import { NAV_COOKIE } from "./nav-cookie";
import { ShellFrame } from "./shell-frame";
import { SideNav } from "./side-nav";
import { TopBar } from "./top-bar";

/**
 * Estructura de la red social (docs/design/rediseno-revista.md → F1).
 * - Móvil: marca, secciones principales en la barra superior y contenido.
 * - Escritorio: barra superior y rejilla 232 / 680 / 320 alineadas. Menos de 1280 px oculta la
 *   columna derecha; menos de 1024 px reduce la izquierda a íconos, y en escritorio la persona la
 *   pliega con el botón de arriba (ADR-046; cookie `speeaking-nav`).
 * - Página ancha (ADR-065): si el contenido trae `data-page-wide` (el perfil), las dos columnas
 *   laterales se ocultan y el contenido se centra a 992 px, como un perfil de Facebook. Es CSS
 *   (`:has`): la página lo pide con el atributo, sin otro layout ni otra ruta.
 */
export async function AppShell({
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
  const navOpen = (await cookies()).get(NAV_COOKIE)?.value !== "closed";
  return (
    <ShellFrame initialOpen={navOpen}>
      <TopBar viewer={viewer} />
      {viewer ? <LegalUpdateNotice /> : null}
      <div
        className={cn(
          shellGrid,
          "flex-1 md:items-start",
          "md:has-[[data-page-wide]]:grid-cols-[minmax(0,1fr)]! md:has-[[data-page-wide]]:[&>[data-rail]]:hidden!",
        )}
      >
        <SideNav viewer={viewer} communities={communities} />
        <main
          id="contenido"
          className={cn(
            "min-w-0 pb-8 md:pt-2 md:pb-12",
            shellMain,
            "md:has-[[data-page-wide]]:max-w-[62rem] md:has-[[data-page-wide]]:pt-0",
          )}
        >
          {children}
        </main>
        {aside ? (
          // Ocupa todo el alto de la fila para que su contenido pueda quedarse fijo (sticky) al
          // bajar; el scroll propio y el desvanecido los pone la columna misma (SocialAside).
          <aside
            data-rail=""
            aria-label="Más para ti"
            className="hidden self-stretch pt-4 xl:block"
          >
            {aside}
          </aside>
        ) : null}
      </div>
    </ShellFrame>
  );
}

/**
 * Aviso de documentos legales actualizados (`identity/consent-refresh.ts`): solo con sesión y si la
 * persona aceptó una versión anterior. No es indispensable: si la consulta falla, no se muestra.
 */
async function LegalUpdateNotice() {
  const documents = await pendingForViewer();
  if (documents.length === 0) return null;
  return <ConsentBanner documents={documents} action={acceptUpdatedLegalAction} />;
}

async function pendingForViewer() {
  try {
    const viewer = await getViewer();
    return viewer ? await getPendingLegalDocuments(viewer.userId) : [];
  } catch (error) {
    console.error("[identity] no se pudo revisar la versión de los documentos aceptados", error);
    return [];
  }
}
