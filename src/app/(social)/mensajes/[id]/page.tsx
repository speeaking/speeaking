import { ChevronLeft } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { BlockedNotice, ConversationMenu } from "@/modules/messages/components/conversation-menu";
import { MessageForm } from "@/modules/messages/components/message-form";
import { ThreadMessages } from "@/modules/messages/components/thread-messages";
import { ThreadRefresh } from "@/modules/messages/components/thread-refresh";
import { MAX_MESSAGE_LENGTH } from "@/modules/messages/pair";
import { getThread } from "@/modules/messages/service";

export const metadata: Metadata = { title: "Conversación", robots: { index: false } };

/**
 * Un hilo (ADR-047): solo sus dos personas; abrirlo lo marca como leído. Tocar a la persona abre sus
 * opciones: ver perfil, bloquear sus mensajes y reportarla (ADR-069; `?reportar=1` abre el reporte).
 */
export default async function ConversationPage({
  params,
  searchParams,
}: PageProps<"/mensajes/[id]">) {
  const { id } = await params;
  const { texto, reportar } = await searchParams;
  const viewer = await requireOnboardedViewer(`/mensajes/${id}`);
  const thread = await getThread(viewer.userId, id);
  if (!thread) notFound();
  const initialText = typeof texto === "string" ? texto.slice(0, MAX_MESSAGE_LENGTH) : "";

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col md:min-h-0">
      <ThreadRefresh />
      <header className="flex items-center gap-2 border-b bg-card px-2 py-2 md:rounded-t-3xl md:border md:px-3">
        <Link
          href={"/mensajes" as Route}
          aria-label="Volver a mensajes"
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-secondary"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="sr-only">{thread.other.displayName}</h1>
        <div className="flex min-w-0 flex-1 text-base font-extrabold">
          <ConversationMenu
            conversationId={thread.id}
            other={thread.other}
            blocked={thread.blocked}
            reportOnOpen={reportar === "1"}
          />
        </div>
      </header>

      <ThreadMessages
        messages={thread.messages}
        className="flex-1 bg-background px-3 py-4 md:border-x md:px-4"
      />

      <div className="sticky bottom-16 border-t bg-card px-3 py-3 md:static md:rounded-b-3xl md:border md:px-4">
        {thread.blocked ? (
          <BlockedNotice
            conversationId={thread.id}
            name={thread.other.displayName}
            blocked={thread.blocked}
          />
        ) : (
          <>
            <MessageForm conversationId={thread.id} initialText={initialText} />
            <p className="mt-2 text-xs text-muted-foreground">
              Los pagos van dentro del pedido, nunca a una cuenta escrita en un mensaje. Si alguien
              te molesta, toca su nombre para bloquear sus mensajes o reportarla.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
