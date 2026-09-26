import { Check, TrendingUp } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { formatCount } from "@/lib/format";
import { JoinButton } from "@/modules/social/components/join-button";
import type { MovingCommunityDTO } from "../dto";
import { RailSection } from "./rail-section";

/**
 * «Comunidades en movimiento»: las más activas de los últimos 7 días, con una barra delgada en su
 * color. Solo comunidades con publicaciones reales; si ninguna tuvo actividad, no se muestra.
 * Al visitante, «Unirme» lo lleva directo a crear cuenta (sin marcarlo «Miembro» antes).
 */
export function MovingCommunitiesList({
  communities,
  signedIn,
}: {
  communities: MovingCommunityDTO[];
  signedIn: boolean;
}) {
  if (communities.length === 0) return null;

  return (
    <RailSection
      id="columna-comunidades-en-movimiento"
      title="Comunidades en movimiento"
      icon={TrendingUp}
      description="Publicaciones de los últimos 7 días"
    >
      <ol className="flex flex-col gap-1">
        {communities.map((community, index) => (
          <li
            key={community.id}
            style={{ "--hue": community.hue } as CSSProperties}
            className="grid grid-cols-[1rem_auto_minmax(0,1fr)_auto] items-center gap-2.5 py-1"
          >
            <span
              aria-hidden="true"
              className="text-center font-heading text-sm font-extrabold text-muted-foreground tabular-nums"
            >
              {index + 1}
            </span>
            <CommunityAvatar
              name={community.name}
              emoji={community.emoji}
              hue={community.hue}
              size="sm"
              decorative
            />
            <div className="min-w-0">
              <p className="flex items-baseline justify-between gap-2">
                <Link
                  href={`/c/${community.slug}` as Route}
                  className="truncate text-sm font-bold hover:underline"
                >
                  {community.name}
                </Link>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                  <span aria-hidden="true">{community.posts}</span>
                  <span className="sr-only">
                    {formatCount(community.posts, "publicación", "publicaciones")}
                  </span>
                </span>
              </p>
              <div
                aria-hidden="true"
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className="h-full rounded-full community-bar"
                  style={{ width: `${Math.max(8, Math.round(community.share * 100))}%` }}
                />
              </div>
            </div>
            {community.joined ? (
              <span className="inline-flex items-center gap-1 px-1 text-xs font-bold text-success">
                <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                Tuya
              </span>
            ) : (
              <JoinButton
                communityId={community.id}
                communityName={community.name}
                communitySlug={community.slug}
                initialJoined={false}
                size="sm"
                isSignedIn={signedIn}
              />
            )}
          </li>
        ))}
      </ol>
    </RailSection>
  );
}
