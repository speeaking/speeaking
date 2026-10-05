"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  LockKeyhole,
  Play,
  ShoppingBag,
} from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useId, useRef } from "react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { blurPlaceholder } from "@/lib/image";
import { scrollRow, useScrollEdges } from "@/lib/use-scroll-edges";
import { formatDuration } from "@/modules/media/video-rules";
import type { HomeReelsDTO, HomeVideoReelDTO } from "../home-reels";

const cardClass =
  "group relative flex aspect-[3/5] overflow-hidden rounded-2xl bg-muted shadow-sm ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring";
const overlay =
  "absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/90 via-black/30 to-transparent";

/** Una portada abre el video en la capa de publicación; la fila no descarga todos los clips. */
function VideoReel({ item }: { item: HomeVideoReelDTO }) {
  const { video, author } = item;
  return (
    <Link
      href={`/p/${item.postId}` as Route}
      scroll={false}
      className={cardClass}
      aria-label={`Ver video de ${author.displayName}${item.platformUpdate ? ": actualización de speeaking" : ""}${item.caption ? `: ${item.caption}` : ""}`}
    >
      {video.poster ? (
        <Image
          src={video.poster.url}
          alt=""
          fill
          sizes="(max-width: 640px) 132px, 156px"
          {...blurPlaceholder(video.poster)}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="grid size-full place-items-center bg-linear-to-br from-primary/20 to-secondary">
          <Clapperboard aria-hidden="true" className="size-10 text-primary-text" />
        </span>
      )}
      <span className={overlay} />
      <span className="absolute top-2 left-2 rounded-full ring-2 ring-white/90">
        <UserAvatar
          name={author.displayName}
          seed={author.username}
          src={author.avatarUrl}
          className="size-8"
        />
      </span>
      <span className="absolute top-2 right-2 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-1 text-[10px] font-semibold text-white">
        <Play aria-hidden="true" className="size-3 fill-current" />
        {formatDuration(video.durationMs)}
      </span>
      <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
        <span className="grid size-9 place-items-center rounded-full bg-black/30 text-white ring-1 ring-white/50 transition-transform group-hover:scale-110">
          <Play className="size-4 translate-x-px fill-current" />
        </span>
      </span>
      <span className="relative mt-auto flex w-full flex-col gap-1 p-2.5 text-white">
        {item.platformUpdate ? (
          <span className="self-start rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-black">
            Actualización
          </span>
        ) : null}
        <span className="line-clamp-2 text-sm leading-tight font-bold">
          {item.caption || `Video de ${author.displayName}`}
        </span>
        <span className="truncate text-[11px] font-medium text-white/85">{author.displayName}</span>
        {item.audience !== "public" ? (
          <span className="flex items-center gap-1 text-[10px] text-white/85">
            <LockKeyhole aria-hidden="true" className="size-2.5" />
            {item.audience === "only_me" ? "Solo yo" : "Amigos"}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/** Videos y productos bajo el compositor, con flechas y deslizamiento en ambas pantallas. */
export function HomeReels({ block }: { block: HomeReelsDTO }) {
  const headingId = useId();
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const edges = useScrollEdges(listRef, block.items.length);
  const hasVideos = block.items.some((item) => item.kind === "video");
  const hasProducts = block.items.some((item) => item.kind === "product");

  if (!block.items.length)
    return (
      <section
        aria-labelledby={headingId}
        className="border-b bg-card px-4 py-4 md:rounded-3xl md:border"
      >
        <h2 id={headingId} className="font-heading text-base font-bold">
          Reels y productos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Los videos de la comunidad, las actualizaciones y los productos aparecerán aquí.
        </p>
        <Link
          href="/crear/publicacion?tipo=video"
          scroll={false}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary-text"
        >
          Compartir un video
        </Link>
      </section>
    );

  return (
    <section aria-labelledby={headingId} className="border-b bg-card py-3 md:rounded-3xl md:border">
      <div className="flex items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2 id={headingId} className="flex items-center gap-2 font-heading text-base font-bold">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Clapperboard aria-hidden="true" className="size-3.5" />
            </span>
            Reels y productos
          </h2>
          <p
            className="mt-0.5 line-clamp-2 text-xs text-muted-foreground"
            title={!hasVideos && block.productReason ? block.productReason : undefined}
          >
            {hasVideos
              ? hasProducts
                ? "Videos recientes y productos de la comunidad"
                : "Videos de la comunidad y novedades de speeaking"
              : block.productReason || "De tiendas de la comunidad"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-lg"
            className="size-11 rounded-full text-muted-foreground"
            aria-label="Ver reels anteriores"
            aria-controls={listId}
            disabled={edges.atStart}
            onClick={() => scrollRow(listRef.current, -1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            className="size-11 rounded-full text-muted-foreground"
            aria-label="Ver más reels y productos"
            aria-controls={listId}
            disabled={edges.atEnd}
            onClick={() => scrollRow(listRef.current, 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <ul
        id={listId}
        ref={listRef}
        onScroll={edges.update}
        className="mt-3 scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1"
      >
        {block.items.map((item) => (
          <li
            key={item.kind === "video" ? `video-${item.postId}` : `product-${item.product.id}`}
            className="w-[132px] shrink-0 snap-start sm:w-[156px]"
          >
            {item.kind === "video" ? (
              <VideoReel item={item} />
            ) : (
              <Link
                href={`/producto/${item.product.slug}?from=reels` as Route}
                className={cardClass}
                aria-label={`Ver producto: ${item.product.title}`}
              >
                {item.product.image ? (
                  <Image
                    src={item.product.image.url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 132px, 156px"
                    {...blurPlaceholder(item.product.image)}
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span className="grid size-full place-items-center text-muted-foreground">
                    <ShoppingBag aria-hidden="true" className="size-7" />
                  </span>
                )}
                <span className={overlay} />
                {item.sponsored ? (
                  <span className="absolute top-2 left-2 rounded-full bg-background/95 px-2 py-1 text-[10px] font-bold text-foreground shadow-sm">
                    Patrocinado
                  </span>
                ) : null}
                <span className="relative mt-auto flex w-full flex-col gap-0.5 p-2.5 text-white">
                  <span className="line-clamp-2 text-sm leading-tight font-bold">
                    {item.product.title}
                  </span>
                  <span className="font-heading text-base leading-none font-extrabold">
                    {formatMoney(item.product.priceCents, item.product.currency)}
                  </span>
                  <span className="truncate text-[11px] text-white/80">{item.product.city}</span>
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-end gap-4 px-4">
        {hasVideos ? (
          <Link
            href="/videos"
            className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary-text hover:underline"
          >
            Ver todos los videos
            <ChevronRight aria-hidden="true" className="size-3" />
          </Link>
        ) : null}
        {hasProducts ? (
          <Link
            href={block.productHref as Route}
            className="inline-flex min-h-11 items-center text-xs font-semibold text-primary-text hover:underline"
          >
            Ver todos los productos
          </Link>
        ) : null}
      </div>
    </section>
  );
}
