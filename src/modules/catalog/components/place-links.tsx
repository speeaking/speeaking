import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { type PlaceCount, placePath, placesWithPage } from "../places";

/**
 * «Compra por estado»: enlaces a las páginas «Comprar en …» que ya existen (al menos 6 productos),
 * para que quien compra y los buscadores lleguen a ellas. Sin estados con página, no se muestra.
 */
export function PlaceLinks({
  title,
  places,
  categorySlug,
  className,
}: {
  title: string;
  places: ReadonlyMap<string, PlaceCount>;
  categorySlug?: string;
  className?: string;
}) {
  const listed = placesWithPage(places);
  if (listed.length === 0) return null;
  return (
    <nav aria-label={title} className={cn("flex flex-col gap-2 px-4 md:px-0", className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-primary-text">
        {listed.map((place) => (
          <li key={place.state.slug}>
            <Link
              href={placePath(place.state.slug, categorySlug) as Route}
              className="hover:underline"
            >
              {place.state.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
