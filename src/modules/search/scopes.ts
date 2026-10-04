import type { Route } from "next";

export const SEARCH_SCOPES = [
  { value: "todo", label: "Todo" },
  { value: "personas", label: "Personas" },
  { value: "comunidades", label: "Comunidades" },
  { value: "publicaciones", label: "Publicaciones" },
  { value: "videos", label: "Videos" },
  { value: "productos", label: "Productos" },
] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number]["value"];
export type SearchCategory = Exclude<SearchScope, "todo">;
export const SEARCH_MAX_PAGES = 50;

export function parseSearchScope(raw: unknown): SearchScope {
  if (raw === "grupos") return "comunidades";
  return SEARCH_SCOPES.find((scope) => scope.value === raw)?.value ?? "todo";
}

/** Índice interno desde cero, con un máximo para acotar las consultas por desplazamiento. */
export function parseSearchPage(raw: unknown): number {
  if (typeof raw !== "string" || !/^[1-9]\d{0,2}$/.test(raw)) return 0;
  return Math.min(Number(raw), SEARCH_MAX_PAGES) - 1;
}

export function searchHref(query: string, scope: SearchScope, page = 0): Route {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (scope !== "todo") params.set("tipo", scope);
  if (page > 0 && scope !== "todo") params.set("pagina", String(page + 1));
  return `/buscar${params.size ? `?${params}` : ""}` as Route;
}
