import { getSession } from "@/modules/identity/session";
import { getSharedLookImage } from "@/modules/tryon/shared-look";
import { getStorage } from "@/server/providers/storage";

export async function GET(request: Request, context: RouteContext<"/api/looks/[id]/imagen">) {
  const { id } = await context.params;
  const viewerId = (await getSession())?.user.id ?? null;
  const token = new URL(request.url).searchParams.get("clave") ?? undefined;
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noimageindex",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  const media = await getSharedLookImage(id, viewerId, token);
  if (!media) return new Response("No encontrado", { status: 404, headers });
  const file = await getStorage().get(media.storageKey);
  if (!file) return new Response("No encontrado", { status: 404, headers });
  return new Response(new Uint8Array(file.data), {
    headers: { ...headers, "Content-Type": media.mimeType },
  });
}
