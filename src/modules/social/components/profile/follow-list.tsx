import { ChevronLeft, Users } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/brand/user-avatar";
import { EmptyState } from "@/components/states/empty-state";
import { formatCompactNumber } from "@/lib/format";
import { PROFILE_TRANSITION } from "@/lib/page-turn";
import { cn } from "@/lib/utils";
import type { FollowDirection, FollowPage } from "../../follow-lists";
import { FollowButton } from "../follow-button";

const TITLES: Record<FollowDirection, string> = {
  followers: "Seguidores",
  following: "Siguiendo",
};

/**
 * Seguidores o seguidos de un perfil (ADR-058): pestañas entre las dos listas, cada persona con su
 * foto, sus distintivos y «Seguir» de vuelta, y «Ver más» de 30 en 30. Cada nombre abre su perfil
 * pasando la página (ADR-055).
 */
export function FollowList({
  profile,
  direction,
  page,
  isSignedIn,
}: {
  profile: { username: string; displayName: string; followerCount: number; followingCount: number };
  direction: FollowDirection;
  page: FollowPage;
  isSignedIn: boolean;
}) {
  const base = `/u/${profile.username}`;
  const tabs: { id: FollowDirection; label: string; count: number; href: Route }[] = [
    {
      id: "followers",
      label: "Seguidores",
      count: profile.followerCount,
      href: `${base}/seguidores` as Route,
    },
    {
      id: "following",
      label: "Siguiendo",
      count: profile.followingCount,
      href: `${base}/siguiendo` as Route,
    },
  ];

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-2 px-2 pt-2 md:px-0">
        <Link
          href={base as Route}
          aria-label={`Volver al perfil de ${profile.displayName}`}
          className="grid size-11 place-items-center rounded-full hover:bg-secondary"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="truncate font-heading text-xl font-extrabold">{TITLES[direction]}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {profile.displayName} · @{profile.username}
          </p>
        </div>
      </header>
      <nav aria-label="Listas del perfil" className="mt-2 flex border-b px-2 md:px-0">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={tab.id === direction ? "page" : undefined}
            className={cn(
              "relative flex h-11 items-center gap-1.5 px-3 text-sm font-semibold text-muted-foreground hover:text-foreground",
              tab.id === direction &&
                "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground",
            )}
          >
            {tab.label}
            {tab.count > 0 ? (
              <span className="text-xs font-medium tabular-nums">
                {formatCompactNumber(tab.count)}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {page.people.length === 0 ? (
        <div className="px-4 pt-6 md:px-0">
          <EmptyState
            icon={Users}
            title={
              direction === "followers"
                ? `Todavía nadie sigue a ${profile.displayName}`
                : `${profile.displayName} todavía no sigue a nadie`
            }
            description="Cuando pase, aparecerá aquí."
          />
        </div>
      ) : (
        <ul className="flex flex-col divide-y">
          {page.people.map((person) => (
            <li key={person.userId} className="flex items-center gap-3 px-4 py-3 md:px-0">
              <Link
                href={`/u/${person.username}` as Route}
                transitionTypes={PROFILE_TRANSITION}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <UserAvatar
                  name={person.displayName}
                  seed={person.username}
                  src={person.avatarUrl}
                  className="size-11"
                />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-semibold">{person.displayName}</span>
                    {person.isSeller ? (
                      <span className="shrink-0 rounded-full bg-secondary px-1.5 py-px text-[10px] font-bold tracking-wide text-ink-2 uppercase">
                        Tienda
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">@{person.username}</span>
                </span>
              </Link>
              {person.isViewer ? null : (
                <FollowButton
                  targetUserId={person.userId}
                  targetName={person.displayName}
                  initialFollowing={person.viewerFollows}
                  isSignedIn={isSignedIn}
                  variant="soft"
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {page.nextCursor ? (
        <Link
          href={
            `${tabs.find((tab) => tab.id === direction)!.href}?despues=${page.nextCursor}` as Route
          }
          className="flex h-12 items-center justify-center text-sm font-bold text-primary-text hover:underline"
        >
          Ver más
        </Link>
      ) : null}
    </div>
  );
}
