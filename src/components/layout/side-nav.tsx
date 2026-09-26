"use client";

import { ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
import { unreadLabel, unreadSpokenLabel } from "@/modules/social/unread-labels";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties, type ReactNode, useState } from "react";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { isNavItemActive, type NavItem, sideNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import type { NavCommunities, ViewerSummary } from "@/modules/identity/viewer-summary";
import { JoinButton } from "@/modules/social/components/join-button";

/** Sin sesión solo se muestran las secciones públicas (Guardados y Mis pedidos piden cuenta). */
const PUBLIC_NAV = new Set<string>(["/", "/descubrir", "/comprar"]);

/**
 * Sticky bajo la barra superior (64 px), con scroll propio y desvanecido abajo. El `pb-6` deja el
 * último elemento por encima del desvanecido (1.5rem): al final del scroll nada queda cortado.
 * Las medidas de escritorio (filas de 38–39 px) son las de la maqueta: con tres comunidades, la
 * columna completa cabe en 1352×760 sin scroll. `-mx-1.5 px-1.5`: el scroll recorta todo lo que
 * sale de la caja, y así el anillo de foco de las filas se ve completo.
 */
const railScroll =
  "sticky top-16 -mx-1.5 max-h-[calc(100dvh-4rem)] self-start overflow-y-auto overscroll-contain px-1.5 pt-4 pb-6 [scrollbar-color:transparent_transparent] [scrollbar-width:thin] mask-b-from-[calc(100%-1.5rem)] hover:[scrollbar-color:var(--color-line-strong)_transparent]";

/** Texto que en la columna de íconos (md) solo leen los lectores de pantalla. */
const railLabel = "sr-only lg:not-sr-only lg:truncate";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-ink-2 transition-colors hover:bg-secondary hover:text-foreground lg:h-[38px] lg:justify-start",
        active && "bg-card font-extrabold text-foreground shadow-sm hover:bg-card",
      )}
    >
      <Icon
        className={cn("size-5 shrink-0", active && "text-primary-text")}
        strokeWidth={active ? 2.4 : 2}
        aria-hidden="true"
      />
      <span className={railLabel}>{item.label}</span>
    </Link>
  );
}

