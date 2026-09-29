import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { blurPlaceholder } from "@/lib/image";
import { cn } from "@/lib/utils";
import type { ProductCardDTO } from "@/modules/catalog/queries";

/**
 * Productos destacados (ADR-046), siempre con la etiqueta «Patrocinado» (Ley Federal de Protección
 * al Consumidor). La liga lleva `ref=destacado` para que la tienda vea las visitas que le trajo.
 * Tres formas: columna derecha (`rail`), fila de Comprar (`row`) y tarjeta en «También te puede
 * gustar» (`card`).
 */
export function SponsoredCard({
  product,
  variant = "card",
}: {
  product: ProductCardDTO;
  variant?: "card" | "rail";
}) {
  const href = `/producto/${product.slug}?ref=destacado` as Route;
  if (variant === "rail") {
    return (
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-2xl p-2 hover:bg-secondary"
      >
        <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
          {product.image ? (
            <Image
              src={product.image.url}
              alt=""
              fill
              sizes="64px"
              {...blurPlaceholder(product.image)}
              style={{ objectFit: "cover" }}
            />
          ) : null}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="line-clamp-2 text-sm font-semibold">{product.title}</span>
          <span className="font-heading text-base font-extrabold">
            {formatMoney(product.priceCents, product.currency)}
          </span>
          <span className="text-xs text-muted-foreground">Patrocinado · {product.city}</span>
        </span>
      </Link>
    );
  }
  return (
    <Link href={href} className="group flex flex-col gap-2">
      <div className="relative aspect-4/5 overflow-hidden rounded-2xl bg-muted">
        {product.image ? (
          <Image
            src={product.image.url}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, 240px"
            {...blurPlaceholder(product.image)}
            style={{ objectFit: "cover" }}
            className="transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
        <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-bold text-foreground">
          Patrocinado
        </span>
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

/** Bloque «Patrocinado» de la columna derecha: hasta dos productos y la entrada para anunciarse. */
export function SponsoredRail({
  products,
  isSeller,
  className,
}: {
  products: ProductCardDTO[];
  isSeller: boolean;
  className?: string;
}) {
  if (products.length === 0 && !isSeller) return null;
  return (
    <section
      aria-labelledby="patrocinado"
      className={cn("flex flex-col gap-2 rounded-3xl border bg-card p-3", className)}
    >
      <div className="flex items-baseline justify-between px-2">
        <h2
          id="patrocinado"
          className="text-[11.5px] font-extrabold tracking-[0.1em] text-muted-foreground uppercase"
        >
          Patrocinado
        </h2>
        {isSeller ? (
          <Link
            href={"/studio/campanas" as Route}
            className="text-[12.5px] font-bold text-primary-text hover:underline"
          >
            Anúnciate aquí
          </Link>
        ) : null}
      </div>
      {products.length === 0 ? (
        <p className="px-2 pb-1 text-xs text-muted-foreground">
          Este lugar es para productos destacados. Destaca el tuyo desde $15 al día.
        </p>
      ) : (
        <ul className="flex flex-col">
          {products.map((product) => (
            <li key={product.id}>
              <SponsoredCard product={product} variant="rail" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Fila «Destacados» arriba de Comprar. */
export function SponsoredRow({ products }: { products: ProductCardDTO[] }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="destacados" className="flex flex-col gap-2 px-4 md:px-0">
      <h2 id="destacados" className="text-sm font-bold text-muted-foreground">
        Destacados <span className="font-normal">· patrocinados por sus tiendas</span>
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {products.map((product) => (
          <li key={product.id}>
            <SponsoredCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
