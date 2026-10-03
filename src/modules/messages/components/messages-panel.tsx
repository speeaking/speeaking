"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/brand/user-avatar";
import {
  inboxIconClass,
  inboxLinkClass,
  InboxLoading,
  InboxNotice,
  InboxSurface,
} from "@/components/layout/inbox-surface";
import { Button } from "@/components/ui/button";
import { useWideScreen } from "@/lib/use-wide-screen";
import { loadInboxAction, loadThreadAction } from "../actions";
import type { ConversationSummaryDTO, ThreadDTO } from "../service";
import { BlockedNotice, ConversationMenu } from "./conversation-menu";
import { ConversationSummary } from "./conversation-summary";
import { MessageForm } from "./message-form";
import { ThreadMessages } from "./thread-messages";

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };
type View = { name: "list" } | { name: "thread"; conversation: ConversationSummaryDTO };

/** Como /mensajes/[id] (ADR-047): mientras el hilo está a la vista, se vuelve a pedir cada 10 s. */
const REFRESH_MS = 10_000;

/**
 * Mensajes en un recuadro (ADR-068): la bandeja se ve ahí mismo y, al tocar una conversación, el
 * hilo se abre en el mismo recuadro, con su campo para escribir. Abrir un hilo lo marca como leído
 * (el globo de la barra baja). Tocar a la persona abre sus opciones (ADR-069). La página /mensajes
 * sigue para verlo todo.
 */
export function MessagesPanel({
  trigger,
  onRead,
}: {
  trigger: ReactElement;
  /** Se leyó una conversación que tenía mensajes nuevos: la barra baja su globo. */
  onRead: () => void;
}) {
  const wide = useWideScreen();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ name: "list" });
  const [inbox, setInbox] = useState<Load<ConversationSummaryDTO[]>>({ status: "loading" });
  const [thread, setThread] = useState<Load<ThreadDTO | null>>({ status: "loading" });
  /** Lo último que se pidió de cada cosa; lo que llegue de un pedido viejo se ignora. */
  const inboxAttempt = useRef(0);
  const threadAttempt = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchInbox = useCallback(async () => {
    const current = ++inboxAttempt.current;
    setInbox({ status: "loading" });
    try {
      const data = (await loadInboxAction()) ?? [];
      if (current === inboxAttempt.current) setInbox({ status: "ready", data });
    } catch (error) {
      console.error("[mensajes] no se pudo cargar la bandeja", error);
      if (current === inboxAttempt.current) setInbox({ status: "error" });
    }
  }, []);

  /** `quiet`: al refrescar no se muestra «cargando» ni se pierde lo que ya se ve. */
  const fetchThread = useCallback(async (id: string, quiet = false) => {
    const current = ++threadAttempt.current;
    if (!quiet) setThread({ status: "loading" });
    try {
      const data = await loadThreadAction(id);
      if (current === threadAttempt.current) setThread({ status: "ready", data });
    } catch (error) {
      console.error("[mensajes] no se pudo cargar el hilo", error);
      if (current === threadAttempt.current && !quiet) setThread({ status: "error" });
    }
  }, []);

  const openThread = (conversation: ConversationSummaryDTO) => {
    setView({ name: "thread", conversation });
    void fetchThread(conversation.id);
    if (!conversation.unread) return;
    onRead();
    setInbox((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            data: current.data.map((item) =>
              item.id === conversation.id ? { ...item, unread: false } : item,
            ),
          }
        : current,
    );
  };

  const backToList = () => {
    threadAttempt.current += 1;
    setView({ name: "list" });
    void fetchInbox();
  };

  const threadId = open && view.name === "thread" ? view.conversation.id : null;

  // Lo que escribió la otra persona llega solo mientras el hilo está abierto y la pestaña a la vista.
  useEffect(() => {
    if (!threadId) return;
    const tick = () => {
      if (document.visibilityState === "visible") void fetchThread(threadId, true);
    };
    const timer = window.setInterval(tick, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [threadId, fetchThread]);

  // Lo más reciente, a la vista (abajo), al abrir el hilo y con cada mensaje nuevo.
  const messageCount =
    thread.status === "ready" && thread.data ? thread.data.messages.length : null;
  useEffect(() => {
    if (messageCount !== null) endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messageCount]);

  const ready = thread.status === "ready" && thread.data ? thread.data : null;

  return (
    <InboxSurface
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) return;
        setView({ name: "list" });
        void fetchInbox();
      }}
      trigger={trigger}
      leading={
        view.name === "thread" ? (
          <button
            type="button"
            onClick={backToList}
            aria-label="Volver a mensajes"
            className={inboxIconClass}
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
        ) : null
      }
      title={view.name === "list" ? "Mensajes" : view.conversation.other.displayName}
      titleContent={
        view.name === "list" ? undefined : ready ? (
          <ConversationMenu
            conversationId={ready.id}
            other={ready.other}
            blocked={ready.blocked}
            inPanel
            onChanged={() => void fetchThread(ready.id, true)}
          />
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar
              name={view.conversation.other.displayName}
              seed={view.conversation.other.username || view.conversation.other.displayName}
              src={view.conversation.other.avatarUrl}
              className="size-8 shrink-0"
            />
            <span className="truncate">{view.conversation.other.displayName}</span>
          </span>
        )
      }
      actions={
        view.name === "list" ? (
          <Link href="/mensajes" className={inboxLinkClass}>
            Ver todo
          </Link>
        ) : null
      }
      footer={
        view.name === "thread" && ready ? (
          ready.blocked ? (
            <BlockedNotice
              conversationId={ready.id}
              name={ready.other.displayName}
              blocked={ready.blocked}
              onChanged={() => void fetchThread(ready.id, true)}
            />
          ) : (
            <MessageForm
              key={ready.id}
              conversationId={ready.id}
              onSent={() => void fetchThread(ready.id, true)}
              autoFocus={wide === true}
            />
          )
        ) : null
      }
    >
      {view.name === "list" ? (
        inbox.status === "loading" ? (
          <InboxLoading label="Cargando mensajes" />
        ) : inbox.status === "error" ? (
          <InboxNotice
            action={
              <Button variant="outline" onClick={() => void fetchInbox()}>
                Reintentar
              </Button>
            }
          >
            No pudimos cargar tus mensajes.
          </InboxNotice>
        ) : inbox.data.length === 0 ? (
          <InboxNotice>
            Aún no tienes mensajes. Escríbele a alguien desde su perfil o pregúntale a una tienda
            desde un producto.
          </InboxNotice>
        ) : (
          <ul aria-label="Conversaciones" className="flex flex-col p-1.5">
            {inbox.data.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => openThread(conversation)}
                  className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-secondary focus-visible:outline-3 focus-visible:outline-ring"
                >
                  <ConversationSummary conversation={conversation} />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : thread.status === "loading" ? (
        <InboxLoading label="Cargando la conversación" />
      ) : thread.status === "error" ? (
        <InboxNotice
          action={
            <Button variant="outline" onClick={() => void fetchThread(view.conversation.id)}>
              Reintentar
            </Button>
          }
        >
          No pudimos cargar la conversación.
        </InboxNotice>
      ) : ready ? (
        <div className="flex min-h-full flex-col justify-end bg-background px-3 py-3">
          <ThreadMessages messages={ready.messages} allowRemoval={false} />
          <div ref={endRef} />
        </div>
      ) : (
        <InboxNotice>Esta conversación ya no está disponible.</InboxNotice>
      )}
    </InboxSurface>
  );
}
