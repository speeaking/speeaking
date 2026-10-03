"use client";

import { useState } from "react";
import {
  MessageCircle,
  Package,
  Tag,
  Truck,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/brand/user-avatar";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RemoveContentButton } from "@/modules/identity/components/remove-content-button";
import { reactionMeta, type ReactionKind } from "@/modules/social/reactions";
import { type NotificationItem, type NotificationKind, notificationSentence } from "../group";

/** Ícono de cada tipo de aviso (las reacciones llevan su emoji). */
const ICONS: Record<Exclude<NotificationKind, "REACTION">, LucideIcon> = {
  COMMENT: MessageCircle,
  FOLLOW: UserPlus,
  ORDER_PAID: Package,
  ORDER_SHIPPED: Truck,
  ORDER_DELIVERED: Package,
  ORDER_CANCELLED: XCircle,
  PRODUCT_TAGGED: Tag,
  PRODUCT_TAG_REMOVED: Tag,
};

function Badge({ item }: { item: NotificationItem }) {
  if (item.type === "REACTION") {
    return (
      <span className="absolute -right-1 -bottom-1 flex rounded-full bg-card px-0.5 text-sm leading-none ring-2 ring-card">
        {item.reactions.map((kind) => reactionMeta(kind as ReactionKind).emoji).join("")}
      </span>
    );
  }
  const Icon = ICONS[item.type];
  return (
    <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
      <Icon aria-hidden="true" className="size-3.5" />
    </span>
  );
}

function Row({ item, allowRemoval }: { item: NotificationItem; allowRemoval: boolean }) {
  const [removed, setRemoved] = useState(false);
  const { who, what } = notificationSentence(item);
  const first = item.actors[0];
  const quote = item.type === "COMMENT" ? item.commentExcerpt : item.postExcerpt;
  if (removed) return null;
  return (
    <li className="flex items-start gap-1">
      <Link
        href={item.href as Route}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-secondary",
          item.unread && "bg-accent/40",
        )}
      >
        <span aria-hidden="true" className="relative shrink-0">
          {first ? (
            <UserAvatar
              name={first.displayName}
              seed={first.username}
              src={first.avatarUrl}
              className="size-12"
            />
          ) : (
            <span className="grid size-12 place-items-center rounded-full bg-secondary">
              <Package className="size-5 text-muted-foreground" />
            </span>
          )}
          <Badge item={item} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] leading-snug">
            {who ? <strong className="font-semibold">{who}</strong> : null} {what}
            {item.orderTitle ? (
              <span className="text-muted-foreground">: {item.orderTitle}</span>
            ) : null}
          </span>
          {quote ? (
            <span className="line-clamp-1 text-sm text-muted-foreground">«{quote}»</span>
          ) : null}
          <time dateTime={item.at.toISOString()} className="text-xs text-muted-foreground">
            {formatRelativeTime(item.at)}
          </time>
        </span>
        {item.unread ? (
          <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary">
            <span className="sr-only">Nuevo</span>
          </span>
        ) : null}
      </Link>
      {allowRemoval && item.ids?.length ? (
        <RemoveContentButton
          kind="notification"
          id={item.ids}
          compact
          label="Eliminar aviso"
          onRemoved={() => setRemoved(true)}
        />
      ) : null}
    </li>
  );
}

/**
 * La campana (ADR-059): primero lo nuevo, luego lo anterior. Cada aviso agrupado dice quién, qué y
 * de qué, y lleva a donde pasó (la publicación, el panel de comentarios, el perfil o el pedido).
 * `idPrefix` distingue sus títulos si la página y el recuadro de la barra (ADR-068) están a la vez.
 */
export function NotificationList({
  items,
  idPrefix = "avisos",
  allowRemoval = true,
}: {
  items: readonly NotificationItem[];
  idPrefix?: string;
  allowRemoval?: boolean;
}) {
  const fresh = items.filter((item) => item.unread);
  const earlier = items.filter((item) => !item.unread);
  return (
    <div className="flex flex-col gap-4">
      {fresh.length > 0 ? (
        <section aria-labelledby={`${idPrefix}-nuevos`} className="flex flex-col gap-1">
          <h2 id={`${idPrefix}-nuevos`} className="px-3 font-heading text-base font-bold">
            Nuevos
          </h2>
          <ul className="flex flex-col">
            {fresh.map((item) => (
              <Row key={item.key} item={item} allowRemoval={allowRemoval} />
            ))}
          </ul>
        </section>
      ) : null}
      {earlier.length > 0 ? (
        <section aria-labelledby={`${idPrefix}-anteriores`} className="flex flex-col gap-1">
          <h2 id={`${idPrefix}-anteriores`} className="px-3 font-heading text-base font-bold">
            Anteriores
          </h2>
          <ul className="flex flex-col">
            {earlier.map((item) => (
              <Row key={item.key} item={item} allowRemoval={allowRemoval} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
