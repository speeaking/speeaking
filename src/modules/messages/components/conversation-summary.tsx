import { UserAvatar } from "@/components/brand/user-avatar";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversationSummaryDTO } from "../service";

/**
 * Lo que se ve de una conversación en la bandeja (ADR-047): la otra persona, su último mensaje y
 * si hay algo sin leer. Va dentro de un enlace (/mensajes) o de un botón (el recuadro, ADR-068).
 */
export function ConversationSummary({
  conversation,
  avatarClassName = "size-11",
}: {
  conversation: ConversationSummaryDTO;
  avatarClassName?: string;
}) {
  const { other, lastMessage, unread } = conversation;
  return (
    <>
      <UserAvatar
        name={other.displayName}
        seed={other.username || other.displayName}
        src={other.avatarUrl}
        className={avatarClassName}
      />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate", unread ? "font-extrabold" : "font-semibold")}>
            {other.displayName}
          </span>
          {lastMessage ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(new Date(lastMessage.at))}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "truncate text-sm",
            unread ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {lastMessage
            ? `${lastMessage.mine ? "Tú: " : ""}${lastMessage.body}`
            : "Sin mensajes todavía"}
        </span>
      </span>
      {unread ? (
        <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label="Sin leer" />
      ) : null}
    </>
  );
}
