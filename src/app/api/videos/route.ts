import { z } from "zod";
import { getViewer } from "@/modules/identity/session";
import { checkSocialLimit } from "@/modules/social/limits";
import { decodeVideoCursor } from "@/modules/social/video-cursor";
import { listVideoPosts } from "@/modules/social/video-queries";

export async function GET(request: Request) {
  const parsed = z
    .object({ cursor: z.string().max(256).optional() })
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (
    !parsed.success ||
    (parsed.data.cursor !== undefined && !decodeVideoCursor(parsed.data.cursor))
  )
    return Response.json({ error: "Cursor inválido." }, { status: 400 });
  const viewer = await getViewer();
  const limited = await checkSocialLimit("feed", viewer?.userId ?? null);
  if (!limited.ok)
    return Response.json(
      { error: limited.error },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  return Response.json(await listVideoPosts(viewer?.userId ?? null, parsed.data.cursor), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
