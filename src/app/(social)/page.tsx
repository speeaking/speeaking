import { Compass } from "lucide-react";
import { pageMetadata } from "@/app/seo";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { PeopleSuggestions } from "@/modules/discovery/components/people-suggestions";
import { Composer } from "@/modules/feed/components/composer";
import { type FeedSlot, FeedList } from "@/modules/feed/components/feed-list";
import { ProductReels } from "@/modules/feed/components/product-reels";
import { VisitorJoinCard } from "@/modules/feed/components/visitor-join-card";
import { WelcomeCard } from "@/modules/feed/components/welcome-card";
import { getHomeFirstPage, getHomeProductReels } from "@/modules/feed/first-page";
import { firstNameOf, getJoinableCommunities, getWelcomeMoment } from "@/modules/feed/home";
import { trackImpressions } from "@/modules/feed/impressions";
import { WELCOME_COOKIE } from "@/modules/feed/welcome";
import { getViewer } from "@/modules/identity/session";

/** «Gente de tus comunidades» entra una vez, después de la 6.ª pieza de la primera página (F6b). */
const PEOPLE_AFTER = 5;
/** «Arma tu feed» del visitante, después de la 2.ª publicación (F6). */
const JOIN_CARD_AFTER = 1;

export const metadata = pageMetadata({
  title: "Compra, vende y pruébate ropa con IA",
  description: siteConfig.description,
  path: "/",
});

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { cuenta } = await searchParams;
  const viewer = await getViewer();
  const viewerId = viewer?.userId ?? null;
  const profile = viewer?.profile ?? null;
  const onboarded = profile?.onboarded ?? false;
  const welcome = onboarded && (await cookies()).get(WELCOME_COOKIE)?.value === "1";

  // La primera página está en caché por request: la columna derecha la usa para no repetir en
  // «Lo que buscas» un producto que ya está aquí.
  const [page, reels, joinable, moment] = await Promise.all([
    getHomeFirstPage(viewerId),
    getHomeProductReels(viewerId),
    viewer ? Promise.resolve([]) : getJoinableCommunities(),
    welcome && viewerId && profile ? getWelcomeMoment(viewerId, profile.displayName) : null,
  ]);
  trackImpressions(page.items, viewerId, "FEED");

  const slots: FeedSlot[] = viewerId
    ? [
        {
          key: "gente-de-tus-comunidades",
          after: PEOPLE_AFTER,
          node: (
            // En móvil el carrusel flota con margen entre publicaciones de borde a borde. Con menos
            // de 3 candidatos (o cerrado) no pinta nada: `empty:hidden` no deja un hueco.
            <div className="border-b bg-background px-3 py-3 empty:hidden md:border-0 md:p-0">
              <Suspense fallback={null}>
                <PeopleSuggestions viewerId={viewerId} variant="feed" />
              </Suspense>
            </div>
          ),
        },
      ]
    : [
        {
          key: "arma-tu-feed",
          after: JOIN_CARD_AFTER,
          node: <VisitorJoinCard communities={joinable} />,
        },
      ];

  return (
    // Lo que la persona comparte, una vitrina breve de productos y el feed. La vitrina
    // usa una selección independiente que también funciona con catálogos pequeños.
    <div className="flex flex-col md:gap-4">
      <h1 className="sr-only">
        speeaking: descubre productos, pruébate prendas con IA y compra a vendedores de México
      </h1>
      <>
        {cuenta === "eliminada" && !viewer ? (
          <p role="status" className="border-b bg-card px-4 py-3 text-sm md:rounded-3xl md:border">
            Tu cuenta se eliminó. Gracias por probar {siteConfig.name}; aquí estaremos si vuelves.
          </p>
        ) : null}
        {moment ? <WelcomeCard moment={moment} /> : null}
        <Composer
          firstName={profile ? firstNameOf(profile.displayName) : undefined}
          displayName={profile?.displayName}
          username={profile?.username}
          avatarUrl={profile?.avatarUrl ?? null}
          isSignedIn={Boolean(viewer)}
          needsOnboarding={Boolean(viewer) && !onboarded}
        />
      </>
      <ProductReels block={reels} />
      <div>
        <FeedList
          initialPage={page}
          isSignedIn={viewer !== null}
          slots={slots}
          empty={
            <div className="px-4 pt-4 md:p-0">
              <EmptyState
                icon={Compass}
                title="Aún no hay publicaciones"
                description="Sé la primera persona en compartir algo con la comunidad."
                action={
                  <Link href="/crear/publicacion" className={buttonVariants()}>
                    Crear publicación
                  </Link>
                }
              />
            </div>
          }
        />
      </div>
      {!viewer ? (
        <section className="border-t px-4 py-6 text-sm text-muted-foreground md:rounded-3xl md:border md:bg-card">
          <h2 className="font-semibold text-foreground">Una comunidad para descubrir y comprar</h2>
          <p className="mt-2 leading-6">
            En speeaking puedes descubrir productos de vendedores, compartir lo que te gusta y
            visualizar prendas compatibles con una foto tuya antes de decidir.
          </p>
          <nav
            aria-label="Conoce speeaking"
            className="mt-3 flex flex-wrap gap-4 font-semibold text-primary-text"
          >
            <Link href="/como-funciona">Cómo funciona</Link>
            <Link href="/preguntas-frecuentes">Preguntas frecuentes</Link>
            <Link href="/comprar">Explorar productos</Link>
          </nav>
        </section>
      ) : null}
    </div>
  );
}
