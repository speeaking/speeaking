import { ImagePlus } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/states/empty-state";
import { ViewTransition } from "@/lib/view-transition";
import { listSellerShowcase } from "@/modules/catalog/queries";
import { getViewer } from "@/modules/identity/session";
import { PostCard } from "@/modules/social/components/post-card";
import { ProfileHeader } from "@/modules/social/components/profile/profile-header";
import { ProfilePhotos } from "@/modules/social/components/profile/profile-photos";
import { ProfileShop } from "@/modules/social/components/profile/profile-shop";
import { ProfileTabs, type ProfileTabItem } from "@/modules/social/components/profile/profile-tabs";
import { hydratePosts } from "@/modules/social/post-queries";
import { profileCover, profilePhotos, resolveProfileTab } from "@/modules/social/profile-copy";
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

/**
 * Perfil (ADR-055): portada con su última foto, cabecera con lo que tienen en común quien mira y
 * la persona, y pestañas Publicaciones · Fotos · Tienda (solo si vende). Entra con un fundido
 * cuando llega tras el esqueleto («pasar la página» vive en `loading.tsx` y `globals.css`).
 */
export default async function ProfilePage({ params, searchParams }: PageProps<"/u/[username]">) {
  const [{ username }, { ver }] = await Promise.all([params, searchParams]);
  const viewer = await getViewer();
  const profile = await getPublicProfile(username, viewer?.userId ?? null);
  if (!profile) notFound();

  const isOwn = viewer?.userId === profile.userId;
  const [postIds, products] = await Promise.all([
    db.post.findMany({
      where: { authorId: profile.userId, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: { id: true },
    }),
    profile.sellerId ? listSellerShowcase(profile.sellerId) : Promise.resolve([]),
  ]);
  const posts = await hydratePosts(
    postIds.map((post) => post.id),
    viewer?.userId ?? null,
  );
  const photos = profilePhotos(posts);

  const tabs: ProfileTabItem[] = [
    {
      id: "publicaciones",
      label: "Publicaciones",
      count: profile.postCount,
      content:
        posts.length === 0 ? (
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
          <section aria-label="Publicaciones" className="flex flex-col md:gap-4">
            {posts.map((post, index) => (
              <PostCard key={post.id} post={post} index={index} />
            ))}
          </section>
        ),
    },
    {
      id: "fotos",
      label: "Fotos",
      count: photos.length,
      content: <ProfilePhotos photos={photos} name={profile.displayName} />,
    },
    ...(products.length > 0
      ? [
          {
            id: "tienda" as const,
            label: "Tienda",
            count: products.length,
            content: <ProfileShop products={products} name={profile.displayName} />,
          },
        ]
      : []),
  ];

  return (
    <ViewTransition enter="page-ink" default="none">
      <div className="flex flex-col gap-4">
        <ProfileHeader
          profile={profile}
          inCommon={{
            people: profile.followedByPeopleYouFollow.people,
            peopleTotal: profile.followedByPeopleYouFollow.count,
            communities: profile.communitiesInCommon.map((community) => community.name),
          }}
          // Portada propia (ADR-058) o, sin ella, su última foto desenfocada (ADR-055).
          cover={profile.cover ?? profileCover(posts)}
          customCover={profile.cover !== null}
          isOwn={isOwn}
          isSignedIn={viewer !== null}
        />
        <ProfileTabs initial={resolveProfileTab(ver, products.length > 0)} items={tabs} />
      </div>
    </ViewTransition>
  );
}
