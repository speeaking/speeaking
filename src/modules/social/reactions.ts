import type { ReactionKind } from "@/generated/prisma/enums";

export type { ReactionKind };

export type ReactionMeta = { kind: ReactionKind; emoji: string; label: string };

/**
 * Reacciones (ADR-054). Orden fijo de la tira: la primera es la del toque simple (y del doble toque
 * sobre la foto); el resto sale al dejar presionado o al pasar el cursor. Emojis del sistema: se ven
 * como el teclado de cada quien y no cuestan nada.
 */
export const REACTIONS: readonly ReactionMeta[] = [
  { kind: "LIKE", emoji: "❤️", label: "Me gusta" },
  { kind: "CARE", emoji: "🤗", label: "Me importa" },
  { kind: "HAHA", emoji: "😂", label: "Me divierte" },
  { kind: "WOW", emoji: "😮", label: "Me asombra" },
  { kind: "SAD", emoji: "😢", label: "Me entristece" },
  { kind: "ANGRY", emoji: "😡", label: "Me enoja" },
];

const BY_KIND = new Map(REACTIONS.map((reaction) => [reaction.kind, reaction]));
const ORDER = new Map(REACTIONS.map((reaction, index) => [reaction.kind, index]));

export function reactionMeta(kind: ReactionKind): ReactionMeta {
  return BY_KIND.get(kind) ?? REACTIONS[0]!;
}

/** Cuántos emojis lleva el resumen bajo el botón («❤️😂😮 24»). */
export const TOP_REACTIONS = 3;

/** Las reacciones más usadas de una publicación: por cantidad y, en empate, por el orden de la tira. */
export function topReactions(counts: Partial<Record<ReactionKind, number>>): ReactionKind[] {
  return (Object.entries(counts) as [ReactionKind, number | undefined][])
    .filter((entry): entry is [ReactionKind, number] => (entry[1] ?? 0) > 0)
    .sort(
      ([kindA, countA], [kindB, countB]) =>
        countB - countA || (ORDER.get(kindA) ?? ORDER.size) - (ORDER.get(kindB) ?? ORDER.size),
    )
    .slice(0, TOP_REACTIONS)
    .map(([kind]) => kind);
}

export type ReactionState = {
  /** La reacción de quien mira; `null` si no ha reaccionado. */
  kind: ReactionKind | null;
  /** Total de reacciones de la publicación (de todos los tipos). */
  count: number;
  /** Resumen: los tipos más usados, de mayor a menor. */
  top: readonly ReactionKind[];
};

/**
 * Siguiente estado optimista al reaccionar (`next`) o quitar la reacción (`null`): una persona tiene
 * una sola reacción, así que cambiarla no mueve el total. El servidor manda después el estado real.
 */
export function applyReaction(state: ReactionState, next: ReactionKind | null): ReactionState {
  if (next === null) {
    if (state.kind === null) return { kind: null, count: state.count, top: [...state.top] };
    const count = Math.max(0, state.count - 1);
    return { kind: null, count, top: count === 0 ? [] : [...state.top] };
  }
  const count = state.kind === null ? state.count + 1 : state.count;
  const top =
    state.top.includes(next) || state.top.length >= TOP_REACTIONS
      ? [...state.top]
      : [...state.top, next];
  return { kind: next, count, top };
}
