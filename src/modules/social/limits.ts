import "server-only";
import { headers } from "next/headers";
import { clientIp } from "@/server/client-ip";
import {
  limitOrError,
  rateLimitKey,
  rateLimitMany,
  type RateLimitSubject,
} from "@/server/rate-limit";

/**
 * Límites de frecuencia de las escrituras sociales y del feed (SEC-15): holgados para una persona
 * real, acotados para un script o una granja de cuentas. Cada intento cuenta (permitido o no) y el
 * conteo es atómico en la base (`rateLimit`). Las reglas por IP van primero y se omiten si no hay IP
 * confiable (`TRUSTED_PROXY_HOPS=0`); las de cuenta siempre aplican.
 */
type Rule = {
  scope: string;
  subject: Extract<RateLimitSubject, "ip" | "user">;
  limit: number;
  windowSeconds: number;
};

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SOCIAL_LIMITS = {
  // Publicar desplaza el contenido de los demás en el feed: el más estricto.
  post: [
    { scope: "post", subject: "ip", limit: 30, windowSeconds: HOUR },
    { scope: "post", subject: "user", limit: 10, windowSeconds: HOUR },
    { scope: "post.day", subject: "user", limit: 50, windowSeconds: DAY },
  ],
  // Ráfaga corta (5 por minuto) y techo por hora.
  comment: [
    { scope: "comment", subject: "ip", limit: 120, windowSeconds: HOUR },
    { scope: "comment.burst", subject: "user", limit: 5, windowSeconds: MINUTE },
    { scope: "comment", subject: "user", limit: 30, windowSeconds: HOUR },
  ],
  like: [{ scope: "like", subject: "user", limit: 300, windowSeconds: HOUR }],
  postAudience: [{ scope: "post.audience", subject: "user", limit: 60, windowSeconds: HOUR }],
  deletePost: [{ scope: "post.delete", subject: "user", limit: 60, windowSeconds: HOUR }],
  deleteContent: [{ scope: "content.delete", subject: "user", limit: 120, windowSeconds: HOUR }],
  save: [{ scope: "save", subject: "user", limit: 300, windowSeconds: HOUR }],
  // Seguir y unirse revalidan todo el layout social: cada llamada cuesta un render completo.
  follow: [
    { scope: "follow", subject: "ip", limit: 300, windowSeconds: HOUR },
    { scope: "follow", subject: "user", limit: 100, windowSeconds: HOUR },
  ],
  join: [{ scope: "join", subject: "user", limit: 30, windowSeconds: HOUR }],
  createCommunity: [
    { scope: "community.create", subject: "ip", limit: 20, windowSeconds: DAY },
    { scope: "community.create", subject: "user", limit: 3, windowSeconds: DAY },
  ],
  manageCommunity: [
    { scope: "community.manage", subject: "user", limit: 100, windowSeconds: HOUR },
  ],
  // «Contexto» (ADR-060): generar un resumen nuevo (los ya guardados no cuentan).
  context: [
    { scope: "context", subject: "ip", limit: 60, windowSeconds: HOUR },
    { scope: "context", subject: "user", limit: 30, windowSeconds: HOUR },
  ],
  // Buscar por foto (ADR-061): cada intento reduce una foto en el servidor ANTES de la cuota de IA
  // (que solo cuenta las fotos válidas); esto acota también los intentos con archivos que no sirven.
  photo: [
    { scope: "photo", subject: "ip", limit: 60, windowSeconds: HOUR },
    { scope: "photo", subject: "user", limit: 30, windowSeconds: HOUR },
  ],
  // Colaboraciones (ADR-063): activar o desactivar, quitar una etiqueta, marcar una colaboración.
  collaboration: [{ scope: "collab", subject: "user", limit: 60, windowSeconds: HOUR }],
  // Editar el perfil revalida todo el layout (la foto va en la barra): pocas veces por hora.
  profile: [{ scope: "profile", subject: "user", limit: 20, windowSeconds: HOUR }],
  // Compartir se puede sin cuenta: por IP y, con sesión, también por cuenta.
  share: [
    { scope: "share", subject: "ip", limit: 60, windowSeconds: HOUR },
    { scope: "share", subject: "user", limit: 60, windowSeconds: HOUR },
  ],
  // Páginas del scroll infinito (10 publicaciones cada una).
  feed: [
    { scope: "feed", subject: "ip", limit: 300, windowSeconds: MINUTE },
    { scope: "feed", subject: "user", limit: 60, windowSeconds: MINUTE },
  ],
  postText: [
    { scope: "post.text", subject: "ip", limit: 300, windowSeconds: MINUTE },
    { scope: "post.text", subject: "user", limit: 60, windowSeconds: MINUTE },
  ],
  search: [
    { scope: "search", subject: "ip", limit: 120, windowSeconds: MINUTE },
    { scope: "search", subject: "user", limit: 60, windowSeconds: MINUTE },
  ],
} as const satisfies Record<string, readonly Rule[]>;

export type SocialLimitedAction = keyof typeof SOCIAL_LIMITS;

export type SocialLimitResult =
  { ok: true } | { ok: false; error: string; retryAfterSeconds: number };

/**
 * Suma un intento de `action` para esta persona (o solo su IP, sin sesión) y dice si se permite.
 * Con el límite agotado devuelve el mensaje para la interfaz ("Demasiados intentos. Intenta de nuevo
 * en N minutos.").
 */
export async function checkSocialLimit(
  action: SocialLimitedAction,
  userId: string | null,
): Promise<SocialLimitResult> {
  const ip = clientIp(await headers());
  const result = await rateLimitMany(
    SOCIAL_LIMITS[action].map(({ scope, subject, limit, windowSeconds }) => ({
      key: rateLimitKey(scope, subject, subject === "ip" ? ip : userId),
      limit,
      windowSeconds,
    })),
  );
  if (result.ok) return result;
  return {
    ok: false,
    error: limitOrError(result) ?? "Demasiados intentos.",
    retryAfterSeconds: result.retryAfterSeconds,
  };
}
