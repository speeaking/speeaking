import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { blurPlaceholder } from "@/lib/image";
import type { ProductCardDTO } from "../queries";

export function ProductCard({ product, from }: { product: ProductCardDTO; from?: string }) {
  const href = `/producto/${product.slug}${from ? `?from=${from}` : ""}` as Route;
  return (
    <Link href={href} className="group flex flex-col gap-2">
      <div className="relative aspect-4/5 overflow-hidden rounded-2xl bg-muted">
        {product.image ? (
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
  );
}
