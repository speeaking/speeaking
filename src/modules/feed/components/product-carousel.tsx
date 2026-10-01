"use client";

import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { scrollRow, useScrollEdges } from "@/lib/use-scroll-edges";
import { SponsoredCard } from "@/modules/billing/components/sponsored-products";
import { ProductCard } from "@/modules/catalog/components/product-card";
import type { FeedProductsDTO } from "../product-carousel-compose";

/**
 * Carrusel de productos intercalado en el feed (ADR-051): título con su razón escrita, fila con
 * scroll horizontal, flechas con puntero fino (en táctil se desliza) y «Ver todo». Los patrocinados
 * llevan su etiqueta (tarjeta de destacados); el resto es la misma tarjeta de Comprar, con «Ver cómo
 * me veo» en las prendas.
 */
export function ProductCarousel({ block }: { block: FeedProductsDTO }) {
  const headingId = useId();
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const edges = useScrollEdges(listRef, block.items.length);
  // Flechas solo con puntero fino: 28 px, más que los 24 px de WCAG 2.5.8.
  const arrow =
    "hidden text-muted-foreground pointer-fine:inline-flex disabled:pointer-events-none disabled:opacity-40";

  return (
    <section
      aria-labelledby={headingId}
      className="border-b bg-background py-3 md:rounded-3xl md:border md:py-4"
    >
      <div className="flex items-end justify-between gap-3 px-4">
        <div className="flex min-w-0 flex-col">
          <h2 id={headingId} className="flex items-center gap-2 font-heading text-base font-bold">
            <ShoppingBag aria-hidden="true" className="size-4 text-primary-text" />
            {block.title}
          </h2>
          {block.reason ? (
            <p className="truncate text-xs text-muted-foreground">{block.reason}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Ver productos anteriores"
            aria-controls={listId}
            disabled={edges.atStart}
            onClick={() => scrollRow(listRef.current, -1)}
            className={arrow}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Ver más productos"
            aria-controls={listId}
            disabled={edges.atEnd}
            onClick={() => scrollRow(listRef.current, 1)}
            className={arrow}
          >
            <ChevronRight />
          </Button>
          <Link
            href={block.href as Route}
            className="ml-1 text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
          >
            Ver todo
          </Link>
        </div>
      </div>
      <ul
        id={listId}
        ref={listRef}
        onScroll={edges.update}
        className="mt-3 scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1"
      >
        {block.items.map(({ product, sponsored }) => (
          <li key={product.id} className="w-[44%] shrink-0 snap-start sm:w-[176px]">
            {sponsored ? <SponsoredCard product={product} /> : <ProductCard product={product} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
