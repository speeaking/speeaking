/**
 * Filtros del inicio (burbujas, F5): «Para ti» sin filtro, «Siguiendo» (personas que sigues) o una
 * comunidad. Funciones puras para compartirlas entre las burbujas, la lista y sus pruebas.
 */
export type FeedFilter =
  { kind: "for-you" } | { kind: "following" } | { kind: "community"; slug: string; name: string };

export const FOR_YOU: FeedFilter = { kind: "for-you" };
export const FOLLOWING: FeedFilter = { kind: "following" };

/** Llave estable del filtro (para `key` y para recordar la primera página de cada uno). */
export function filterKey(filter: FeedFilter): string {
  return filter.kind === "community" ? `community:${filter.slug}` : filter.kind;
}

export function isSameFilter(a: FeedFilter, b: FeedFilter) {
  return filterKey(a) === filterKey(b);
}

/** Parámetros de `/api/feed` para la primera página del filtro (sin cursor). */
export function filterParams(filter: FeedFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.kind === "community") params.set("community", filter.slug);
  if (filter.kind === "following") params.set("following", "1");
  return params;
}

/** Lo que se anuncia al cambiar de filtro (región viva para lectores de pantalla). */
export function filterAnnouncement(filter: FeedFilter): string {
  switch (filter.kind) {
    case "for-you":
      return "Mostrando Para ti";
    case "following":
      return "Mostrando publicaciones de las personas que sigues";
    case "community":
      return `Mostrando publicaciones de ${filter.name}`;
  }
}
