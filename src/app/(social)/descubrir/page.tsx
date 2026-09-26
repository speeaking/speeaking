import type { Metadata, Route } from "next";
import Link from "next/link";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { communitySignal } from "@/modules/identity/community-signal";
import { countPostsOfNewCommunities, listCommunities } from "@/modules/identity/service";
import { getViewer } from "@/modules/identity/session";
import { JoinButton } from "@/modules/social/components/join-button";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Descubrir" };

export default async function DiscoverPage() {
  const viewer = await getViewer();
  const [communities, newCommunityPosts, memberships] = await Promise.all([
    listCommunities(),
    countPostsOfNewCommunities(),
    viewer
      ? db.communityMembership.findMany({
          where: { userId: viewer.userId },
          select: { communityId: true },
        })
      : [],
  ]);
  const joined = new Set(memberships.map((membership) => membership.communityId));

  return (
    <>
      <PageHeader
        title="Descubrir"
        description="Comunidades para cada gusto. Únete a las que te laten."
      />
      <ul className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 md:px-0">
        {communities.map((community) => (
          <li key={community.id} className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
            <Link href={`/c/${community.slug}` as Route} className="flex items-center gap-3">
              <CommunityAvatar
                name={community.name}
                emoji={community.emoji}
                hue={community.hue}
                decorative
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-heading text-lg font-bold">{community.name}</span>
                <span className="text-xs text-muted-foreground">
                  {communitySignal({
                    memberCount: community.memberCount,
                    postCount: newCommunityPosts.get(community.id) ?? 0,
                  })}
                </span>
              </span>
            </Link>
            <p className="line-clamp-2 text-sm text-muted-foreground">{community.description}</p>
            <JoinButton
              communityId={community.id}
              communityName={community.name}
              communitySlug={community.slug}
              initialJoined={joined.has(community.id)}
              isSignedIn={Boolean(viewer)}
              size="sm"
            />
          </li>
        ))}
      </ul>
    </>
  );
}
