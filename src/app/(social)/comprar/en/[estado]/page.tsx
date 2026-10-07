import { cache } from "react";
import { notFound } from "next/navigation";
import { NO_INDEX, pageMetadata } from "@/app/seo";
import { PlaceListing } from "@/modules/catalog/components/place-listing";
import { MIN_PRODUCTS_FOR_PLACE_PAGE, placePath } from "@/modules/catalog/places";
import { listPlaceProducts } from "@/modules/catalog/queries";
import { placeSeo } from "@/modules/catalog/seo";

/** Solo con suficientes productos de ese estado: sin páginas vacías (las castigan los buscadores). */
const getPlace = cache(async (stateSlug: string) => {
  const page = await listPlaceProducts({ stateSlug });
  return page && page.place.count >= MIN_PRODUCTS_FOR_PLACE_PAGE ? page : null;
});

export async function generateMetadata({ params }: PageProps<"/comprar/en/[estado]">) {
  const page = await getPlace((await params).estado);
  if (!page) return { robots: NO_INDEX };
  const { title, description } = placeSeo({
    stateName: page.place.state.name,
    count: page.place.count,
  });
  return pageMetadata({ title, description, path: placePath(page.place.state.slug) });
}

export default async function StatePage({ params }: PageProps<"/comprar/en/[estado]">) {
  const page = await getPlace((await params).estado);
  if (!page) notFound();
  const { heading } = placeSeo({ stateName: page.place.state.name, count: page.place.count });
  return <PlaceListing state={page.place.state} heading={heading} products={page.products} />;
}
