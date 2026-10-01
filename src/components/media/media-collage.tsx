import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { blurPlaceholder, frameAspect } from "@/lib/image";
import { cn } from "@/lib/utils";
import { collageLayout, type MediaItem } from "./media-layout";

/** Rejilla, `sizes` y clase de cada mosaico según cuántos se muestran (1 a 5). */
const GRID = {
  1: { grid: "grid-cols-1 grid-rows-1", sizes: ["(max-width: 768px) 100vw, 576px"], tiles: [] },
  2: { grid: "grid-cols-2 grid-rows-1", sizes: ["(max-width: 768px) 50vw, 288px"], tiles: [] },
  3: {
    grid: "grid-cols-[2fr_1fr] grid-rows-2",
    sizes: ["(max-width: 768px) 67vw, 384px", "(max-width: 768px) 33vw, 192px"],
    tiles: ["row-span-2"],
  },
  4: { grid: "grid-cols-2 grid-rows-2", sizes: ["(max-width: 768px) 50vw, 288px"], tiles: [] },
  // Dos arriba y tres abajo, todos cuadrados: 6 columnas y filas de 3:2.
  5: {
    grid: "grid-cols-6 grid-rows-[3fr_2fr]",
    sizes: [
      "(max-width: 768px) 50vw, 288px",
      "(max-width: 768px) 50vw, 288px",
      "(max-width: 768px) 33vw, 192px",
    ],
    tiles: ["col-span-3", "col-span-3", "col-span-2", "col-span-2", "col-span-2"],
  },
} as const satisfies Record<
  number,
  { grid: string; sizes: readonly string[]; tiles: readonly string[] }
>;

/**
 * Collage estilo Facebook para varias fotos: 1 en su marco, 2 lado a lado, 3 con una grande y dos
 * apiladas, 4 en 2×2 y 5 o más con dos arriba y tres abajo, con "+N" sobre la última. Ocupa poco
 * espacio en el feed; cada mosaico abre la publicación en esa foto (`?foto=`), donde se ven todas
 * en el carrusel.
 */
export function MediaCollage({
  items,
  href,
  preloadFirst = false,
  className,
}: {
  items: MediaItem[];
  /** Página de la publicación, p. ej. `/p/<id>`. */
  href: string;
  /** Precarga la primera foto: solo cuando la tarjeta es lo primero del feed. */
  preloadFirst?: boolean;
  className?: string;
}) {
  const { tiles, overflow, aspect } = collageLayout(items.length);
  if (tiles === 0) return null;
  const layout = GRID[tiles as keyof typeof GRID];

  return (
    <div
      data-layout={tiles}
      className={cn("grid gap-1 overflow-hidden rounded-2xl", layout.grid, className)}
      style={{ aspectRatio: tiles === 1 ? frameAspect(items[0]!) : aspect }}
    >
      {items.slice(0, tiles).map((item, index) => {
        const isLast = index === tiles - 1;
        return (
          <Link
            key={item.url}
            href={(index === 0 ? href : `${href}?foto=${index + 1}`) as Route}
            // Sin `outline-none`: en Tailwind 4 anula el `outline-3` del foco (queda sin anillo).
            className={cn(
              "relative block overflow-hidden bg-muted focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ring",
              (layout.tiles as readonly string[])[index],
            )}
          >
            <Image
              src={item.url}
              alt={item.alt}
              fill
              sizes={layout.sizes[Math.min(index, layout.sizes.length - 1)]}
              {...blurPlaceholder(item)}
              preload={preloadFirst && index === 0}
              // En `style`: next/image lo usa para que el desenfoque de carga no se estire.
              style={{ objectFit: "cover" }}
              className="transition-opacity hover:opacity-90"
            />
            {isLast && overflow > 0 ? (
              <span className="absolute inset-0 grid place-items-center bg-background/60 font-heading text-3xl font-extrabold text-foreground backdrop-blur-[2px]">
                <span aria-hidden="true">+{overflow}</span>
                <span className="sr-only">
                  {overflow === 1 ? "y 1 foto más" : `y ${overflow} fotos más`}
                </span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
