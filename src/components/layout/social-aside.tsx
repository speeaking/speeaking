import Link from "next/link";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { PeopleSuggestions } from "@/modules/discovery/components/people-suggestions";
import { SocialRailBlocks, SocialRailSkeleton } from "@/modules/discovery/components/social-rail";
import { WelcomeCard } from "@/modules/discovery/components/welcome-card";
import { getViewer } from "@/modules/identity/session";
import type { ViewerSummary } from "@/modules/identity/viewer-summary";

/**
 * Columna derecha de escritorio «Para ti» (F4 + F6b), solo con datos reales.
 *
 * - Con sesión: Lo que buscas, Debates abiertos, Comunidades en movimiento, Gente de tus
 *   comunidades y el pie legal. Sube y vende vive solo en la columna izquierda (una entrada en
 *   escritorio, decisión del rediseño).
 * - Visitante: tarjeta de bienvenida, Debates abiertos, Comunidades en movimiento y el pie legal.
 *
 * Es sticky con scroll propio y un desvanecido abajo; el ancho y la columna los pone el shell. Los
 * datos llegan en streaming para no frenar el feed.
 */
export async function SocialAside({ viewer }: { viewer: ViewerSummary }) {
  // `getViewer` está en caché por request: no repite la consulta del layout.
  const viewerId = viewer ? ((await getViewer())?.userId ?? null) : null;

  return (
    // Mismo comportamiento que la columna izquierda: la barra superior mide 4rem y el shell deja
    // 1rem arriba, así que queda fija en 5rem sin saltos; scroll propio discreto y desvanecido.
    <div className="sticky top-20 -mx-1 max-h-[calc(100dvh-5rem)] [scrollbar-width:thin] [scrollbar-color:transparent_transparent] overflow-y-auto overscroll-contain mask-b-from-[calc(100%-2rem)] px-1 hover:[scrollbar-color:var(--color-line-strong)_transparent]">
      <div className="flex flex-col gap-4 pb-8">
        {viewerId ? null : <WelcomeCard />}
        <Suspense fallback={<SocialRailSkeleton />}>
          <SocialRailBlocks viewerId={viewerId} />
        </Suspense>
        {viewerId ? (
          <Suspense fallback={null}>
            <PeopleSuggestions viewerId={viewerId} variant="rail" />
          </Suspense>
        ) : null}
        <LegalFooter />
      </div>
    </div>
  );
}

function LegalFooter() {
  return (
    <footer className="px-2 text-xs leading-relaxed text-muted-foreground">
      <p>
        © {new Date().getFullYear()} {siteConfig.name} · Hecho en México
      </p>
      <p className="flex gap-3">
        <Link href="/privacidad" className="hover:text-foreground hover:underline">
          Privacidad
        </Link>
        <Link href="/terminos" className="hover:text-foreground hover:underline">
          Términos
        </Link>
      </p>
    </footer>
  );
}
