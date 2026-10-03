import { cache } from "react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { absoluteUrl, pageMetadata, NO_INDEX } from "@/app/seo";
import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { listShopProducts } from "@/modules/catalog/queries";
import { db } from "@/server/db";

const getCategory = cache((slug: string) =>
  db.category.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      children: { select: { slug: true, name: true }, orderBy: { sortOrder: "asc" } },
    },
  }),
);

export async function generateMetadata({ params }: PageProps<"/comprar/[categoria]">) {
  const category = await getCategory((await params).categoria);
  if (!category) return { robots: NO_INDEX };
  return pageMetadata({
    title: `${category.name}: productos de vendedores`,
    path: `/comprar/${category.slug}`,
    description: `Explora ${category.name.toLocaleLowerCase("es-MX")} en speeaking. Compara fotos, precios y condiciones de entrega, y conversa con la tienda antes de comprar.`,
  });
}

export default async function CategoryPage({ params }: PageProps<"/comprar/[categoria]">) {
  const category = await getCategory((await params).categoria);
  if (!category) notFound();
  const products = await listShopProducts({ categorySlug: category.slug, limit: 48 });
  return (
    <>
      <PageHeader
        title={category.name}
        description={`Descubre ${category.name.toLocaleLowerCase("es-MX")} de vendedores de la comunidad. Consulta cada ficha para conocer precio, disponibilidad y entrega.`}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: category.name,
          url: absoluteUrl(`/comprar/${category.slug}`),
          mainEntity: {
            "@type": "ItemList",
            itemListElement: products.map((product, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: product.title,
              url: absoluteUrl(`/producto/${product.slug}`),
            })),
          },
        }}
      />
      <nav
        aria-label="Categorías de productos"
        className="mb-5 flex flex-wrap gap-3 px-4 text-sm font-semibold text-primary-text md:px-0"
      >
        <Link href="/comprar">Todos los productos</Link>
        {category.children.map((child) => (
          <Link key={child.slug} href={`/comprar/${child.slug}` as Route}>
            {child.name}
          </Link>
        ))}
      </nav>
      {products.length ? (
        <div className="grid grid-cols-2 gap-4 px-4 pb-8 sm:grid-cols-3 md:px-0">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-8 text-sm text-muted-foreground md:px-0">
          Todavía no hay productos disponibles en esta categoría.{" "}
          <Link href="/comprar" className="underline">
            Explora el catálogo.
          </Link>
        </p>
      )}
    </>
  );
}
