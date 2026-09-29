import { ImagePlus, LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserAvatar } from "@/components/brand/user-avatar";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatCompactNumber } from "@/lib/format";
import { SignOutButton } from "@/modules/identity/components/sign-out-button";
import { getViewer } from "@/modules/identity/session";
import { MessageButton } from "@/modules/messages/components/message-button";
import { FollowButton } from "@/modules/social/components/follow-button";
import { PostCard } from "@/modules/social/components/post-card";
import { hydratePosts } from "@/modules/social/post-queries";
import { getPublicProfile } from "@/modules/social/queries";
import { db } from "@/server/db";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const profile = await getPublicProfile((await params).username, null);
  return profile
    ? {
        title: `${profile.displayName} (@${profile.username})`,
        description: profile.bio ?? undefined,
      }
    : {};
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const viewer = await getViewer();
  const profile = await getPublicProfile(username, viewer?.userId ?? null);
  if (!profile) notFound();

  const isOwn = viewer?.userId === profile.userId;
  const postIds = await db.post.findMany({
    where: { authorId: profile.userId, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: { id: true },
  });
  const posts = await hydratePosts(
    postIds.map((post) => post.id),
    viewer?.userId ?? null,
  );

  // Contadores honestos: los ceros se ocultan (principio 5) y el singular concuerda («1 seguidor»).
  const stats = [
    { value: profile.postCount, label: ["publicación", "publicaciones"] },
    { value: profile.followerCount, label: ["seguidor", "seguidores"] },
    { value: profile.followingCount, label: ["siguiendo", "siguiendo"] },
  ]
    .filter((stat) => stat.value > 0)
    .map((stat) => ({ value: stat.value, label: stat.label[stat.value === 1 ? 0 : 1]! }));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 px-4 pt-5 md:px-0">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={profile.displayName}
            seed={profile.username}
            src={profile.avatarUrl}
            className="size-20 text-2xl"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-2xl font-extrabold">{profile.displayName}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.isEditorial ? (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold">
                  Cuenta editorial
                </span>
              ) : null}
              {profile.isSeller ? (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                  Vende en la comunidad
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {profile.bio ? <p className="text-[15px] leading-relaxed">{profile.bio}</p> : null}
        {stats.length > 0 ? (
          <dl className="flex flex-wrap gap-x-5 gap-y-1">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-1">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-heading text-lg font-bold">
                  {formatCompactNumber(stat.value)}
                </dd>
                <span className="text-sm text-muted-foreground" aria-hidden="true">
                  {stat.label}
                </span>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {isOwn ? (
            <>
              <Link href="/crear/publicacion" className={buttonVariants()}>
                <ImagePlus data-icon="inline-start" />
                Publicar
              </Link>
              <Link href="/studio" className={buttonVariants({ variant: "outline" })}>
                <LayoutDashboard data-icon="inline-start" />
                Studio
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <FollowButton
                targetUserId={profile.userId}
                targetName={profile.displayName}
                initialFollowing={profile.viewerFollows}
                isSignedIn={Boolean(viewer)}
              />
              {/* Las cuentas editoriales no reciben mensajes (ADR-047). */}
              {!profile.isEditorial ? (
                <MessageButton username={profile.username} isSignedIn={Boolean(viewer)} />
              ) : null}
            </>
          )}
        </div>
      </header>

      <section aria-label="Publicaciones" className="flex flex-col md:gap-4">
        {posts.length === 0 ? (
          <div className="px-4 md:px-0">
            <EmptyState
              icon={ImagePlus}
              title="Sin publicaciones todavía"
              description={
                isOwn ? "Comparte tu primera publicación con tus comunidades." : "Vuelve pronto."
              }
            />
          </div>
        ) : (
          posts.map((post, index) => <PostCard key={post.id} post={post} index={index} />)
        )}
      </section>
    </div>
  );
}
