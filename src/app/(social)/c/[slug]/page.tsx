import { Users, Settings2 } from "lucide-react";
import { communitySeo, pageMetadata, NO_INDEX } from "@/app/seo";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import type { CSSProperties } from "react";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { EmptyState } from "@/components/states/empty-state";
import { FeedList } from "@/modules/feed/components/feed-list";
import { recommendationEngine } from "@/modules/feed/engine";
import { trackImpressions } from "@/modules/feed/impressions";
import { communitySignal, MIN_VISIBLE_MEMBERS } from "@/modules/identity/community-signal";
import { countCommunityPosts } from "@/modules/identity/service";
import { getViewer } from "@/modules/identity/session";
import { JoinButton } from "@/modules/social/components/join-button";
import { markCommunitySeen } from "@/modules/social/unread";
import { db } from "@/server/db";
import { getCommunity } from "./community";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CommunityInvitationCard } from "@/modules/communities/components/invitation-card";
import { Composer } from "@/modules/feed/components/composer";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const community = await getCommunity((await params).slug);
  return community
    ? pageMetadata({
        ...communitySeo(community),
        path: `/c/${encodeURIComponent(community.slug)}`,
      })
    : { robots: NO_INDEX };
}

export default async function CommunityPage({ params }: PageProps<"/c/[slug]">) {
  // Lo publicado desde aquí sigue siendo «nuevo» aunque llegue mientras se pinta la página (F7).
  const openedAt = new Date();
  const community = await getCommunity((await params).slug);
  if (!community) notFound();

  const viewer = await getViewer();
  const [page, membership, postCount, requestHeaders, invitation, removal] = await Promise.all([
    recommendationEngine.getFeed({ viewerId: viewer?.userId ?? null, communityId: community.id }),
    viewer
      ? db.communityMembership.findUnique({
          where: { userId_communityId: { userId: viewer.userId, communityId: community.id } },
          select: { userId: true, role: true },
        })
      : null,
    // Solo hace falta cuando la comunidad todavía no muestra su número de miembros.
    community.memberCount < MIN_VISIBLE_MEMBERS ? countCommunityPosts(community.id) : 0,
    headers(),
    viewer
      ? db.communityInvitation.findUnique({
          where: { userId_communityId: { userId: viewer.userId, communityId: community.id } },
          select: { userId: true },
        })
      : null,
    viewer
      ? db.communityRemoval.findUnique({
          where: { userId_communityId: { userId: viewer.userId, communityId: community.id } },
          select: { userId: true },
        })
      : null,
  ]);
  trackImpressions(page.items, viewer?.userId ?? null, "COMMUNITY");
  // «N nuevas» (F7): quien es miembro ya vio lo que hay. Después de responder, sin bloquear la
  // página. Un prefetch no es una visita (hoy no llega aquí por `loading.tsx`, pero por si acaso).
  if (viewer && membership && !requestHeaders.has("next-router-prefetch")) {
    const viewerId = viewer.userId;
    after(() =>
      markCommunitySeen(viewerId, community.id, openedAt).catch((error: unknown) => {
        console.error("[novedades] no se pudo marcar la comunidad como vista", error);
      }),
    );
  }

  return (
    <>
      <header
        style={{ "--hue": community.hue } as CSSProperties}
        // Tinte suave con tinta encima (ADR-042), no el cartel de color saturado.
        className="mx-4 mt-4 mb-5 flex flex-col gap-3 rounded-3xl border community-soft p-5 md:mx-0"
      >
        <CommunityAvatar
          name={community.name}
          emoji={community.emoji}
          hue={community.hue}
          size="lg"
          decorative
        />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold">{community.name}</h1>
            <p className="text-sm opacity-80">{community.description}</p>
            <p className="text-xs font-semibold opacity-70">
              {communitySignal({ memberCount: community.memberCount, postCount })}
            </p>
          </div>
          {community.ownerId === viewer?.userId ? (
            <span className="rounded-full border bg-card/60 px-3 py-2 text-sm font-semibold">
              Tu comunidad
            </span>
          ) : removal ? (
            <span className="text-sm font-semibold">Tu acceso fue retirado</span>
          ) : (
            <JoinButton
              communityId={community.id}
              communityName={community.name}
              communitySlug={community.slug}
              initialJoined={Boolean(membership)}
              isSignedIn={Boolean(viewer)}
              className="shrink-0"
            />
          )}
        </div>
        {membership ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/c/${community.slug}/miembros` as Route}
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11 gap-2 bg-card/60")}
            >
              {community.ownerId &&
              (community.ownerId === viewer?.userId || membership.role === "ADMIN") ? (
                <>
                  <Settings2 className="size-4" />
                  Administrar grupo
                </>
              ) : (
                <>
                  <Users className="size-4" />
                  Ver miembros
                </>
              )}
            </Link>
          </div>
        ) : null}
      </header>
      {invitation ? (
        <div className="mb-4 px-4 md:px-0">
          <CommunityInvitationCard community={community} />
        </div>
      ) : null}
      {viewer && (membership || community.isOfficial) && !removal ? (
        <div className="mb-4">
          <Composer
            displayName={viewer.profile?.displayName ?? viewer.name}
            username={viewer.profile?.username}
            avatarUrl={viewer.profile?.avatarUrl ?? null}
            communitySlug={community.slug}
            needsOnboarding={!viewer.profile?.onboarded}
          />
        </div>
      ) : null}
      <FeedList
        isSignedIn={Boolean(viewer)}
        initialPage={page}
        community={community.slug}
        empty={
          <div className="px-4 md:px-0">
            <EmptyState
              icon={Users}
              title="Todavía no hay publicaciones"
              description="Sé la primera persona en compartir algo con esta comunidad."
            />
          </div>
        }
      />
    </>
  );
}
