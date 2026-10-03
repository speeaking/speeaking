import { Play, ShoppingBag } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { blurPlaceholder } from "@/lib/image";
import type { FeedProductsDTO } from "../product-carousel-compose";

/**
 * La vitrina breve del inicio: conserva el gesto horizontal de los reels, pero cada pieza abre un
 * producto de una tienda. Se alimenta del mismo bloque curado del feed, así que no expone artículos
 * ocultos, sin existencias ni de la propia persona.
 */
export function ProductReels({ block }: { block: FeedProductsDTO | null | undefined }) {
  if (!block) return null;

  return (
    <section
      aria-labelledby="reels-de-productos"
      className="border-b bg-card py-3 md:rounded-3xl md:border"
    >
      <div className="flex items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2
            id="reels-de-productos"
            className="flex items-center gap-2 font-heading text-base font-bold"
          >
            <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
              <Play aria-hidden="true" className="size-3.5 fill-current" />
            </span>
            Reels de productos
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {block.reason || "De tiendas de la comunidad"}
          </p>
        </div>
        <Link
          href={block.href as Route}
          className="shrink-0 text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
        >
          Ver tienda
        </Link>
      </div>
      <ul className="mt-3 scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1">
        {block.items.slice(0, 8).map(({ product, sponsored }) => (
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
                  Destacado
                </span>
              ) : null}
              <span className="relative mt-auto flex w-full flex-col gap-0.5 p-2.5 text-background">
                <span className="line-clamp-2 text-sm leading-tight font-bold">
                  {product.title}
                </span>
                <span className="font-heading text-base leading-none font-extrabold">
                  {formatMoney(product.priceCents, product.currency)}
                </span>
                <span className="truncate text-[11px] text-background/80">{product.city}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
