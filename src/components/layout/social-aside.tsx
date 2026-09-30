import Link from "next/link";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import { SponsoredRail } from "@/modules/billing/components/sponsored-products";
import { listFeaturedProducts } from "@/modules/catalog/queries";
import { PeopleSuggestions } from "@/modules/discovery/components/people-suggestions";
import { SocialRailBlocks, SocialRailSkeleton } from "@/modules/discovery/components/social-rail";
import { WelcomeCard } from "@/modules/discovery/components/welcome-card";
import { getViewer } from "@/modules/identity/session";
import type { ViewerSummary } from "@/modules/identity/viewer-summary";
import { SupportCard } from "@/modules/platform/components/support-card";
import { env } from "@/server/env";

/**
 * Columna derecha de escritorio «Para ti» (F4 + F6b), solo con datos reales. Arriba, el bloque
 * «Patrocinado» (ADR-046): es la columna de publicidad, como en las redes que la gente ya conoce.
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
  const sponsored = await listFeaturedProducts({ limit: 2, excludeUserId: viewerId }).catch(
    (error: unknown) => {
      console.error("[billing] no se pudieron cargar los destacados", error);
      return [];
    },
  );

  return (
    // Mismo comportamiento que la columna izquierda: la barra superior mide 4rem y el shell deja
    // 1rem arriba, así que queda fija en 5rem sin saltos; scroll propio discreto y desvanecido.
    <div className="sticky top-20 -mx-1 max-h-[calc(100dvh-5rem)] [scrollbar-width:thin] [scrollbar-color:transparent_transparent] overflow-y-auto overscroll-contain mask-b-from-[calc(100%-2rem)] px-1 hover:[scrollbar-color:var(--color-line-strong)_transparent]">
      <div className="flex flex-col gap-4 pb-8">
        {viewerId ? null : <WelcomeCard />}
        <SponsoredRail products={sponsored} isSeller={viewer?.isSeller ?? false} />
        {env.SUPPORT_URL ? <SupportCard href={env.SUPPORT_URL} /> : null}
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
        <Link href="/seguridad" className="hover:text-foreground hover:underline">
          Seguridad
        </Link>
        <Link href="/apoya" className="hover:text-foreground hover:underline">
          Apoya
        </Link>
      </p>
    </footer>
  );
}
