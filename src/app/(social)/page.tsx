import { CircleUserRound, Compass } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { PeopleSuggestions } from "@/modules/discovery/components/people-suggestions";
import { Composer } from "@/modules/feed/components/composer";
import type { FeedSlot } from "@/modules/feed/components/feed-list";
import { HomeFeed } from "@/modules/feed/components/home-feed";
import { VisitorJoinCard } from "@/modules/feed/components/visitor-join-card";
import { WelcomeCard } from "@/modules/feed/components/welcome-card";
import { feedDateLabel, localDay } from "@/modules/feed/feed-date";
import { getHomeFirstPage } from "@/modules/feed/first-page";
import {
  firstNameOf,
  getHomeBubbles,
  getJoinableCommunities,
  getWelcomeMoment,
} from "@/modules/feed/home";
import { trackImpressions } from "@/modules/feed/impressions";
import { WELCOME_COOKIE } from "@/modules/feed/welcome";
import { getViewer } from "@/modules/identity/session";
import { getUnreadCounts } from "@/modules/social/unread";

/** «Gente de tus comunidades» entra una vez, después de la 6.ª pieza de la primera página (F6b). */
const PEOPLE_AFTER = 5;
/** «Arma tu feed» del visitante, después de la 2.ª publicación (F6). */
const JOIN_CARD_AFTER = 1;

/** «Para ti» con la fecha pequeña (hora de México). Sin «Tu edición de hoy»: no es un periódico. */
function FeedHeader({ subtitle }: { subtitle?: string }) {
  const now = new Date();
  return (
    <header className="flex flex-col gap-1.5 px-4 pt-4 pb-3 md:px-0 md:pt-2 md:pb-4">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-4xl leading-none font-extrabold md:text-5xl">Para ti</h1>
        <time
          dateTime={localDay(now)}
          className="shrink-0 pb-1 text-[11px] font-bold tracking-widest text-ink-2 uppercase md:text-xs"
        >
          {feedDateLabel(now)}
        </time>
      </div>
      {subtitle ? <p className="text-sm text-ink-2 md:text-[15px]">{subtitle}</p> : null}
    </header>
  );
}

export default async function HomePage() {
  const viewer = await getViewer();
  const viewerId = viewer?.userId ?? null;
  const profile = viewer?.profile ?? null;
  const onboarded = profile?.onboarded ?? false;
  const welcome = onboarded && (await cookies()).get(WELCOME_COOKIE)?.value === "1";

  // La primera página está en caché por request: la columna derecha la usa para no repetir en
  // «Lo que buscas» un producto que ya está aquí.
  // `unread` («N nuevas», F7) es la misma consulta que usa la columna izquierda (caché por request).
  const [page, bubbles, unread, joinable, moment] = await Promise.all([
    getHomeFirstPage(viewerId),
    getHomeBubbles(viewerId),
    viewerId ? getUnreadCounts(viewerId) : undefined,
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
    <HomeFeed
      header={<FeedHeader subtitle={viewer ? undefined : "Lo más nuevo de las comunidades"} />}
      bubbles={bubbles}
      unread={unread}
      isSignedIn={viewer !== null}
      initialPage={page}
      slots={slots}
      beforeFeed={
        viewer ? (
          <>
            {moment ? <WelcomeCard moment={moment} /> : null}
            {onboarded && profile ? (
              <Composer
                firstName={firstNameOf(profile.displayName)}
                displayName={profile.displayName}
                username={profile.username}
                avatarUrl={profile.avatarUrl}
              />
            ) : (
              <Link
                href="/bienvenida"
                className="flex items-center gap-3 border-b bg-card p-4 md:rounded-3xl md:border"
              >
                <CircleUserRound aria-hidden="true" className="size-5 shrink-0 text-primary-text" />
                <span className="text-sm">
                  <span className="font-semibold">Termina tu perfil</span> para que tu feed hable de
                  lo que te gusta.
                </span>
              </Link>
            )}
          </>
        ) : null
      }
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
  );
}
