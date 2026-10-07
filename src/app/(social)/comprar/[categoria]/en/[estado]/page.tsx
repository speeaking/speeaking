import { cache } from "react";
import { notFound } from "next/navigation";
import { NO_INDEX, pageMetadata } from "@/app/seo";
import { PlaceListing } from "@/modules/catalog/components/place-listing";
import { MIN_PRODUCTS_FOR_PLACE_PAGE, placePath } from "@/modules/catalog/places";
import { listPlaceProducts } from "@/modules/catalog/queries";
import { placeSeo } from "@/modules/catalog/seo";
import { db } from "@/server/db";

/** Una categoría en un estado, solo con suficientes productos (sin páginas vacías). */
const getPlace = cache(async (categorySlug: string, stateSlug: string) => {
  const category = await db.category.findUnique({
    where: { slug: categorySlug },
    select: { slug: true, name: true },
  });
  if (!category) return null;
  const page = await listPlaceProducts({ stateSlug, categorySlug: category.slug });
  return page && page.place.count >= MIN_PRODUCTS_FOR_PLACE_PAGE ? { category, ...page } : null;
});

export async function generateMetadata({ params }: PageProps<"/comprar/[categoria]/en/[estado]">) {
  const { categoria, estado } = await params;
  const page = await getPlace(categoria, estado);
  if (!page) return { robots: NO_INDEX };
  const { title, description } = placeSeo({
    stateName: page.place.state.name,
    categoryName: page.category.name,
    count: page.place.count,
  });
  return pageMetadata({
    title,
    description,
    path: placePath(page.place.state.slug, page.category.slug),
  });
}

export default async function CategoryStatePage({
  params,
}: PageProps<"/comprar/[categoria]/en/[estado]">) {
  const { categoria, estado } = await params;
  const page = await getPlace(categoria, estado);
  if (!page) notFound();
  const { heading } = placeSeo({
    stateName: page.place.state.name,
    categoryName: page.category.name,
    count: page.place.count,
  });
  return (
    <PlaceListing
      state={page.place.state}
      category={page.category}
      heading={heading}
      products={page.products}
    />
  );
}
