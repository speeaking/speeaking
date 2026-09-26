/**
 * «Gente de tus comunidades» (F6b): puntuación determinista y razón visible. Solo señales propias
 * de la plataforma (principio 6) y que ya son públicas dentro de ella: a quién sigues, tus
 * comunidades y quién comentó tus publicaciones. Los «me gusta» NO cuentan: la app no revela quién
 * dio «me gusta» en ningún otro lugar, y una sugerencia lo delataría. Nunca contactos del teléfono
 * ni de otras redes.
 */

/** Con menos candidatos reales no se muestra nada (principio 5: nada de relleno). */
export const MIN_SUGGESTIONS = 3;

export type SuggestionSignals = {
  userId: string;
  /** Personas que tú sigues y que siguen a esta persona. */
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
  | { kind: "followed-by-following"; count: number }
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
  const parts: [points: number, reason: SuggestionReason][] = [
    [
      3 * Math.min(signals.followedByFollowing, CAP.followedByFollowing),
      { kind: "followed-by-following", count: signals.followedByFollowing },
    ],
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

/** Texto de la razón: «La siguen 2 personas que sigues», «También está en Gaming y Deportes»… */
export function suggestionReasonText(reason: SuggestionReason): string {
  switch (reason.kind) {
    case "followed-by-following":
      return reason.count === 1
        ? "La sigue 1 persona que sigues"
        : `La siguen ${reason.count} personas que sigues`;
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
