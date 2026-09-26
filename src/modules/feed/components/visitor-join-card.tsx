import type { Route } from "next";
import Link from "next/link";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HomeCommunityDTO } from "../dto";

/** Crear cuenta con comunidades ya elegidas para el onboarding (`?unirse=`). */
export function registerWithCommunities(slugs: readonly string[] = []) {
  const params = new URLSearchParams();
  for (const slug of slugs) params.append("unirse", slug);
  const query = params.toString();
  return (query ? `/registro?${query}` : "/registro") as Route;
}

/** Cuántas comunidades caben en la tarjeta sin volverla un catálogo. */
const MAX_CHIPS = 8;

/**
 * «Arma tu feed» (F6): invitación del visitante dentro del feed, después de la 2.ª publicación. Solo
 * donde no hay columna derecha (móvil y tabletas, `xl:hidden`), que ya tiene su bienvenida. Cada
 * comunidad lleva a crear cuenta con esa comunidad ya marcada en el onboarding.
 */
export function VisitorJoinCard({
  communities,
  className,
}: {
  communities: HomeCommunityDTO[];
  className?: string;
}) {
  return (
    <section
      aria-labelledby="arma-tu-feed"
      data-slot="visitor-join-card"
      className={cn(
        "flex flex-col gap-3 border-b bg-card px-4 py-5 md:rounded-3xl md:border md:px-5 xl:hidden",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold tracking-[0.1em] text-primary-text uppercase">
          Gratis · una sola cuenta para todo
        </p>
        <h2 id="arma-tu-feed" className="text-2xl leading-tight font-extrabold">
          Arma tu feed
        </h2>
        <p className="text-sm leading-snug text-ink-2">
          Elige una comunidad para empezar y tu inicio se llena de lo que te gusta.
        </p>
      </div>
      {communities.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {communities.slice(0, MAX_CHIPS).map((community) => (
            <li key={community.id}>
              <Link
                href={registerWithCommunities([community.slug])}
                aria-label={`${community.name}: crear cuenta y unirme`}
                className="inline-flex h-11 items-center gap-2 rounded-full border bg-card py-1 pr-3.5 pl-1.5 text-sm font-semibold transition-colors hover:bg-secondary motion-reduce:transition-none"
              >
                <CommunityAvatar
                  name={community.name}
                  emoji={community.emoji}
                  hue={community.hue}
                  size="sm"
                  decorative
                  className="size-7 rounded-full text-sm"
                />
                {community.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        href={registerWithCommunities()}
        className={cn(buttonVariants({ size: "lg" }), "h-11 w-full text-base font-bold")}
      >
        Crear cuenta gratis
      </Link>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/entrar"
          // 44 × 44 px al tacto sin mover la línea.
          className="-mx-2 -my-3 inline-block px-2 py-3 font-bold text-foreground underline underline-offset-2"
        >
          Entra
        </Link>
      </p>
    </section>
  );
}
