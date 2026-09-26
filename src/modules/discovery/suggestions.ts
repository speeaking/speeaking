/**
 * «Gente de tus comunidades» (F6b): puntuación determinista y razón visible. Solo señales propias
 * de la plataforma (principio 6) y que ya son públicas dentro de ella: a quién sigues, tus
 * comunidades y quién comentó tus publicaciones. Los «me gusta» NO cuentan: la app no revela quién
 * dio «me gusta» en ningún otro lugar, y una sugerencia lo delataría. Nunca contactos del teléfono
 * ni de otras redes.
 *
 * Una sugerencia tampoco puede delatar a quién sigue una persona concreta (SEC-17): la señal «la
 * siguen personas que sigues» solo usa seguidos MUTUOS que participan en las sugerencias, exige al
 * menos `MIN_FOLLOW_INTERMEDIARIES` distintos y su texto nunca dice cuántos son.
 */

/** Con menos candidatos reales no se muestra nada (principio 5: nada de relleno). */
export const MIN_SUGGESTIONS = 3;

/**
 * Intermediarios distintos que necesita la señal de seguidos (k-anonimato). Con uno solo, la razón
 * diría exactamente a quién sigue esa persona.
 */
export const MIN_FOLLOW_INTERMEDIARIES = 2;

export type SuggestionSignals = {
  userId: string;
  /**
   * Seguidos mutuos tuyos (participan en las sugerencias) que siguen a esta persona. Por debajo de
   * `MIN_FOLLOW_INTERMEDIARIES` no cuenta.
   */
  followedByFollowing: number;
  /** Nombres de las comunidades que comparten. */
  sharedCommunities: readonly string[];
  /** Comentarios publicados que dejó en tus publicaciones (los comentarios son públicos). */
  commentsOnYourPosts: number;
  /**
   * Qué tan reciente es su actividad en tus comunidades (0 = la más reciente). Solo desempata: así,
   * entre iguales, no salen siempre las cuentas más antiguas.
   */
  activityRank?: number;
};

export type SuggestionReason =
  // Sin el número: aunque sean pocos, no se puede deducir quiénes son.
  | { kind: "followed-by-following" }
  | { kind: "commented" }
  | { kind: "communities"; names: readonly string[] };

export type RankedSuggestion = { userId: string; score: number; reason: SuggestionReason };

/** Topes para que una sola señal enorme no lo decida todo. */
const CAP = { followedByFollowing: 5, interactions: 3, communities: 4 } as const;

const collator = new Intl.Collator("es-MX", { sensitivity: "base" });

/**
 * Puntuación = suma de señales; la razón es la señal que más aportó. Si empatan, gana la primera de
 * esta lista: te siguen en común > comentó > comunidades. `null` si no hay señales.
 */
export function scoreSuggestion(signals: SuggestionSignals): RankedSuggestion | null {
  const intermediaries =
    signals.followedByFollowing >= MIN_FOLLOW_INTERMEDIARIES ? signals.followedByFollowing : 0;
  const parts: [points: number, reason: SuggestionReason][] = [
    [3 * Math.min(intermediaries, CAP.followedByFollowing), { kind: "followed-by-following" }],
    [
      signals.commentsOnYourPosts > 0
        ? 4 + Math.min(signals.commentsOnYourPosts, CAP.interactions)
        : 0,
      { kind: "commented" },
    ],
    [
      Math.min(signals.sharedCommunities.length, CAP.communities),
      {
        kind: "communities",
        names: [...new Set(signals.sharedCommunities)].sort(collator.compare),
      },
    ],
  ];

  let score = 0;
  let strongest: (typeof parts)[number] | null = null;
  for (const part of parts) {
    score += part[0];
    if (part[0] > 0 && (!strongest || part[0] > strongest[0])) strongest = part;
  }
  return strongest ? { userId: signals.userId, score, reason: strongest[1] } : null;
}

/** Sin actividad conocida en tus comunidades: después de quienes sí la tienen. */
const NO_ACTIVITY = Number.MAX_SAFE_INTEGER;

/**
 * Ordena por puntuación; los empates, por actividad reciente y, al final, por id (estable y
 * determinista sin importar el orden de entrada).
 */
export function rankSuggestions(
  candidates: readonly SuggestionSignals[],
  limit: number,
): RankedSuggestion[] {
  return candidates
    .flatMap((candidate) => {
      const ranked = scoreSuggestion(candidate);
      return ranked ? [{ ranked, activity: candidate.activityRank ?? NO_ACTIVITY }] : [];
    })
    .sort(
      (a, b) =>
        b.ranked.score - a.ranked.score ||
        a.activity - b.activity ||
        a.ranked.userId.localeCompare(b.ranked.userId),
    )
    .slice(0, limit)
    .map(({ ranked }) => ranked);
}

const listFormat = new Intl.ListFormat("es-MX", { style: "long", type: "conjunction" });

/** Texto de la razón: «La siguen personas que sigues», «También está en Gaming y Deportes»… */
export function suggestionReasonText(reason: SuggestionReason): string {
  switch (reason.kind) {
    case "followed-by-following":
      return "La siguen personas que sigues";
    case "commented":
      return "Comentó tu publicación";
    case "communities": {
      const [first, second, ...rest] = reason.names;
      if (!first) return "Está en tus comunidades";
      // Hasta 3 se nombran todas («y 1 más» diría menos que el nombre mismo).
      if (rest.length <= 1) return `También está en ${listFormat.format(reason.names)}`;
      return `También está en ${first}, ${second} y ${rest.length} más`;
    }
  }
}
