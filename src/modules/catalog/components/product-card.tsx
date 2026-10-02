import { Camera } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { blurPlaceholder } from "@/lib/image";
import type { ProductCardDTO } from "../queries";
import { ProductImageMorph } from "./product-image-morph";

/** Proporción de la foto; el marco de «Ver cómo me veo» usa la misma para cubrirla exactamente. */
const PHOTO_ASPECT = "aspect-4/5";

/**
 * Tarjeta de producto. En una prenda, «Ver cómo me veo» va sobre la foto (ADR-046): abre la ficha
 * con el diálogo ya abierto (`?probar=1`). Son dos enlaces hermanos, no anidados; por eso el botón
 * se ancla a un marco hermano del tamaño de la foto y no al pie de la tarjeta (el título puede
 * ocupar una o dos líneas).
 */
export function ProductCard({ product, from }: { product: ProductCardDTO; from?: string }) {
  const href = `/producto/${product.slug}${from ? `?from=${from}` : ""}` as Route;
  const tryOnHref = `/producto/${product.slug}?probar=1${from ? `&from=${from}` : ""}` as Route;
  return (
    <div className="group relative flex flex-col gap-2">
      <Link href={href} className="flex flex-col gap-2">
        <div className={`relative ${PHOTO_ASPECT} overflow-hidden rounded-2xl bg-muted`}>
          {product.image ? (
            // La foto viaja hasta la ficha al abrirla (ADR-052): el nombre se arma al tocarla.
            <ProductImageMorph productId={product.id}>
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
            </ProductImageMorph>
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
        // Marco del tamaño de la foto (arriba, a todo lo ancho, misma proporción): deja pasar el
        // toque a la foto y solo el botón lo recibe.
        <div className={`pointer-events-none absolute inset-x-0 top-0 ${PHOTO_ASPECT}`}>
          <Link
            href={tryOnHref}
            // El nombre accesible lleva el producto (varias tarjetas por página); el texto visible se
            // conserva dentro del nombre (WCAG 2.5.3).
            aria-label={`Ver cómo me veo: ${product.title}`}
            className="pointer-events-auto absolute right-2 bottom-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-background/95 px-3 text-xs font-bold text-foreground shadow-sm ring-1 ring-foreground/10 hover:bg-background"
          >
            <Camera aria-hidden="true" className="size-3.5" />
            Ver cómo me veo
          </Link>
        </div>
      ) : null}
    </div>
  );
}
