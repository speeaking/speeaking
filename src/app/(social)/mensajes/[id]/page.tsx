import { ChevronLeft } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserAvatar } from "@/components/brand/user-avatar";
import { PROFILE_TRANSITION } from "@/lib/page-turn";
import { cn } from "@/lib/utils";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { MessageForm } from "@/modules/messages/components/message-form";
import { ThreadRefresh } from "@/modules/messages/components/thread-refresh";
import { MAX_MESSAGE_LENGTH } from "@/modules/messages/pair";
import { getThread } from "@/modules/messages/service";
import { ReportButton } from "@/modules/trust/components/report-button";

export const metadata: Metadata = { title: "Conversación", robots: { index: false } };

const timeFormat = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

/** Un hilo (ADR-047): solo sus dos personas; abrirlo lo marca como leído. */
export default async function ConversationPage({
  params,
  searchParams,
}: PageProps<"/mensajes/[id]">) {
  const { id } = await params;
  const { texto } = await searchParams;
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
          className="grid size-11 place-items-center rounded-full hover:bg-secondary"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <Link
          href={(thread.other.username ? `/u/${thread.other.username}` : "/mensajes") as Route}
          transitionTypes={PROFILE_TRANSITION}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <UserAvatar
            name={thread.other.displayName}
            seed={thread.other.username || thread.other.displayName}
            src={thread.other.avatarUrl}
            className="size-9"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <h1 className="truncate text-base font-extrabold">{thread.other.displayName}</h1>
            {thread.other.username ? (
              <span className="truncate text-xs text-muted-foreground">
                @{thread.other.username}
              </span>
            ) : null}
          </span>
        </Link>
        <ReportButton
          targetType="USER"
          targetId={thread.other.userId}
          isSignedIn
          returnTo={`/mensajes/${thread.id}`}
        />
      </header>

      <ol
        aria-label="Mensajes"
        className="flex flex-1 flex-col gap-2 bg-background px-3 py-4 md:border-x md:px-4"
      >
        {thread.messages.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted-foreground">
            Aquí empieza su conversación. Solo ustedes dos la ven.
          </li>
        ) : (
          thread.messages.map((message) => (
            <li
              key={message.id}
              className={cn("flex max-w-[85%] flex-col", message.mine ? "self-end" : "self-start")}
            >
              <p
                className={cn(
                  "rounded-2xl px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap",
                  message.mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-card ring-1 ring-border",
                )}
              >
                {message.body}
              </p>
              <time
                dateTime={message.at}
                className={cn(
                  "mt-0.5 text-[11px] text-muted-foreground",
                  message.mine && "self-end",
                )}
              >
                {timeFormat.format(new Date(message.at))}
              </time>
            </li>
          ))
        )}
      </ol>

      <div className="sticky bottom-16 border-t bg-card px-3 py-3 md:static md:rounded-b-3xl md:border md:px-4">
        <MessageForm conversationId={thread.id} initialText={initialText} />
        <p className="mt-2 text-xs text-muted-foreground">
          Los pagos van dentro del pedido, nunca a una cuenta escrita en un mensaje. Si alguien te
          molesta, repórtalo con el botón de arriba.
        </p>
      </div>
    </div>
  );
}
