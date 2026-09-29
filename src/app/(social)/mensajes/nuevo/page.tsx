import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { MAX_MESSAGE_LENGTH } from "@/modules/messages/pair";
import { findRecipient, getOrCreateConversation, MessageError } from "@/modules/messages/service";

export const metadata: Metadata = { title: "Nuevo mensaje", robots: { index: false } };

const ERRORS: Record<string, string> = {
  NOT_FOUND: "No encontramos a esa persona.",
  SELF: "No puedes escribirte a ti misma o mismo.",
  EDITORIAL: "Las cuentas editoriales no reciben mensajes.",
  NOT_ONBOARDED: "Esa persona todavía no termina su perfil.",
};

/**
 * `/mensajes/nuevo?para=usuario&texto=…` (ADR-047): abre (o crea) la conversación con esa persona y
 * lleva al hilo con el texto prellenado. Es una página y no una acción para poder enlazarla desde
 * perfiles y productos, y para que un visitante pase por crear cuenta y vuelva aquí.
 */
export default async function NewMessagePage({ searchParams }: PageProps<"/mensajes/nuevo">) {
  const { para, texto } = await searchParams;
  const username = typeof para === "string" ? para : "";
  const text = typeof texto === "string" ? texto.slice(0, MAX_MESSAGE_LENGTH) : "";
  const viewer = await requireOnboardedViewer(
    `/mensajes/nuevo?${new URLSearchParams({ para: username, ...(text ? { texto: text } : {}) })}`,
  );
  if (!username) redirect("/mensajes");
  let conversationId: string;
  try {
    const recipient = await findRecipient(viewer.userId, username);
    conversationId = (await getOrCreateConversation(viewer.userId, recipient.userId)).id;
  } catch (error) {
    if (error instanceof MessageError) {
      redirect(
        `/mensajes?error=${encodeURIComponent(ERRORS[error.code] ?? "No se pudo abrir la conversación.")}` as Route,
      );
    }
    throw error;
  }
  redirect(
    `/mensajes/${conversationId}${text ? `?texto=${encodeURIComponent(text)}` : ""}` as Route,
  );
}
