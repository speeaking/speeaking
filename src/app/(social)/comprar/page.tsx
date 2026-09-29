import { Search, ShoppingBag } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { track } from "@/modules/analytics/track";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { listCategories, listShopProducts } from "@/modules/catalog/queries";
import { getViewer } from "@/modules/identity/session";
import { parseSearchQuery, SEARCH_MAX_LENGTH } from "@/modules/search/normalize";
import { StylistCard } from "@/modules/stylist/components/stylist-card";

export const metadata: Metadata = { title: "Comprar" };

export default async function ShopPage({ searchParams }: PageProps<"/comprar">) {
  const { q, categoria } = await searchParams;
  // La misma normalización que /buscar: por palabras, sin acentos ni mayúsculas.
  const search = parseSearchQuery(q);
  const query = search?.text ?? "";
  const categorySlug = typeof categoria === "string" ? categoria : undefined;

  const [viewer, categories, products] = await Promise.all([
    getViewer(),
    listCategories(),
    listShopProducts({ categorySlug, query: search }),
  ]);
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
      <PageHeader title="Comprar" description="Productos de vendedores de tu comunidad." />
      <div className="flex flex-col gap-4">
        {/* Lo que cambia es cómo se compra: el estilista abre Comprar (no el feed). Con una búsqueda o
            una categoría activa, los resultados van primero. */}
        {!query && !categorySlug ? <StylistCard /> : null}
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
                `/comprar?categoria=${category.slug}${query ? `&q=${encodeURIComponent(query)}` : ""}` as Route
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
            <EmptyState
              icon={ShoppingBag}
              title={
                query
                  ? `Sin resultados para “${query}”${activeCategory ? ` en ${activeCategory.name}` : ""}`
                  : "Todavía no hay productos"
              }
              description={
                activeCategory
                  ? "Prueba en todas las categorías o con otra palabra."
                  : "Prueba con otra palabra o explora las comunidades."
              }
              action={
                activeCategory ? (
                  <Link
                    href={allCategoriesHref}
                    // Sobre el lienzo gris, en blanco: si no, en claro se leía como texto suelto.
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-11 bg-card px-4 text-[15px] md:h-10",
                    )}
                  >
                    {query ? "Buscar en todas las categorías" : "Ver todas las categorías"}
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:px-0">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
