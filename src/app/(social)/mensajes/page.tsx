import { MessageCircle } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/brand/user-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { listConversations } from "@/modules/messages/service";

export const metadata: Metadata = { title: "Mensajes", robots: { index: false } };

/** Bandeja de mensajes privados (ADR-047): solo lo tuyo, la conversación más reciente arriba. */
export default async function MessagesPage({ searchParams }: PageProps<"/mensajes">) {
  const viewer = await requireOnboardedViewer("/mensajes");
  const { error } = await searchParams;
  const conversations = await listConversations(viewer.userId);

  return (
    <>
      <PageHeader
        title="Mensajes"
        description="Solo tú y la otra persona ven lo que se escriben."
      />
      <div className="flex flex-col gap-3 px-4 md:px-0">
        {typeof error === "string" && error ? (
          <p
            role="alert"
            className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        {conversations.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Aún no tienes mensajes"
            description="Escríbele a alguien desde su perfil o pregúntale a una tienda desde un producto."
            action={
              <Link href="/descubrir" className={buttonVariants({ variant: "outline" })}>
                Descubrir gente
              </Link>
            }
          />
        ) : (
          <ul
            className="flex flex-col divide-y rounded-3xl border bg-card"
            aria-label="Conversaciones"
          >
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/mensajes/${conversation.id}` as Route}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary"
                >
                  <UserAvatar
                    name={conversation.other.displayName}
                    seed={conversation.other.username || conversation.other.displayName}
                    src={conversation.other.avatarUrl}
                    className="size-11"
                  />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "truncate",
                          conversation.unread ? "font-extrabold" : "font-semibold",
                        )}
                      >
                        {conversation.other.displayName}
                      </span>
                      {conversation.lastMessage ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(new Date(conversation.lastMessage.at))}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "truncate text-sm",
                        conversation.unread
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {conversation.lastMessage
                        ? `${conversation.lastMessage.mine ? "Tú: " : ""}${conversation.lastMessage.body}`
                        : "Sin mensajes todavía"}
                    </span>
                  </span>
                  {conversation.unread ? (
                    <span
                      className="size-2.5 shrink-0 rounded-full bg-primary"
                      aria-label="Sin leer"
                    />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
