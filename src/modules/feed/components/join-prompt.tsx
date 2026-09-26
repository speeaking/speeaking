import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type Community = { slug: string; name: string; emoji: string; hue: number };

/** Crear cuenta, volver a `next` y llegar al onboarding con la comunidad ya marcada. */
export function joinHref(next: string, community?: Pick<Community, "slug"> | null) {
  const params = new URLSearchParams({ next });
  if (community) params.set("unirse", community.slug);
  return `/registro?${params.toString()}` as Route;
}

/**
 * Invitación en la página de una publicación compartida (P1: compartir afuera, descubrir adentro):
 * quien llega por un enlace ve la publicación completa y una invitación a unirse a SU comunidad.
 * Al crear la cuenta regresa a la publicación y la comunidad ya viene elegida en el onboarding.
 */
export function JoinPrompt({
  postPath,
  community,
  className,
}: {
  postPath: string;
  community: Community | null;
  className?: string;
}) {
  const title = community
    ? `Únete a ${community.name} en ${siteConfig.name}`
    : `Únete a ${siteConfig.name}`;
  return (
    <section
      aria-labelledby="unete-titulo"
      style={community ? ({ "--hue": community.hue } as CSSProperties) : undefined}
      className={cn(
        "mx-4 flex flex-col gap-4 rounded-3xl border bg-card p-5 md:mx-0 md:flex-row md:items-center",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {community ? (
          <CommunityAvatar
            name={community.name}
            emoji={community.emoji}
            hue={community.hue}
            decorative
            className="rounded-2xl"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft"
          >
            <BrandMark className="size-8" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="unete-titulo" className="text-lg leading-tight font-extrabold">
            {title}
          </h2>
          <p className="text-sm leading-snug text-ink-2">
            {community
              ? `Comenta, guarda y ve lo nuevo de ${community.name} en tu inicio. Es gratis.`
              : "Comenta, guarda y arma un inicio con lo que te gusta. Es gratis."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-1.5 md:items-end">
        <Link
          href={joinHref(postPath, community)}
          className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-base font-bold md:h-10")}
        >
          Crear cuenta gratis
        </Link>
        <p className="text-center text-xs text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            href={`/entrar?next=${encodeURIComponent(postPath)}` as Route}
            // 44 × 44 px al tacto sin mover la línea (el texto mide 16 px de alto y ~30 de ancho).
            className="-mx-2 -my-3.5 inline-block px-2 py-3.5 font-bold text-foreground underline underline-offset-2"
          >
            Entra
          </Link>
        </p>
      </div>
    </section>
  );
}
