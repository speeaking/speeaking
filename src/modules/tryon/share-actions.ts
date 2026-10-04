"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOnboardedViewer } from "@/modules/identity/session";
import {
  findRecipient,
  getOrCreateConversation,
  MessageError,
  sendMessage,
} from "@/modules/messages/service";
import { env } from "@/server/env";
import { limitOrError, rateLimitMany, rateLimitKey } from "@/server/rate-limit";
import { getTryOnResult } from "./service";
import {
  addSharedLookToCart,
  approveSharedLook,
  createSharedLook,
  getSharedLook,
  revokeSharedLook,
  SharedLookError,
} from "./shared-look";
import { formatMoney } from "@/lib/format";

export type ShareLookState = {
  error?: string;
  ok?: string;
  url?: string;
  whatsappUrl?: string;
  conversationPath?: string;
};
const schema = z.object({
  resultId: z.uuid(),
  message: z.string().trim().min(1).max(240),
  channel: z.enum(["chat", "link"]),
  recipient: z.string().trim().max(40),
  consent: z.literal("on"),
  sizes: z.record(z.uuid(), z.string().trim().max(40)),
});
const requestSchema = z.object({
  id: z.uuid(),
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
});

function failure(error: unknown): ShareLookState {
  if (error instanceof MessageError)
    return {
      error: "No puedes enviarle este look. Revisa el nombre de usuario y si pueden escribirse.",
    };
  if (error instanceof SharedLookError)
    return {
      error:
        error.code === "CART_CONFLICT"
          ? "Ya tienes una de estas prendas en el carrito con otra talla o destinatario. Revísala antes de añadir el regalo."
          : error.code === "ALREADY_APPROVED"
            ? "Este look ya recibió una respuesta."
            : "Este look ya no está disponible para esta acción.",
    };
  throw error;
}

async function limit(userId: string, messages = false) {
  return limitOrError(
    await rateLimitMany([
      { key: rateLimitKey("looks.share", "user", userId), limit: 20, windowSeconds: 3600 },
      ...(messages
        ? [
            { key: rateLimitKey("messages.send", "user", userId), limit: 30, windowSeconds: 600 },
            { key: rateLimitKey("messages.new", "user", userId), limit: 20, windowSeconds: 86400 },
          ]
        : []),
    ]),
  );
}

export async function shareLookAction(
  _previous: ShareLookState,
  formData: FormData,
): Promise<ShareLookState> {
  const sizes = Object.fromEntries(
    [...formData.entries()]
      .filter(([key, value]) => key.startsWith("size:") && typeof value === "string")
      .map(([key, value]) => [key.slice(5), value]),
  );
  const parsed = schema.safeParse({
    resultId: formData.get("resultId"),
    message: formData.get("message"),
    channel: formData.get("channel"),
    recipient: String(formData.get("recipient") ?? "").replace(/^@/, ""),
    consent: formData.get("consent"),
    sizes,
  });
  if (!parsed.success)
    return { error: "Escribe un mensaje corto y acepta compartir esta simulación." };
  const viewer = await requireOnboardedViewer(`/probar/${parsed.data.resultId}`);
  const limited = await limit(viewer.userId, parsed.data.channel === "chat");
  if (limited) return { error: limited };
  let created: { id: string; path: string } | null = null;
  try {
    const recipient =
      parsed.data.channel === "chat"
        ? await findRecipient(viewer.userId, parsed.data.recipient)
        : null;
    created = await createSharedLook(viewer.userId, {
      ...parsed.data,
      recipientId: recipient?.userId ?? null,
    });
    if (recipient) {
      const conversation = await getOrCreateConversation(viewer.userId, recipient.userId);
      await sendMessage(viewer.userId, conversation.id, parsed.data.message, created.id);
      revalidatePath("/mensajes");
      revalidatePath(`/mensajes/${conversation.id}`);
      revalidatePath(`/probar/${parsed.data.resultId}`);
      return {
        ok: "Look enviado. Ya pueden verlo y responder en el chat.",
        conversationPath: `/mensajes/${conversation.id}`,
      };
    }
    const url = new URL(created.path, env.APP_URL).href;
    const result = await getTryOnResult(viewer.userId, parsed.data.resultId);
    const products =
      result?.products
        .map(
          (p) =>
            `${p.title}${parsed.data.sizes[p.id] ? ` · talla ${parsed.data.sizes[p.id]}` : ""} · ${formatMoney(p.priceCents, p.currency)}`,
        )
        .join("\n") ?? "";
    revalidatePath(`/probar/${parsed.data.resultId}`);
    return {
      ok: "Tu enlace está listo.",
      url,
      whatsappUrl: `https://wa.me/?text=${encodeURIComponent(`${parsed.data.message}\n\n${products}\n\n${url}`)}`,
    };
  } catch (error) {
    if (created) await revokeSharedLook(viewer.userId, created.id);
    return failure(error);
  }
}

export async function revokeLookAction(id: string): Promise<ShareLookState> {
  if (!z.uuid().safeParse(id).success) return { error: "Look no encontrado." };
  const viewer = await requireOnboardedViewer("/probar");
  await revokeSharedLook(viewer.userId, id);
  revalidatePath("/probar", "layout");
  revalidatePath(`/look/${id}`);
  revalidatePath("/mensajes", "layout");
  return { ok: "Dejaste de compartir este look." };
}

export async function respondToLookAction(id: string, token?: string): Promise<ShareLookState> {
  const parsed = requestSchema.safeParse({ id, token });
  if (!parsed.success) return { error: "Look no encontrado." };
  const path = `/look/${id}${token ? `?clave=${token}` : ""}`;
  const viewer = await requireOnboardedViewer(path);
  const limited = await limit(viewer.userId, true);
  if (limited) return { error: limited };
  try {
    const look = await getSharedLook(id, viewer.userId, token);
    if (!look || look.mine) return { error: "Este look ya no está disponible para responder." };
    const recipient = await findRecipient(viewer.userId, look.owner.username);
    const conversation = await getOrCreateConversation(viewer.userId, recipient.userId);
    await approveSharedLook(viewer.userId, id, conversation.id, token);
    revalidatePath(`/look/${id}`);
    revalidatePath("/mensajes");
    revalidatePath(`/mensajes/${conversation.id}`);
    return {
      ok: "Le enviamos «Sí, amor ❤️». Puede continuar la compra desde su cuenta.",
      conversationPath: `/mensajes/${conversation.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function buySharedLookAction(id: string, token?: string): Promise<ShareLookState> {
  if (!requestSchema.safeParse({ id, token }).success) return { error: "Look no encontrado." };
  const viewer = await requireOnboardedViewer(`/look/${id}${token ? `?clave=${token}` : ""}`);
  const limited = await limit(viewer.userId);
  if (limited) return { error: limited };
  try {
    await addSharedLookToCart(viewer.userId, id, token);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/carrito");
  revalidatePath("/checkout");
  redirect("/checkout" as Route);
}
