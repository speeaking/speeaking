"use client";

import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/states/empty-state";
import { cn } from "@/lib/utils";
import { markNotificationsReadAction } from "../actions";
import type { NotificationItem } from "../group";
import { NotificationList } from "./notification-list";

const filters = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Nuevas" },
  { value: "comments", label: "Comentarios" },
  { value: "reactions", label: "Reacciones" },
  { value: "tags", label: "Etiquetas" },
  { value: "friends", label: "Amistad" },
  { value: "orders", label: "Pedidos" },
] as const;
type Filter = (typeof filters)[number]["value"];

function matches(item: NotificationItem, filter: Filter) {
  if (filter === "unread") return item.unread;
  if (filter === "comments") return item.type === "COMMENT";
  if (filter === "reactions") return item.type === "REACTION";
  if (filter === "tags")
    return ["MENTION", "PRODUCT_TAGGED", "PRODUCT_TAG_REMOVED"].includes(item.type);
  if (filter === "friends")
    return ["FRIEND_REQUEST", "FRIEND_ACCEPTED", "FOLLOW"].includes(item.type);
  if (filter === "orders") return item.type.startsWith("ORDER_");
  return true;
}

/** Conserva las nuevas hasta que la persona abra un aviso o decida marcar todos como leídos. */
export function NotificationCenter({ items }: { items: readonly NotificationItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const shown = items.filter((item) => matches(item, filter));
  const unread = items.filter((item) => item.unread).length;

  const markAll = () => {
    setError(null);
    startTransition(async () => {
      try {
        await markNotificationsReadAction();
        router.refresh();
      } catch {
        setError("No pudimos marcar tus notificaciones. Intenta de nuevo.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 px-4 md:px-0">
        <p className="text-sm text-muted-foreground">
          {unread
            ? `${unread} ${unread === 1 ? "notificación nueva" : "notificaciones nuevas"}`
            : "Estás al día"}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Actualizar notificaciones"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="size-4" />
          </Button>
          {unread ? (
            <Button
              variant="ghost"
              className="min-h-11 gap-1.5 px-2 text-xs"
              disabled={pending}
              onClick={markAll}
            >
              <CheckCheck className="size-4" />
              {pending ? "Marcando…" : "Marcar leídas"}
            </Button>
          ) : null}
        </div>
      </div>
      <div
        role="group"
        aria-label="Filtrar notificaciones"
        className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-1 md:px-0"
      >
        {filters.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
              filter === value
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:bg-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="px-4 text-sm text-destructive md:px-0">
          {error}
        </p>
      ) : null}
      {shown.length ? (
        <div className="px-1 md:px-0">
          <NotificationList items={shown} />
        </div>
      ) : (
        <div className="px-4 md:px-0">
          <EmptyState
            icon={Bell}
            title={
              items.length ? "No hay notificaciones en este filtro" : "Aquí comienza tu actividad"
            }
            description={
              items.length
                ? "Prueba otra categoría para ver el resto de tu actividad."
                : "Aquí verás quién comenta, reacciona, te menciona o solicita tu amistad, las etiquetas de productos y los cambios de tus pedidos."
            }
          />
        </div>
      )}
    </div>
  );
}
