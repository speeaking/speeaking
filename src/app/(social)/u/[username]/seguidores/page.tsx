import type { Metadata } from "next";
import { NO_INDEX } from "@/app/seo";
import { notFound } from "next/navigation";
import { getViewer } from "@/modules/identity/session";
import { FollowList } from "@/modules/social/components/profile/follow-list";
import { listFollowPeople } from "@/modules/social/follow-lists";
import { getProfile } from "../profile";

export async function generateMetadata({
  params,
}: PageProps<"/u/[username]/seguidores">): Promise<Metadata> {
  const profile = await getProfile((await params).username);
  return profile
    ? { robots: NO_INDEX, title: `Seguidores de ${profile.displayName}` }
    : { robots: NO_INDEX };
}

/** Quién sigue a este perfil (ADR-058). */
export default async function FollowersPage({
  params,
  searchParams,
}: PageProps<"/u/[username]/seguidores">) {
  const [{ username }, { despues }] = await Promise.all([params, searchParams]);
  const viewer = await getViewer();
  // Sin quien mira: aquí no hace falta lo «en común» del perfil.
  const profile = await getProfile(username);
  if (!profile) notFound();
  const page = await listFollowPeople({
    profileUserId: profile.userId,
    direction: "followers",
    viewerId: viewer?.userId ?? null,
    after: typeof despues === "string" ? despues : null,
  });
  return (
    <FollowList profile={profile} direction="followers" page={page} isSignedIn={viewer !== null} />
  );
}
