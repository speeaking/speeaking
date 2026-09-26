import { notFound } from "next/navigation";
import { z } from "zod";
import { getAdminViewer } from "@/modules/admin/guard";
import { AdminAuthorizationError } from "@/modules/admin/service";
import { checkTrustLimit } from "@/modules/trust/limits";
import { getProofFileForAdmin } from "@/modules/trust/service";

/**
 * Foto de un comprobante de autenticidad, SOLO para ADMIN (P14). Las pruebas no se adjuntan a
 * ningún producto, así que `/media` solo se las sirve a su dueño; el equipo las ve por aquí. A
 * cualquier otra persona (y con un id inválido o una foto que no es comprobante) le responde con
 * `notFound()`: el mismo 404 para todos esos casos, así que no revela si la foto existe. En un route
 * handler, Next lo responde SIN cuerpo (distinto de la página HTML de una URL que no existe): la
 * ruta en sí se puede adivinar, la foto no. Sin caché.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/admin/moderacion/prueba/[mediaId]">,
) {
  const { mediaId } = await context.params;
  const admin = await getAdminViewer();
  if (!admin || !z.uuid().safeParse(mediaId).success) notFound();
  if (await checkTrustLimit("proofImage", admin.userId)) {
    return new Response("Demasiadas solicitudes", {
      status: 429,
      headers: { "Cache-Control": "no-store" },
    });
  }
  let file: Awaited<ReturnType<typeof getProofFileForAdmin>>;
  try {
    file = await getProofFileForAdmin(admin.userId, mediaId);
  } catch (error) {
    // Le quitaron el rol entre la sesión y la consulta: igual que a cualquier otra persona.
    if (error instanceof AdminAuthorizationError) notFound();
    throw error;
  }
  if (!file) notFound();
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