/** Encabezado de sección con enlace opcional a la derecha. Se oculta en la columna de íconos. */
function RailHeading({
  id,
  children,
  action,
}: {
  id: string;
  children: string;
  action?: ReactNode;
}) {
  return (
    <div className="hidden items-baseline justify-between px-3 pb-1 leading-4 lg:flex">
      <h2
        id={id}
        className="font-sans text-[11.5px] leading-4 font-extrabold tracking-[0.1em] text-muted-foreground uppercase"
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

const headingLink =
  "rounded-md text-[12.5px] leading-4 font-bold text-primary-text hover:underline underline-offset-4";

const rowClass =
  "flex h-11 min-w-0 items-center justify-center gap-3 rounded-xl text-[14.5px] font-bold transition-colors hover:bg-secondary lg:h-[39px] lg:justify-start lg:px-2";

/** Lista de filas: con separación en la columna de íconos, pegadas en escritorio (maqueta). */
const rowList = "flex flex-col gap-0.5 lg:gap-0";

const sectionClass = "mt-3 border-t pt-[11px]";

// Se reexportan para las pruebas existentes; viven en `social/unread-labels` (también las burbujas).
export { unreadLabel, unreadSpokenLabel };

/** `/c/gaming` (o una ruta dentro de ella) → `gaming`; fuera de una comunidad, `null`. */
function openCommunitySlug(pathname: string) {
  return /^\/c\/([^/]+)/.exec(pathname)?.[1] ?? null;
}

/**
 * Comunidades abiertas desde que llegó el conteo del servidor. La columna vive en el layout, que
 * no se vuelve a pintar al navegar: sin esto, «1 nueva» seguiría ahí al volver de la comunidad
 * aunque el servidor ya la marcó como vista. Al llegar conteos nuevos (otra `source`), se reinicia.
 */
function useSeenCommunities(source: unknown, pathname: string): ReadonlySet<string> {
  const [seen, setSeen] = useState<{ source: unknown; slugs: ReadonlySet<string> }>(() => ({
    source,
    slugs: new Set(),
  }));
  const open = openCommunitySlug(pathname);
  let slugs = seen.source === source ? seen.slugs : new Set<string>();
  if (open && !slugs.has(open)) slugs = new Set([...slugs, open]);
  if (seen.source !== source || slugs !== seen.slugs) setSeen({ source, slugs });
  return slugs;
}

/**
 * «N nuevas» en el color de la comunidad (maqueta: punto vivo y tinta con su tono). En la columna
 * de íconos (md) solo queda un punto en tinta sobre el avatar. Los lectores de pantalla lo oyen en el
 * nombre del enlace («Gaming, 1 publicación nueva»), así que aquí es solo visual.
 */
function UnreadCount({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      data-slot="unread"
      className="hidden shrink-0 items-center gap-[5px] text-xs leading-4 font-extrabold community-ink lg:flex"
    >
      <span className="size-[7px] rounded-full community-bar" />
      {unreadLabel(count)}
    </span>
  );
}

function YourCommunities({
  communities,
  pathname,
}: {
  communities: NonNullable<ViewerSummary>["communities"];
  pathname: string;
}) {
  const seen = useSeenCommunities(communities, pathname);
  return (
    <section aria-labelledby="riel-tus-comunidades" className={sectionClass}>
      <RailHeading
        id="riel-tus-comunidades"
        action={
          <Link href="/descubrir" className={headingLink}>
            Editar
          </Link>
        }
      >
        Tus comunidades
      </RailHeading>
      {communities.length === 0 ? (
        <Link
          href="/descubrir"
          className="hidden rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary lg:block"
        >
          Aún no te unes a ninguna.{" "}
          <span className="font-bold text-primary-text">Explora comunidades</span>
        </Link>
      ) : (
        <ul className={rowList}>
          {communities.map((community) => {
            const href = `/c/${community.slug}`;
            const active = pathname === href;
            // Abrirla la marca como vista (en el servidor, después de responder): aquí ya no cuenta.
            const unread = seen.has(community.slug) ? 0 : (community.unread ?? 0);
            return (
              <li key={community.slug}>
                <Link
                  href={href as Route}
                  title={community.name}
                  // Nombre explícito: la coma no depende de cómo cada navegador une los textos.
                  aria-label={
                    unread > 0 ? `${community.name}, ${unreadSpokenLabel(unread)}` : undefined
                  }
                  aria-current={active ? "page" : undefined}
                  style={{ "--hue": community.hue } as CSSProperties}
                  className={cn(rowClass, active && "bg-secondary")}
                >
                  <span className="relative shrink-0">
                    <CommunityAvatar
                      name={community.name}
                      emoji={community.emoji}
                      hue={community.hue}
                      size="sm"
                      decorative
                    />
                    {unread > 0 ? (
                      // Aquí el punto es lo único que se ve: en tinta, no en el tono (un amarillo
                      // sobre el fondo claro no llega a 3:1, WCAG 1.4.11), como el globo de las burbujas.
                      <span
                        aria-hidden="true"
                        data-slot="unread-dot"
                        className="absolute -top-1 -right-1 size-2.5 rounded-full bg-foreground ring-2 ring-background lg:hidden"
                      />
                    ) : null}
                  </span>
                  <span className={cn(railLabel, "lg:flex-1")}>{community.name}</span>
                  {unread > 0 ? <UnreadCount count={unread} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ToDiscover({ communities }: { communities: NavCommunities }) {
  if (communities.items.length === 0) return null;
  return (
    <section aria-labelledby="riel-para-descubrir" className={cn(sectionClass, "hidden lg:block")}>
      <RailHeading
        id="riel-para-descubrir"
        action={
          <Link href="/descubrir" className={headingLink}>
            Ver las {communities.total}
          </Link>
        }
      >
        Para descubrir
      </RailHeading>
      <ul className={rowList}>
        {communities.items.map((community) => (
          <li key={community.id} className="flex items-center gap-1 pr-1">
            <Link href={`/c/${community.slug}` as Route} className={cn(rowClass, "flex-1")}>
              <CommunityAvatar
                name={community.name}
                emoji={community.emoji}
                hue={community.hue}
                size="sm"
                decorative
              />
              <span className="truncate">{community.name}</span>
            </Link>
            <JoinButton
              communityId={community.id}
              communityName={community.name}
              communitySlug={community.slug}
              initialJoined={false}
              isSignedIn
              size="sm"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Entrada única a Vende con IA en escritorio. «Ir a Studio» solo con sesión: el visitante aún no
 * tiene panel (al tocar la fila, el servidor lo manda a entrar y lo regresa aquí).
 */
function ToSell({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-labelledby="riel-para-vender" className={sectionClass}>
      <RailHeading
        id="riel-para-vender"
        action={
          signedIn ? (
            <Link href="/studio" className={headingLink}>
              Ir a Studio
            </Link>
          ) : undefined
        }
      >
        Para vender
      </RailHeading>
      <Link href="/studio/vende-con-ia" title={siteConfig.sellerFeatureName} className={rowClass}>
        {/* Lima: es la función de IA (la única que la usa en la columna). */}
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-ai text-ai-foreground">
          <Sparkles className="size-[17px]" aria-hidden="true" />
        </span>
        <span className={cn(railLabel, "lg:flex-1")}>{siteConfig.sellerFeatureName}</span>
        <ChevronRight
          className="hidden size-4 shrink-0 text-muted-foreground lg:block"
          aria-hidden="true"
        />
      </Link>
    </section>
  );
}

/** Entrada al área del equipo, al final de la columna. Solo se pinta para ADMIN. */
function ToAdmin({ active }: { active: boolean }) {
  return (
    <div className={sectionClass}>
      <Link
        href="/admin/resumen"
        title="Administración"
        aria-current={active ? "page" : undefined}
        className={cn(rowClass, active && "bg-secondary")}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-ink-2">
          <ShieldCheck className="size-[17px]" aria-hidden="true" />
        </span>
        <span className={cn(railLabel, "lg:flex-1")}>Administración</span>
      </Link>
    </div>
  );
}

function AllCommunities({ communities }: { communities: NavCommunities }) {
  if (communities.items.length === 0) return null;
  return (
    <section aria-labelledby="riel-comunidades" className={sectionClass}>
      <RailHeading id="riel-comunidades">Comunidades</RailHeading>
      {/*
        Dos por fila en escritorio. Un nombre que no cabe en media columna («Emprendedores») no se
        corta: su fila entera es suya (`min-w-max` lo manda a la siguiente línea) y la que queda
        sola antes también se estira, sin dejar huecos.
      */}
      <ul className="flex flex-col gap-0.5 lg:flex-row lg:flex-wrap lg:gap-x-1">
        {communities.items.map((community) => (
          <li key={community.id} className="min-w-0 lg:min-w-max lg:grow lg:basis-[calc(50%-2px)]">
            <Link
              href={`/c/${community.slug}` as Route}
              title={community.name}
              className="flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg text-[13px] font-bold transition-colors hover:bg-secondary lg:h-9 lg:justify-start lg:px-1"
            >
              <CommunityAvatar
                name={community.name}
                emoji={community.emoji}
                hue={community.hue}
                size="sm"
                decorative
                className="lg:size-6 lg:rounded-[7px] lg:text-[13px]"
              />
              <span className={railLabel}>{community.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Columna izquierda de escritorio: navegación, tus comunidades (o todas, sin sesión), comunidades
 * para descubrir y la entrada a Vende con IA. Sticky con scroll propio (y desvanecido abajo) para
 * que nada se corte en ventanas bajas. Entre md y lg se reduce a íconos.
 */
export function SideNav({
  viewer,
  communities,
}: {
  viewer: ViewerSummary;
  communities: NavCommunities;
}) {
  const pathname = usePathname();
  const items = viewer ? sideNav : sideNav.filter((item) => PUBLIC_NAV.has(item.href));

  return (
    <div className={cn(railScroll, "hidden md:block")}>
      <nav aria-label="Navegación principal">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isNavItemActive(pathname, item, viewer?.username)} />
            </li>
          ))}
        </ul>
      </nav>

      {viewer ? (
        <>
          <YourCommunities communities={viewer.communities} pathname={pathname} />
          <ToDiscover communities={communities} />
        </>
      ) : (
        <AllCommunities communities={communities} />
      )}
      {/* También para visitantes (maqueta visitor): entre 1024 y 1279 px es su única entrada. */}
      <ToSell signedIn={viewer !== null} />
      {viewer?.isAdmin ? <ToAdmin active={pathname.startsWith("/admin")} /> : null}

      <div className="mt-3 flex items-center justify-center border-t pt-3 lg:justify-between lg:border-t-0 lg:pt-0 lg:pl-3">
        <p className="hidden text-xs text-muted-foreground lg:block">Hecho en México</p>
        <ThemeToggle />
      </div>
    </div>
  );
}
