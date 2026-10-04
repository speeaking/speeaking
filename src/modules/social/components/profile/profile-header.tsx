import {
  BadgeCheck,
  LayoutDashboard,
  PenLine,
  ReceiptText,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import type { Route } from "next";
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
import { FriendshipButton } from "@/modules/relationships/components/friendship-button";
import type { FriendshipState } from "@/modules/relationships/types";

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
    friendship?: FriendshipState;
  };
  /** Lo que quien mira tiene en común con el perfil (vacío sin sesión o en el propio). */
  inCommon: { people: ProfilePerson[]; peopleTotal: number; communities: string[] };
  cover: FeedMediaDTO | null;
  /** La portada la subió la persona (ADR-058): se ve nítida. */
  customCover?: boolean;
  /** La tienda tiene productos a la venta: el perfil ajeno ofrece «Ver tienda». */
  hasShop?: boolean;
  isOwn: boolean;
  isSignedIn: boolean;
};

function Dot() {
  return <span aria-hidden="true">·</span>;
}

/**
 * Cabecera del perfil (ADR-055): portada, nombre con sus distintivos, bio, contadores honestos (los
 * ceros se ocultan), una sola acción primaria y la línea «en común» con quien mira.
 *
 * En escritorio (ADR-065) se acomoda como un perfil de Facebook: el avatar grande a la izquierda,
 * el nombre con sus contadores al lado y las acciones a la derecha. En el perfil propio las acciones
 * llevan a vender y a comprar: «Panel» (el Studio; «Vender» si aún no hay tienda), «Mis compras» y
 * «Editar perfil». En el ajeno: «Seguir», «Mensaje» y, si vende, «Ver tienda».
 */
export function ProfileHeader({
  profile,
  inCommon,
  cover,
  customCover = false,
  hasShop = false,
  isOwn,
  isSignedIn,
}: ProfileHeaderProps) {
  const base = `/u/${profile.username}`;
  // Seguidores y seguidos abren su lista (ADR-058); las publicaciones están abajo, en su pestaña.
  const stats = [
    { value: profile.postCount, label: ["publicación", "publicaciones"], href: null },
    {
      value: profile.followerCount,
      label: ["seguidor", "seguidores"],
      href: `${base}/seguidores` as Route,
    },
    {
      value: profile.followingCount,
      label: ["siguiendo", "siguiendo"],
      href: `${base}/siguiendo` as Route,
    },
  ]
    .filter((stat) => stat.value > 0)
    .map((stat) => ({
      value: stat.value,
      label: stat.label[stat.value === 1 ? 0 : 1]!,
      href: stat.href,
    }));
  const people = peopleInCommonText(
    inCommon.people.map((person) => person.displayName),
    inCommon.peopleTotal,
  );
  const communities = communitiesInCommonText(inCommon.communities);
  const path = base;

  return (
    <header className="flex flex-col gap-4">
      <ProfileCover
        name={profile.displayName}
        username={profile.username}
        avatarUrl={profile.avatarUrl}
        cover={cover}
        customCover={customCover}
        isSeller={profile.isSeller}
        isOwn={isOwn}
      />
      <div className="flex flex-col gap-3 px-4 pt-10 md:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-6 lg:px-8 lg:pt-4">
        {/* Junto al avatar grande: 160 px de avatar + 16 de aire, y al menos su alto bajo la portada. */}
        <div className="flex flex-col gap-1 lg:col-start-1 lg:row-start-1 lg:min-h-24 lg:pl-44">
          <h1 className="font-heading text-2xl leading-tight font-extrabold tracking-heading text-balance md:text-3xl lg:text-[2rem]">
            {profile.displayName}
          </h1>
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
                  <dd className="flex items-baseline gap-1">
                    {stat.href ? (
                      <Link href={stat.href} className="flex items-baseline gap-1 hover:underline">
                        <span className="font-heading text-base font-bold text-foreground tabular-nums">
                          {formatCompactNumber(stat.value)}
                        </span>{" "}
                        <span>{stat.label}</span>
                      </Link>
                    ) : (
                      <>
                        <span className="font-heading text-base font-bold text-foreground tabular-nums">
                          {formatCompactNumber(stat.value)}
                        </span>
                        <span aria-hidden="true">{stat.label}</span>
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
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

        {profile.bio ? (
          <p className="text-[15px] leading-relaxed lg:col-span-2 lg:max-w-3xl">{profile.bio}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 lg:col-start-2 lg:row-start-1 lg:justify-end lg:self-end">
          {isOwn ? (
            <>
              {/* Vender y comprar (ADR-065): el panel de la tienda es la acción primaria de quien
                  vende; quien aún no vende ve la invitación sin el color primario. */}
              <Link
                href="/studio"
                className={buttonVariants({
                  variant: profile.isSeller ? "default" : "secondary",
                  size: "lg",
                })}
              >
                <LayoutDashboard data-icon="inline-start" />
                {profile.isSeller ? "Panel" : "Vender"}
              </Link>
              <Link
                href="/pedidos"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                <ReceiptText data-icon="inline-start" />
                Mis compras
              </Link>
              <Link
                href={"/personas" as Route}
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                <Users data-icon="inline-start" />
                Mis amigos
              </Link>
              <Link
                href="/perfil/editar"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                <PenLine data-icon="inline-start" />
                Editar perfil
              </Link>
              <SignOutButton collapseOnDesktop />
            </>
          ) : (
            <>
              {!profile.isEditorial ? (
                <FriendshipButton
                  targetId={profile.userId}
                  name={profile.displayName}
                  initialState={profile.friendship ?? "none"}
                  isSignedIn={isSignedIn}
                />
              ) : null}
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
              {hasShop ? (
                <Link
                  href={`${base}?ver=tienda` as Route}
                  className={buttonVariants({ variant: "secondary", size: "lg" })}
                >
                  <Store data-icon="inline-start" />
                  Ver tienda
                </Link>
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
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground lg:col-span-2">
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
