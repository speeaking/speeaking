import { Camera } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";
import { formatMoney } from "@/lib/format";
import { blurPlaceholder } from "@/lib/image";
import type { ProductCardDTO } from "../queries";

/**
 * Tarjeta de producto. En una prenda, «Ver cómo me veo» va sobre la foto (ADR-046): abre la ficha
 * con el diálogo ya abierto (`?probar=1`). Son dos enlaces hermanos, no anidados.
 */
export function ProductCard({ product, from }: { product: ProductCardDTO; from?: string }) {
  const href = `/producto/${product.slug}${from ? `?from=${from}` : ""}` as Route;
  const tryOnHref = `/producto/${product.slug}?probar=1${from ? `&from=${from}` : ""}` as Route;
  return (
    <div className="group relative flex flex-col gap-2">
      <Link href={href} className="flex flex-col gap-2">
        <div className="relative aspect-4/5 overflow-hidden rounded-2xl bg-muted">
          {product.image ? (
            // La foto viaja hasta la ficha al abrirla (ADR-052): mismo nombre en ambos lados.
            <ViewTransition name={`producto-${product.id}`} share="morph" default="none">
              <Image
                src={product.image.url}
                // El título visible ya nombra el producto: la foto sería una segunda lectura.
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 240px"
                {...blurPlaceholder(product.image)}
                // En `style` (no en la clase) para que el desenfoque de carga use el mismo ajuste y no se estire.
                style={{ objectFit: "cover" }}
                className="transition-transform duration-300 group-hover:scale-105"
              />
            </ViewTransition>
          ) : null}
          {!product.inStock ? (
            <span className="absolute top-2 left-2 rounded-full bg-foreground px-2 py-0.5 text-xs font-bold text-background">
              Agotado
            </span>
          ) : null}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="line-clamp-2 text-sm font-medium">{product.title}</span>
          <span className="font-heading text-lg font-extrabold">
            {formatMoney(product.priceCents, product.currency)}
          </span>
          <span className="text-xs text-muted-foreground">{product.city}</span>
        </div>
      </Link>
      {product.tryOn && product.inStock ? (
        <Link
          href={tryOnHref}
          // El nombre accesible lleva el producto (varias tarjetas por página); el texto visible se
          // conserva dentro del nombre (WCAG 2.5.3).
          aria-label={`Ver cómo me veo: ${product.title}`}
          className="absolute right-2 bottom-[4.75rem] inline-flex h-9 items-center gap-1.5 rounded-full bg-background/95 px-3 text-xs font-bold text-foreground shadow-sm ring-1 ring-foreground/10 hover:bg-background"
        >
          <Camera aria-hidden="true" className="size-3.5" />
          Ver cómo me veo
        </Link>
      ) : null}
    </div>
  );
}
