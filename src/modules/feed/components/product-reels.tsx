"use client";

import { ChevronLeft, ChevronRight, Play, ShoppingBag } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { blurPlaceholder } from "@/lib/image";
import { scrollRow, useScrollEdges } from "@/lib/use-scroll-edges";
import type { FeedProductsDTO } from "../product-carousel-compose";

/**
 * La vitrina breve del inicio: conserva el gesto horizontal de los reels, pero cada pieza abre un
 * producto de una tienda. Se alimenta del mismo bloque curado del feed, así que no expone artículos
 * ocultos, sin existencias ni de la propia persona.
 */
export function ProductReels({ block }: { block: FeedProductsDTO | null | undefined }) {
  const headingId = useId();
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const edges = useScrollEdges(listRef, block?.items.length ?? 0);
  if (!block) return null;

  return (
    <section aria-labelledby={headingId} className="border-b bg-card py-3 md:rounded-3xl md:border">
      <div className="flex items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2 id={headingId} className="flex items-center gap-2 font-heading text-base font-bold">
            <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
              <Play aria-hidden="true" className="size-3.5 fill-current" />
            </span>
            Reels de productos
          </h2>
          <p
            className="line-clamp-2 text-xs text-muted-foreground"
            title={block.reason || undefined}
          >
            {block.reason || "De tiendas de la comunidad"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-muted-foreground"
            aria-label="Ver productos anteriores"
            aria-controls={listId}
            disabled={edges.atStart}
            onClick={() => scrollRow(listRef.current, -1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-muted-foreground"
            aria-label="Ver más productos"
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
        {block.items.map(({ product, sponsored }) => (
          <li key={product.id} className="w-[118px] shrink-0 snap-start sm:w-[142px]">
            <Link
              href={`/producto/${product.slug}?from=reels` as Route}
              className="group relative flex aspect-[9/14] overflow-hidden rounded-2xl bg-muted shadow-sm ring-1 ring-foreground/10"
              aria-label={`Ver producto: ${product.title}`}
            >
              {product.image ? (
                <Image
                  src={product.image.url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 118px, 142px"
                  {...blurPlaceholder(product.image)}
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <span className="grid size-full place-items-center text-muted-foreground">
                  <ShoppingBag aria-hidden="true" className="size-7" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/80 via-black/25 to-transparent" />
              {sponsored ? (
                <span className="absolute top-2 left-2 rounded-full bg-background/95 px-2 py-1 text-[10px] font-bold text-foreground shadow-sm">
                  Patrocinado
                </span>
              ) : null}
              <span className="relative mt-auto flex w-full flex-col gap-0.5 p-2.5 text-white">
                <span className="line-clamp-2 text-sm leading-tight font-bold">
                  {product.title}
                </span>
                <span className="font-heading text-base leading-none font-extrabold">
                  {formatMoney(product.priceCents, product.currency)}
                </span>
                <span className="truncate text-[11px] text-white/80">{product.city}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-2 px-4 text-right">
        <Link
          href={block.href as Route}
          className="text-xs font-semibold text-primary-text underline-offset-2 hover:underline"
        >
          Ver todos los productos
        </Link>
      </div>
    </section>
  );
}
