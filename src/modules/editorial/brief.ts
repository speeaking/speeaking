import { type Day, daysBetween } from "@/modules/platform/calendar";
import { type Occasion, OCCASION_WINDOW_DAYS, upcomingOccasions } from "./calendar";

/**
 * Qué se le encarga a la IA cada día (ADR-066). Lo decide el código, no el modelo (P2): el tipo de
 * publicación, el enfoque y, si toca, la fecha del calendario. Todo es determinista: el mismo día y
 * la misma comunidad dan el mismo encargo, así se puede probar y explicar.
 */

export const DRAFT_KINDS = ["QUESTION", "TIP", "DATE", "TOPIC"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

/** Largo del tema que puede escribir el equipo al pedir un borrador. */
export const TOPIC_MAX_CHARS = 240;

export const DRAFT_KIND_LABELS: Record<DraftKind, string> = {
  QUESTION: "Pregunta",
  TIP: "Consejo",
  DATE: "Fecha",
  TOPIC: "Tema del equipo",
};

export type DraftPlan =
  | { kind: "QUESTION" | "TIP"; angle: string }
  | { kind: "DATE"; angle: string; occasion: Occasion }
  | { kind: "TOPIC"; angle: string; topic: string };

/** Enfoques de una pregunta: van rotando para que la comunidad no lea siempre lo mismo. */
export const QUESTION_ANGLES = [
  "Haz una pregunta abierta sobre una experiencia que casi todas las personas han vivido con este tema.",
  "Plantea un debate amistoso entre dos opciones concretas y pide que elijan una y digan por qué.",
  "Pide una recomendación a la comunidad: qué les ha funcionado y qué no volverían a hacer.",
  "Haz un «¿qué prefieres?» ligero y divertido entre dos cosas del tema.",
  "Pide que cuenten su anécdota favorita o su primer recuerdo con este tema.",
  "Pregunta qué consejo le darían a alguien que apenas empieza en este tema.",
] as const;

/** Enfoques de un consejo. Sin cifras: el modelo no tiene datos que citar. */
export const TIP_ANGLES = [
  "Da un consejo práctico que se pueda aplicar hoy mismo, explicado en dos o tres pasos.",
  "Cuenta un error común de este tema y cómo evitarlo.",
  "Comparte tres ideas sencillas, en una sola oración cada una.",
  "Da un consejo para ahorrar tiempo o dinero, sin dar cifras ni precios.",
  "Comparte un truco poco conocido y pregunta si alguien tiene otro.",
] as const;

const DATE_ANGLE =
  "Relaciona esta fecha con el tema de la comunidad e invita a contar cómo la viven o qué planean. No expliques su historia ni des datos sobre ella.";

const TOPIC_ANGLE =
  "Escribe sobre el tema que pidió el equipo, usando solo lo que dice el tema, y termina con una pregunta para la comunidad.";

/** Comunidades donde un «consejo práctico» no tiene sentido: solo preguntas. */
const QUESTION_ONLY = new Set(["humor"]);

/** Día a partir del cual se cuentan las rotaciones (cualquier día fijo sirve). */
const EPOCH: Day = "2026-01-01";

function rotation(day: Day) {
  return Math.max(0, daysBetween(EPOCH, day));
}

/**
 * ¿A esta comunidad le toca ya hablar de la fecha? Se escalona con su posición para que las
 * comunidades no publiquen lo mismo el mismo día: la primera, siete días antes; la séptima, un día
 * antes; el día de la fecha, cualquiera que aún no lo haya hecho.
 */
function isOccasionDue(day: Day, occasion: Occasion, communityIndex: number) {
  const daysUntil = daysBetween(day, occasion.day);
  return daysUntil <= OCCASION_WINDOW_DAYS - (communityIndex % OCCASION_WINDOW_DAYS);
}

/**
 * El encargo automático del día para una comunidad: una fecha cercana que aún no haya tratado o, si
 * no hay, dos preguntas por cada consejo (las preguntas son las que invitan a comentar).
 */
export function planDraft(input: {
  day: Day;
  communityIndex: number;
  communitySlug: string;
  /** Fechas (`Occasion.key`) de las que la comunidad ya tiene borrador o publicación. */
  usedOccasions: ReadonlySet<string>;
}): DraftPlan {
  const { day, communityIndex, communitySlug, usedOccasions } = input;
  const occasion = upcomingOccasions(day).find(
    (candidate) =>
      !usedOccasions.has(candidate.key) && isOccasionDue(day, candidate, communityIndex),
  );
  if (occasion) return { kind: "DATE", angle: DATE_ANGLE, occasion };

  const turn = rotation(day) + communityIndex;
  const tip = !QUESTION_ONLY.has(communitySlug) && turn % 3 === 1;
  const angles = tip ? TIP_ANGLES : QUESTION_ANGLES;
  // El enfoque avanza con los días (y arranca distinto en cada comunidad).
  const angle = angles[(rotation(day) + communityIndex * 2) % angles.length]!;
  return { kind: tip ? "TIP" : "QUESTION", angle };
}

/** El encargo cuando el equipo pide un borrador sobre un tema suyo. */
export function planTopic(topic: string): DraftPlan {
  return { kind: "TOPIC", angle: TOPIC_ANGLE, topic };
}
