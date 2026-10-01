import { BadgeCheck, ImagePlus, LayoutDashboard, PenLine, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/brand/user-avatar";
import { ShareButton } from "@/components/share-button";
import { buttonVariants } from "@/components/ui/button";
import { formatCompactNumber } from "@/lib/format";
import type { FeedMediaDTO } from "@/modules/feed/dto";
import { SignOutButton } from "@/modules/identity/components/sign-out-button";
import { MessageButton } from "@/modules/messages/components/message-button";
import { communitiesInCommonText, joinedText, peopleInCommonText } from "../../profile-copy";
import { FollowButton } from "../follow-button";
import { ProfileCover } from "./profile-cover";

export type ProfilePerson = { username: string; displayName: string; avatarUrl: string | null };

export type ProfileHeaderProps = {
  profile: {
    userId: string;
    username: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    city: string | null;
    joinedAt: Date;
    isEditorial: boolean;
    isSeller: boolean;
    followerCount: number;
    followingCount: number;
    postCount: number;
    viewerFollows: boolean;
  };
  /** Lo que quien mira tiene en común con el perfil (vacío sin sesión o en el propio). */
  inCommon: { people: ProfilePerson[]; peopleTotal: number; communities: string[] };
  cover: FeedMediaDTO | null;
  isOwn: boolean;
  isSignedIn: boolean;
};

function Dot() {
  return <span aria-hidden="true">·</span>;
}

/**
 * Cabecera del perfil (ADR-055): portada, nombre con sus distintivos, bio, contadores honestos (los
 * ceros se ocultan), una sola acción primaria y la línea «en común» con quien mira.
 */
export function ProfileHeader({ profile, inCommon, cover, isOwn, isSignedIn }: ProfileHeaderProps) {
  const stats = [
    { value: profile.postCount, label: ["publicación", "publicaciones"] },
    { value: profile.followerCount, label: ["seguidor", "seguidores"] },
    { value: profile.followingCount, label: ["siguiendo", "siguiendo"] },
  ]
    .filter((stat) => stat.value > 0)
    .map((stat) => ({ value: stat.value, label: stat.label[stat.value === 1 ? 0 : 1]! }));
  const people = peopleInCommonText(
    inCommon.people.map((person) => person.displayName),
    inCommon.peopleTotal,
  );
  const communities = communitiesInCommonText(inCommon.communities);
  const path = `/u/${profile.username}`;

  return (
    <header className="flex flex-col gap-4">
      <ProfileCover
        name={profile.displayName}
        username={profile.username}
        avatarUrl={profile.avatarUrl}
        cover={cover}
        isSeller={profile.isSeller}
      />
      <div className="flex flex-col gap-3 px-4 pt-10 md:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl leading-tight font-extrabold tracking-heading text-balance md:text-3xl">
            {profile.displayName}
          </h1>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
            <span>@{profile.username}</span>
            {profile.city ? (
              <>
                <Dot />
                <span>{profile.city}</span>
              </>
            ) : null}
            <Dot />
            <span>{joinedText(profile.joinedAt)}</span>
          </p>
          {profile.isSeller || profile.isEditorial ? (
            <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Distintivos">
              {profile.isSeller ? (
                <li className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                  <ShoppingBag aria-hidden="true" className="size-3.5" />
                  Tienda
                </li>
              ) : null}
              {profile.isEditorial ? (
                <li className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">
                  <BadgeCheck aria-hidden="true" className="size-3.5" />
                  Cuenta editorial
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        {profile.bio ? <p className="text-[15px] leading-relaxed">{profile.bio}</p> : null}

        {stats.length > 0 ? (
          <dl className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {stats.map((stat, index) => (
              <div key={stat.label} className="flex items-baseline gap-1">
                {index > 0 ? (
                  <span aria-hidden="true" className="pr-1">
                    ·
                  </span>
                ) : null}
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-heading text-base font-bold text-foreground tabular-nums">
                  {formatCompactNumber(stat.value)}
                </dd>
                <span aria-hidden="true">{stat.label}</span>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {isOwn ? (
            <>
              <Link href="/crear/publicacion" className={buttonVariants({ size: "lg" })}>
                <ImagePlus data-icon="inline-start" />
                Publicar
              </Link>
              <Link href="/ajustes" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <PenLine data-icon="inline-start" />
                Editar perfil
              </Link>
              <Link href="/studio" className={buttonVariants({ variant: "outline", size: "lg" })}>
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
                isSignedIn={isSignedIn}
                className="h-9"
              />
              {/* Las cuentas editoriales no reciben mensajes (ADR-047). */}
              {!profile.isEditorial ? (
                <MessageButton
                  username={profile.username}
                  isSignedIn={isSignedIn}
                  className="h-9"
                />
              ) : null}
              <ShareButton
                path={path}
                title={profile.displayName}
                text={profile.bio ?? undefined}
                label="Compartir perfil"
                size="icon"
              />
            </>
          )}
        </div>

        {people || communities ? (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            {inCommon.people.length > 0 ? (
              <span aria-hidden="true" className="flex shrink-0 -space-x-2">
                {inCommon.people.slice(0, 3).map((person) => (
                  <UserAvatar
                    key={person.username}
                    name={person.displayName}
                    seed={person.username}
                    src={person.avatarUrl}
                    className="size-7 text-[10px] ring-2 ring-background"
                  />
                ))}
              </span>
            ) : null}
            <span className="flex min-w-0 flex-col leading-snug">
              {people ? <span>{people}</span> : null}
              {communities ? <span>{communities}</span> : null}
            </span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
