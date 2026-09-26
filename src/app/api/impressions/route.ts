import { headers } from "next/headers";
import {
  MAX_VISIBLE_IMPRESSIONS_BODY_BYTES,
  type VisibleImpressionOutcome,
  type VisibleImpressionReport,
  visibleImpressionsRequestSchema,
} from "@/modules/analytics/visible-impression-contract";
import { recordVisibleImpressions } from "@/modules/analytics/visible-impressions";
import { getViewer } from "@/modules/identity/session";
import { readBodyWithLimit } from "@/modules/media/limited-body";
import { clientIp } from "@/server/client-ip";
import { env } from "@/server/env";
import { rateLimitKey, rateLimitMany } from "@/server/rate-limit";

/**
 * Impresiones VISIBLES del feed (T5, ADR-037). El navegador las junta y las manda cada 5 s o al
 * salir de la página (`navigator.sendBeacon`, por eso el cuerpo puede llegar como `text/plain`).
 * Con o sin sesión; quién cuenta y qué se guarda lo decide `recordVisibleImpressions` (solo piezas
 * servidas a quien reporta, una por persona, publicación y día, sin personalización = anónimo).
 * Lo que no cuenta se descarta sin error: la respuesta solo dice cuántas se guardaron.
 *
 * Nunca responde 500: si la base falla (sesión, límites o registro), responde 200 con las piezas en
 * `failed` y lo deja en el log. Se cuenta de menos, nunca de más, y el navegador no reintenta.
 */

const MINUTE = 60;
/**
 * Holgados para una persona real (una petición cada 5 s por pestaña), acotados para un script
 * (ADR-037). Con sesión y sin ella usan llaves de IP distintas: no comparten cupo.
 */
export const IMPRESSIONS_LIMITS = {
  /** Sin sesión, por IP. */
  ip: { limit: 240, windowSeconds: MINUTE },
  /** Con sesión, por cuenta: lo que acota a cada persona. */
  user: { limit: 60, windowSeconds: MINUTE },
  /**
   * Con sesión, por IP: solo un techo. En las redes móviles de México muchas personas salen por la
   * misma IP del operador (NAT compartido); con 240 por IP, unas cuantas personas con sesión detrás
   * de la misma IP se quedarían sin registrar sus visibles, que son las únicas con las que decide el
   * motor. Cada cuenta ya tiene su tope; este acota cuántas cuentas manda una misma IP.
   */
  signedInIp: { limit: 2_000, windowSeconds: MINUTE },
  /** Sin sesión ni IP de confianza no hay a quién limitar: un tope común para no cargar la base. */
  anonymous: { limit: 3_000, windowSeconds: MINUTE },
} as const;

/**
 * Reglas en el orden en que se revisan (`rateLimitMany` se detiene en la primera que falla y cada
 * intento suma aunque se rechace). Con sesión, primero la cuenta: quien pasa su tope se detiene ahí y
 * no gasta el cupo de la IP que comparte con otras personas. Sin sesión, las de siempre: por IP o,
 * sin una IP de confianza válida, el tope común.
 */
function impressionsRateLimitRules(viewerId: string | null, ip: string | null) {
  if (viewerId) {
    return [
      { key: rateLimitKey("impressions", "user", viewerId), ...IMPRESSIONS_LIMITS.user },
      {
        key: rateLimitKey("impressions.signed-in", "ip", ip),
        ...IMPRESSIONS_LIMITS.signedInIp,
      },
    ];
  }
  const ipKey = rateLimitKey("impressions", "ip", ip);
  return [
    { key: ipKey, ...IMPRESSIONS_LIMITS.ip },
    { key: ipKey ? null : "impressions:anon:all", ...IMPRESSIONS_LIMITS.anonymous },
  ];
}

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

/**
 * Solo desde la propia app: otra página no puede mandar impresiones con las cookies de la persona.
 * Manda `Sec-Fetch-Site` (debe ser `same-origin`); si el navegador no lo manda (versiones viejas),
 * el `Origin` debe ser exactamente el de la app (`APP_URL`; `null` tampoco vale). Sin ninguno de los
 * dos no es un navegador en otra página: un script sin cookies de nadie, que de todos modos podría
 * inventarlos, y que pasa por los límites y las reglas de `recordVisibleImpressions`.
 */
function isAllowedOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  return origin === new URL(env.APP_URL).origin;
}

/** Ninguna se guardó porque la base falló: una por publicación (como las cuenta el registro). */
function allFailed(items: readonly VisibleImpressionReport[]): VisibleImpressionOutcome {
  const unique = new Set(items.map((item) => item.postId.toLowerCase())).size;
  return { recorded: 0, duplicates: 0, rejected: 0, failed: unique };
}

type ReadItems = { ok: true; items: VisibleImpressionReport[] } | { ok: false; response: Response };

async function readItems(request: Request): Promise<ReadItems> {
  let body: Awaited<ReturnType<typeof readBodyWithLimit>>;
  try {
    body = await readBodyWithLimit(request.body, MAX_VISIBLE_IMPRESSIONS_BODY_BYTES, {
      timeoutMs: 10_000,
    });
  } catch {
    // El cliente cortó la conexión a medio cuerpo.
    return { ok: false, response: json({ error: "Cuerpo inválido." }, 400) };
  }
  if (!body.ok) {
    return {
      ok: false,
      response:
        body.reason === "TOO_LARGE"
          ? json({ error: "Demasiadas impresiones." }, 413, { Connection: "close" })
          : json({ error: "El cuerpo tardó demasiado en llegar." }, 408, { Connection: "close" }),
    };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body.data.toString("utf8"));
  } catch {
    return { ok: false, response: json({ error: "Cuerpo inválido." }, 400) };
  }
  const parsed = visibleImpressionsRequestSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, response: json({ error: "Cuerpo inválido." }, 400) };
  return { ok: true, items: parsed.data.items };
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return json({ error: "Origen no permitido." }, 403);

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_VISIBLE_IMPRESSIONS_BODY_BYTES) {
    return json({ error: "Demasiadas impresiones." }, 413, { Connection: "close" });
  }

  let viewer: Awaited<ReturnType<typeof getViewer>>;
  let ip: string | null;
  let limited: Awaited<ReturnType<typeof rateLimitMany>>;
  try {
    viewer = await getViewer();
    ip = clientIp(await headers());
    limited = await rateLimitMany(impressionsRateLimitRules(viewer?.userId ?? null, ip));
  } catch (error) {
    // Sin sesión o sin límites (la base falló) no se registra nada: ni como anónimo ni sin tope.
    console.error("[impressions] no se pudo leer la sesión o los límites", error);
    const read = await readItems(request);
    return read.ok ? json(allFailed(read.items), 200) : read.response;
  }
  if (!limited.ok) {
    return json({ error: "Demasiadas impresiones." }, 429, {
      "Retry-After": String(limited.retryAfterSeconds),
    });
  }

  const read = await readItems(request);
  if (!read.ok) return read.response;

  try {
    const outcome = await recordVisibleImpressions({
      viewerId: viewer?.userId ?? null,
      ip,
      items: read.items,
    });
    return json(outcome, 200);
  } catch (error) {
    // `recordVisibleImpressions` no lanza; esto es solo por si algún día lo hace.
    console.error("[impressions] no se pudieron registrar", error);
    return json(allFailed(read.items), 200);
  }
}
