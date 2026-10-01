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

function Row({ item }: { item: NotificationItem }) {
  const { who, what } = notificationSentence(item);
  const first = item.actors[0];
  const quote = item.type === "COMMENT" ? item.commentExcerpt : item.postExcerpt;
  return (
    <li>
      <Link
        href={item.href as Route}
        className={cn(
          "flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-secondary",
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
    </li>
  );
}

/**
 * La campana (ADR-059): primero lo nuevo, luego lo anterior. Cada aviso agrupado dice quién, qué y
 * de qué, y lleva a donde pasó (la publicación, el panel de comentarios, el perfil o el pedido).
 */
export function NotificationList({ items }: { items: readonly NotificationItem[] }) {
  const fresh = items.filter((item) => item.unread);
  const earlier = items.filter((item) => !item.unread);
  return (
    <div className="flex flex-col gap-4">
      {fresh.length > 0 ? (
        <section aria-labelledby="avisos-nuevos" className="flex flex-col gap-1">
          <h2 id="avisos-nuevos" className="px-3 font-heading text-base font-bold">
            Nuevos
          </h2>
          <ul className="flex flex-col">
            {fresh.map((item) => (
              <Row key={item.key} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
      {earlier.length > 0 ? (
        <section aria-labelledby="avisos-anteriores" className="flex flex-col gap-1">
          <h2 id="avisos-anteriores" className="px-3 font-heading text-base font-bold">
            Anteriores
          </h2>
          <ul className="flex flex-col">
            {earlier.map((item) => (
              <Row key={item.key} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
