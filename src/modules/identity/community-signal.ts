import { formatCount, formatMembers } from "@/lib/format";

/** Por debajo de este número no mostramos cuántos miembros hay: una cifra baja no dice nada útil. */
export const MIN_VISIBLE_MEMBERS = 10;

/**
 * Señal honesta de una comunidad: sus miembros cuando ya son varios o, si es nueva, cuánto contenido
 * tiene. Nunca redondeamos ni inflamos cifras (principio 5).
 */
export function communitySignal({
  memberCount,
  postCount,
}: {
  memberCount: number;
  postCount: number;
}) {
  if (memberCount >= MIN_VISIBLE_MEMBERS) return formatMembers(memberCount);
  if (postCount === 0) return "Comunidad nueva";
  return `Comunidad nueva · ${formatCount(postCount, "publicación", "publicaciones")}`;
}
