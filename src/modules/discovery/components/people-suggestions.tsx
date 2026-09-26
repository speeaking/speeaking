import { getPeopleSuggestions } from "../service";
import { MIN_SUGGESTIONS } from "../suggestions";
import { PeopleSuggestionsView, type PeopleSuggestionsVariant } from "./people-suggestions-view";

/** La columna muestra pocas personas; el carrusel del feed, todas las calculadas (hasta 10). */
const VISIBLE = { rail: 3, feed: 10 } as const satisfies Record<PeopleSuggestionsVariant, number>;

/**
 * «Gente de tus comunidades» (F6b). No pinta nada si hay menos de 3 candidatos reales
 * (principio 5); en ese caso la pantalla muestra otras cosas (p. ej. comunidades sugeridas).
 * Es un bloque secundario: si la consulta falla, se omite en lugar de romper la página.
 */
export async function PeopleSuggestions({
  viewerId,
  variant,
}: {
  viewerId: string;
  variant: PeopleSuggestionsVariant;
}) {
  const people = await getPeopleSuggestions(viewerId).catch((error: unknown) => {
    console.error("[discovery] no se pudieron calcular las sugerencias de personas", error);
    return [];
  });
  if (people.length < MIN_SUGGESTIONS) return null;
  return <PeopleSuggestionsView people={people.slice(0, VISIBLE[variant])} variant={variant} />;
}
