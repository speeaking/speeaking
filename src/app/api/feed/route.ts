import { after } from "next/server";
import { z } from "zod";
import { recommendationEngine } from "@/modules/feed/engine";
import { trackImpressions } from "@/modules/feed/impressions";
import { decodeCursor } from "@/modules/feed/ranking";
import { getViewer } from "@/modules/identity/session";
import { checkSocialLimit } from "@/modules/social/limits";
import { markCommunitySeen } from "@/modules/social/unread";
import { db } from "@/server/db";

const querySchema = z.object({
  cursor: z.string().max(200).optional(),
  community: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  /** «Siguiendo» (burbuja del inicio): solo publicaciones de las personas que sigues. */
  following: z.literal("1").optional(),
});

/** Página del feed: la primera de un filtro (burbujas del inicio) o la siguiente (scroll infinito). */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return Response.json({ error: "Parámetros inválidos." }, { status: 400 });
  // Un cursor manipulado o vencido es un error del cliente, no del servidor (SEC-31).
  if (parsed.data.cursor !== undefined && !decodeCursor(parsed.data.cursor)) {
    return Response.json({ error: "Cursor inválido." }, { status: 400 });
  }

  const viewer = await getViewer();
  // Cada página calcula el ranking y registra impresiones: límite por IP y por cuenta (SEC-15).
  const limited = await checkSocialLimit("feed", viewer?.userId ?? null);
  if (!limited.ok) {
    return Response.json(
      { error: limited.error },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }
  const following = parsed.data.following === "1";
  if (following && !viewer) {
    return Response.json({ error: "Entra para ver a quién sigues." }, { status: 401 });
  }
  const community = parsed.data.community
    ? await db.community.findUnique({
        where: { slug: parsed.data.community },
        select: { id: true },
      })
    : null;
  if (parsed.data.community && !community) {
    return Response.json({ error: "Comunidad no encontrada." }, { status: 404 });
  }

  const page = await recommendationEngine.getFeed({
    viewerId: viewer?.userId ?? null,
    cursor: parsed.data.cursor,
    communityId: community?.id,
    following,
  });
  trackImpressions(page.items, viewer?.userId ?? null, community ? "COMMUNITY" : "FEED");
  // Filtrar por una comunidad (burbuja del inicio) cuenta como verla: «N nuevas» se reinicia. Solo la
  // primera página y solo la membresía propia (markCommunitySeen no toca otras).
  if (viewer && community && !parsed.data.cursor) {
    const viewerId = viewer.userId;
    after(() => markCommunitySeen(viewerId, community.id));
  }
  return Response.json(page, { headers: { "Cache-Control": "private, no-store" } });
}
