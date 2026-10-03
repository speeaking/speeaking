"use client";

import Link from "next/link";
import { type ReactElement, useRef, useState } from "react";
import {
  InboxLoading,
  inboxLinkClass,
  InboxNotice,
  InboxSurface,
} from "@/components/layout/inbox-surface";
import { Button } from "@/components/ui/button";
import { loadNotificationsAction, markNotificationsReadAction } from "../actions";
import type { NotificationItem } from "../group";
import { NotificationList } from "./notification-list";

type Load =
  { status: "loading" } | { status: "error" } | { status: "ready"; items: NotificationItem[] };

/**
 * La campana en un recuadro (ADR-068): los avisos se ven ahí mismo, sin salir de la página, y
 * quedan leídos (el globo se apaga), igual que en /avisos. Cada aviso lleva a donde pasó.
 */
export function NotificationsPanel({
  trigger,
  onSeen,
}: {
  trigger: ReactElement;
  /** Ya se marcaron como leídos: la barra apaga su globo. */
  onSeen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  /** Cada apertura es un intento; lo que llegue de uno viejo se ignora. */
  const attempt = useRef(0);

  const fetchItems = async () => {
    const current = ++attempt.current;
    setLoad({ status: "loading" });
    try {
      const items = (await loadNotificationsAction()) ?? [];
      if (current !== attempt.current) return;
      setLoad({ status: "ready", items });
      if (items.some((item) => item.unread)) {
        await markNotificationsReadAction();
        onSeen();
      }
    } catch (error) {
      console.error("[avisos] no se pudieron cargar", error);
      if (current === attempt.current) setLoad({ status: "error" });
    }
  };

  return (
    <InboxSurface
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void fetchItems();
      }}
      trigger={trigger}
      title="Avisos"
      actions={
        <Link href="/avisos" className={inboxLinkClass}>
          Ver todos
        </Link>
      }
    >
      {load.status === "loading" ? (
        <InboxLoading label="Cargando avisos" />
      ) : load.status === "error" ? (
        <InboxNotice
          action={
            <Button variant="outline" onClick={() => void fetchItems()}>
              Reintentar
            </Button>
          }
        >
          No pudimos cargar tus avisos.
        </InboxNotice>
      ) : load.items.length === 0 ? (
        <InboxNotice>
          Todavía no tienes avisos. Aquí verás quién reacciona, comenta o empieza a seguirte, y cómo
          van tus pedidos.
        </InboxNotice>
      ) : (
        <div className="p-1.5">
          <NotificationList items={load.items} idPrefix="recuadro-avisos" allowRemoval={false} />
        </div>
      )}
    </InboxSurface>
  );
}
