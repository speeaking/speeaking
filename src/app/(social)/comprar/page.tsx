import { ReceiptText, Search, ShoppingCart } from "lucide-react";
import { pageMetadata } from "@/app/seo";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/modules/analytics/track";
import { SponsoredRow } from "@/modules/billing/components/sponsored-products";
import { PlaceLinks } from "@/modules/catalog/components/place-links";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { ShopEmptyState } from "@/modules/catalog/components/shop-empty-state";
import {
  listCategories,
  listFeaturedProducts,
  listShopProducts,
  placeCounts,
} from "@/modules/catalog/queries";
import { getViewer } from "@/modules/identity/session";
import { parseSearchQuery, SEARCH_MAX_LENGTH } from "@/modules/search/normalize";
import { StylistCard } from "@/modules/stylist/components/stylist-card";

export async function generateMetadata({ searchParams }: PageProps<"/comprar">): Promise<Metadata> {
  const { q, categoria } = await searchParams;
  return pageMetadata({
    title: "Compra productos de vendedores en México",
    description:
      "Descubre prendas, accesorios y más en speeaking. Revisa precios, prueba prendas compatibles con IA y conversa con la tienda antes de comprar.",
    path: "/comprar",
    noIndex: Boolean(q || categoria),
  });
}

export default async function ShopPage({ searchParams }: PageProps<"/comprar">) {
  const { q, categoria } = await searchParams;
  // La misma normalización que /buscar: por palabras, sin acentos ni mayúsculas.
  const search = parseSearchQuery(q);
  const query = search?.text ?? "";
  const categorySlug = typeof categoria === "string" ? categoria : undefined;

  const [viewer, categories, products, places] = await Promise.all([
    getViewer(),
    listCategories(),
    listShopProducts({ categorySlug, query: search }),
    // «Compra por estado» solo en la portada de Comprar (la que se indexa).
    !query && !categorySlug ? placeCounts() : null,
  ]);
  // Destacados (ADR-046) solo en la portada de Comprar: con búsqueda o categoría, los resultados
  // van primero y sin patrocinados en medio.
  const sponsored =
    !query && !categorySlug
      ? await listFeaturedProducts({ limit: 3, excludeUserId: viewer?.userId ?? null })
      : [];
  if (query) {
    // P5: las búsquedas son señales de intención para el Commerce Engine.
    track({ type: "SEARCH", userId: viewer?.userId ?? null, query, surface: "SHOP" });
  }
  const topLevel = categories.filter((category) => !category.parentId);
  // También una subcategoría (`?categoria=audio`): el filtro incluye categorías y subcategorías.
  const activeCategory = categories.find((category) => category.slug === categorySlug);
  const allCategoriesHref = (
    query ? `/comprar?q=${encodeURIComponent(query)}` : "/comprar"
  ) as Route;
  // Se ve de 34 px; en móvil el área táctil llega a 44 px (5 px arriba y abajo, dentro del relleno
  // de la fila, que con scroll horizontal recortaría lo que saliera de ella).
  const chip = (active: boolean) =>
    cn(
      "relative shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-inset-y-[5px] md:after:hidden",
      active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-secondary",
    );

  return (
    <>
      <PageHeader
        title="Tienda"
        description="Descubre productos de vendedores de tu comunidad."
        actions={
          viewer ? (
            <div className="flex gap-1">
              <Link
                href="/pedidos"
                aria-label="Mis compras"
                className={buttonVariants({ variant: "ghost", size: "icon-lg" })}
              >
                <ReceiptText className="size-5" />
              </Link>
              <Link
                href="/carrito"
                aria-label="Carrito"
                className={buttonVariants({ variant: "ghost", size: "icon-lg" })}
              >
                <ShoppingCart className="size-5" />
              </Link>
            </div>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-4">
        {/* Lo que cambia es cómo se compra: el estilista abre Comprar (no el feed). Con una búsqueda o
            una categoría activa, los resultados van primero. */}
        {!query && !categorySlug ? <StylistCard /> : null}
        <SponsoredRow products={sponsored} />
        <form action="/comprar" className="relative px-4 md:px-0" role="search">
          {categorySlug ? <input type="hidden" name="categoria" value={categorySlug} /> : null}
          <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground md:left-3" />
          <label htmlFor="buscar" className="sr-only">
            Buscar productos
          </label>
          <Input
            id="buscar"
            name="q"
            defaultValue={query}
            maxLength={SEARCH_MAX_LENGTH}
            placeholder="Busca audífonos, tenis, macetas…"
            className="h-11 pl-9 text-base"
          />
        </form>
        <nav
          aria-label="Categorías"
          className="-my-[5px] scrollbar-none flex gap-2 overflow-x-auto px-4 py-[5px] md:my-0 md:flex-wrap md:px-0 md:py-0"
        >
          <Link
            href={allCategoriesHref}
            className={chip(!categorySlug)}
            aria-current={categorySlug ? undefined : "page"}
          >
            Todo
          </Link>
          {topLevel.map((category) => (
            <Link
              key={category.id}
              href={
                query
                  ? (`/comprar?categoria=${category.slug}&q=${encodeURIComponent(query)}` as Route)
                  : (`/comprar/${category.slug}` as Route)
              }
              className={chip(categorySlug === category.slug)}
              aria-current={categorySlug === category.slug ? "page" : undefined}
            >
              {category.name}
            </Link>
          ))}
        </nav>
        {products.length === 0 ? (
          <div className="px-4 md:px-0">
            <ShopEmptyState
              query={query}
              categorySlug={categorySlug}
              categoryName={activeCategory?.name}
              allCategoriesHref={allCategoriesHref}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:px-0">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
        {places ? <PlaceLinks title="Compra por estado" places={places} /> : null}
      </div>
    </>
  );
}
