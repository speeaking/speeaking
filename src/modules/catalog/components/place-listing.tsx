import type { Route } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/app/seo";
import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo/json-ld";
import { type MexicanState, placePath } from "../places";
import type { ProductCardDTO } from "../queries";
import { ProductCard } from "./product-card";

/**
 * «Comprar en Jalisco» y «Decoración y plantas en Jalisco» (SEO nacional): productos a la venta de
 * vendedores de ese estado, con sus datos estructurados y la ruta de vuelta. Solo existe con al
 * menos `MIN_PRODUCTS_FOR_PLACE_PAGE` productos (sin páginas vacías).
 */
export function PlaceListing({
  state,
  category,
  heading,
  products,
}: {
  state: MexicanState;
  category?: { slug: string; name: string };
  heading: string;
  products: ProductCardDTO[];
}) {
  const url = absoluteUrl(placePath(state.slug, category?.slug));
  return (
    <>
      <PageHeader
        title={heading}
        description={`Productos de vendedores de ${state.name}. Revisa en cada ficha el precio, la disponibilidad y el envío.`}
      />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: heading,
            url,
            about: {
              "@type": "State",
              name: state.name,
              containedInPlace: { "@type": "Country", name: "México" },
            },
            mainEntity: {
              "@type": "ItemList",
              itemListElement: products.map((product, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: product.title,
                url: absoluteUrl(`/producto/${product.slug}`),
              })),
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Comprar", item: absoluteUrl("/comprar") },
              ...(category
                ? [
                    {
                      "@type": "ListItem",
                      position: 2,
                      name: category.name,
                      item: absoluteUrl(`/comprar/${category.slug}`),
                    },
                  ]
                : []),
              {
                "@type": "ListItem",
                position: category ? 3 : 2,
                name: heading,
                item: url,
              },
            ],
          },
        ]}
      />
      <nav
        aria-label="Más para comprar"
        className="mb-5 flex flex-wrap gap-3 px-4 text-sm font-semibold text-primary-text md:px-0"
      >
        <Link href="/comprar">Todos los productos</Link>
        {category ? (
          <>
            <Link href={placePath(state.slug) as Route}>Todo {state.name}</Link>
            <Link href={`/comprar/${category.slug}` as Route}>{category.name} en todo México</Link>
          </>
        ) : null}
      </nav>
      <div className="grid grid-cols-2 gap-4 px-4 pb-8 sm:grid-cols-3 md:px-0">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  );
}
