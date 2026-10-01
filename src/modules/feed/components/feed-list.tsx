"use client";

import { ChevronRight, CircleCheck, Loader, RefreshCw } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { type CSSProperties, Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/modules/social/components/post-card";
import { findCoverIndex, pickCardVariant } from "../card-variant";
import type { FeedItemDTO, FeedPageDTO } from "../dto";
import { isSameLocalDay } from "../feed-date";
import { useVisibleImpressions } from "./use-visible-impressions";
import { IMPRESSION_POSITION_ATTRIBUTE, IMPRESSION_POST_ATTRIBUTE } from "./visible-impressions";
import type { FeedProductsDTO } from "../product-carousel-compose";
import { ProductCarousel } from "./product-carousel";

/**
 * Separador antes de la portada: «Hoy en Gaming · Ir a la comunidad». Solo dice «Hoy» si la
 * publicación es de hoy (hora de México); si no, «Destacado en…» (contenido honesto).
 */
function CoverRule({
  community,
  publishedAt,
}: {
  community: NonNullable<FeedItemDTO["community"]>;
  publishedAt: string;
}) {
  const today = isSameLocalDay(new Date(publishedAt), new Date());
  return (
    <div
      className="flex items-center gap-3 px-4 pt-4 pb-3 md:px-1 md:pt-1 md:pb-0"
      style={{ "--hue": community.hue } as CSSProperties}
    >
      <CommunityAvatar
        name={community.name}
        emoji={community.emoji}
        hue={community.hue}
        size="sm"
        decorative
        className="size-6 rounded-md text-sm"
      />
      <p
        className="shrink-0 text-xs font-extrabold tracking-widest community-text uppercase"
        suppressHydrationWarning
      >
        {today ? "Hoy en" : "Destacado en"} {community.name}
      </p>
      <span aria-hidden="true" className="h-0.5 min-w-4 flex-1 rounded-full community-bar" />
      <Link
        href={`/c/${community.slug}` as Route}
        // Nombre explícito: con un <span sr-only> el espacio se pierde («comunidadGaming»).
        aria-label={`Ir a la comunidad ${community.name}`}
        // `-my-3.5 py-3.5`: 44 px de alto al tacto sin cambiar la altura de la fila.
        className="-my-3.5 inline-flex shrink-0 items-center gap-0.5 py-3.5 text-xs font-bold community-text hover:underline"
      >
        Ir a la comunidad
        <ChevronRight aria-hidden="true" className="size-3.5" />
      </Link>
    </div>
  );
}

/**
 * Bloque que se intercala en el feed (p. ej. «Arma tu feed» o «Gente de tus comunidades»). Va
 * después de la pieza `after` (0 = después de la primera); si la lista es más corta, después de la
 * última. No cambia las posiciones del ranking: es presentación.
 */
export type FeedSlot = { key: string; after: number; node: ReactNode };

/** El carrusel de productos de cada página va después de su 4.ª pieza (ADR-051). */
export const PRODUCTS_AFTER = 3;

type ProductBlock = { after: number; block: FeedProductsDTO };

/** Dónde cae el carrusel de una página cuyas piezas empiezan en `offset` (ninguno si no trae). */
function productBlocksFor(page: FeedPageDTO, offset: number): ProductBlock[] {
  if (!page.products || page.items.length === 0) return [];
  return [
    { after: offset + Math.min(PRODUCTS_AFTER, page.items.length - 1), block: page.products },
  ];
}

/**
 * Feed con scroll infinito (cursor estable del servidor). Sigue siendo una lista plana: cada pieza
 * solo elige cómo pintarse (portada, tipográfica o estándar) y las posiciones no cambian. Cada pieza
 * servida por el ranking se mide como impresión VISIBLE (T5, `use-visible-impressions.ts`).
 */
export function FeedList({
  initialPage,
  community,
  following = false,
  empty,
  isSignedIn,
  slots = [],
}: {
  initialPage: FeedPageDTO;
  community?: string;
  /** «Siguiendo»: las páginas siguientes también se piden con ese filtro. */
  following?: boolean;
  empty: ReactNode;
  /** `false` para visitantes: las acciones llevan a crear cuenta (ver `PostCard`). */
  isSignedIn?: boolean;
  slots?: readonly FeedSlot[];
}) {
  const [items, setItems] = useState<FeedItemDTO[]>(initialPage.items);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [blocks, setBlocks] = useState<ProductBlock[]>(() => productBlocksFor(initialPage, 0));
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const sentinel = useRef<HTMLDivElement>(null);
  // Antes del observador del scroll infinito: sus efectos no se pisan.
  const observeImpression = useVisibleImpressions(community ? "COMMUNITY" : "FEED");

  // El servidor puede volver a pintar la página (p. ej. al descartar «Lo que buscas»). Si la persona
  // no ha cargado más páginas, se adopta la versión nueva para no dejar un «Porque buscas…» que ya
  // no es cierto; con más páginas cargadas se conserva la lista para no mover lo que está leyendo.
  const [served, setServed] = useState(initialPage);
  if (served !== initialPage) {
    setServed(initialPage);
    if (cursor === served.nextCursor) {
      setItems(initialPage.items);
      setCursor(initialPage.nextCursor);
      setBlocks(productBlocksFor(initialPage, 0));
      setStatus("idle");
    }
  }

  const loadMore = async () => {
    if (!cursor || status === "loading") return;
    setStatus("loading");
    try {
      const params = new URLSearchParams({ cursor });
      if (community) params.set("community", community);
      if (following) params.set("following", "1");
      const response = await fetch(`/api/feed?${params}`);
      // 400: el cursor venció (el feed solo cubre días recientes). Se toma como el final de la lista en
      // vez de reintentar el mismo cursor una y otra vez.
      if (response.status === 400) {
        setCursor(null);
        setStatus("idle");
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const page = (await response.json()) as FeedPageDTO;
      // Solo una carga a la vez (`status`): la lista del cierre es la actual.
      const seen = new Set(items.map((item) => item.id));
      const fresh = page.items.filter((item) => !seen.has(item.id));
      setItems([...items, ...fresh]);
      setBlocks((current) => [
        ...current,
        ...productBlocksFor({ ...page, items: fresh }, items.length),
      ]);
      setCursor(page.nextCursor);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    const element = sentinel.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Tras un error solo se reintenta con el botón: el observador no debe insistir solo.
        if (status === "idle" && entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  });

  if (items.length === 0) return <>{empty}</>;

  // La portada es la primera pieza con fotos: al cargar más páginas no se mueve.
  const coverIndex = findCoverIndex(items);
  const slotAt = (slot: FeedSlot) => Math.min(slot.after, items.length - 1);

  return (
    <div className="flex flex-col md:gap-4">
      {items.map((item, index) => {
        const variant = pickCardVariant(item, index, coverIndex);
        return (
          <Fragment key={item.id}>
            {/* Dentro de una comunidad el separador sobra: ya estás en ella. */}
            {variant === "cover" && item.community && !community ? (
              <CoverRule community={item.community} publishedAt={item.publishedAt} />
            ) : null}
            {/* Contenedor medible: solo lo servido por el ranking cuenta como impresión visible. */}
            <div
              ref={item.ranking ? observeImpression : undefined}
              {...(item.ranking
                ? {
                    [IMPRESSION_POST_ATTRIBUTE]: item.id,
                    [IMPRESSION_POSITION_ATTRIBUTE]: item.ranking.position,
                  }
                : {})}
            >
              <PostCard post={item} index={index} variant={variant} isSignedIn={isSignedIn} />
            </div>
            {blocks
              .filter((entry) => entry.after === index)
              .map((entry) => (
                <ProductCarousel key={`productos-${entry.after}`} block={entry.block} />
              ))}
            {slots
              .filter((slot) => slotAt(slot) === index)
              .map((slot) => (
                <Fragment key={slot.key}>{slot.node}</Fragment>
              ))}
          </Fragment>
        );
      })}
      <div ref={sentinel} className="flex justify-center px-4 py-8 text-sm text-muted-foreground">
        {status === "loading" ? (
          <Loader className="size-5 animate-spin" aria-label="Cargando más" />
        ) : status === "error" ? (
          <Button variant="outline" onClick={() => void loadMore()}>
            <RefreshCw data-icon="inline-start" />
            Reintentar
          </Button>
        ) : cursor ? null : (
          <p className="flex items-center gap-1.5">
            {/* El destello es la marca de la IA (ADR-027): aquí no hay IA. */}
            <CircleCheck aria-hidden="true" className="size-4" />
            Ya viste todo por ahora. Vuelve pronto o explora otras comunidades.
          </p>
        )}
      </div>
    </div>
  );
}
