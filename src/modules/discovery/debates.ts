/**
 * «Debates abiertos»: preguntas recientes de las comunidades que esperan opinión. Selección pura y
 * determinista; los números salen de la base de datos, nunca se inventan (principio 5).
 */

export type DebateCandidate = {
  id: string;
  body: string;
  communityId: string | null;
  commentCount: number;
  publishedAt: Date;
};

export const MAX_DEBATES = 4;

/**
 * Lo que puede ir después del signo de cierre sin que deje de ser una pregunta: espacios, emoji
 * (con sus modificadores y uniones), comillas de cierre y un «!» o «…» de énfasis.
 */
const QUESTION_END =
  /\?[\s\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Emoji_Component}‍️!…."'”’»)]*$/u;

/** ¿El texto termina en pregunta? («¿Manual o automático? 🚗» sí; «Debate: ¿A o B? Opina.» no). */
export function isOpenQuestion(body: string): boolean {
  return QUESTION_END.test(body.trim());
}

/**
 * Hasta `limit` preguntas, la más reciente primero y una por comunidad para que haya variedad.
 * `anyAnswered` dice si alguna ya tiene respuestas: si ninguna, la interfaz muestra UNA invitación
 * en lugar de repetir «aún sin respuestas».
 */
export function selectDebates<T extends DebateCandidate>(
  candidates: readonly T[],
  limit: number = MAX_DEBATES,
): { items: T[]; anyAnswered: boolean } {
  const sorted = candidates
    .filter((candidate) => candidate.communityId !== null && isOpenQuestion(candidate.body))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.id.localeCompare(b.id));

  const items: T[] = [];
  const seen = new Set<string>();
  for (const candidate of sorted) {
    if (items.length >= limit) break;
    if (seen.has(candidate.communityId!)) continue;
    seen.add(candidate.communityId!);
    items.push(candidate);
  }
  return { items, anyAnswered: items.some((item) => item.commentCount > 0) };
}

/**
 * Primero las preguntas de tus comunidades; si no llegan a `limit`, completa con las de otras
 * comunidades (sin repetir comunidad ni publicación). `fromOthers` dice cuántas vienen de fuera.
 */
export function selectDebatesPreferring<T extends DebateCandidate>(
  preferred: readonly T[],
  others: readonly T[],
  limit: number = MAX_DEBATES,
): { items: T[]; anyAnswered: boolean; fromOthers: number } {
  const first = selectDebates(preferred, limit);
  if (first.items.length >= limit) return { ...first, fromOthers: 0 };

  const usedCommunities = new Set(first.items.map((item) => item.communityId));
  const usedIds = new Set(first.items.map((item) => item.id));
  const rest = selectDebates(
    others.filter((item) => !usedIds.has(item.id) && !usedCommunities.has(item.communityId)),
    limit - first.items.length,
  );
  return {
    items: [...first.items, ...rest.items],
    anyAnswered: first.anyAnswered || rest.anyAnswered,
    fromOthers: rest.items.length,
  };
}

/** Recorta el texto para la columna sin partir palabras (la interfaz además limita a 3 líneas). */
export function debateExcerpt(body: string, max = 160) {
  const text = body.trim().replace(/\s+/g, " ");
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
