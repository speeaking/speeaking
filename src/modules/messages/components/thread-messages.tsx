import { cn } from "@/lib/utils";
import type { MessageDTO } from "../service";

const timeFormat = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

/**
 * Los mensajes de un hilo (ADR-047): lo tuyo a la derecha en rosa, lo de la otra persona a la
 * izquierda. Lo usan /mensajes/[id] y el recuadro de la barra (ADR-068).
 */
export function ThreadMessages({
  messages,
  className,
}: {
  messages: readonly MessageDTO[];
  className?: string;
}) {
  return (
    <ol aria-label="Mensajes" className={cn("flex flex-col gap-2", className)}>
      {messages.length === 0 ? (
        <li className="py-8 text-center text-sm text-muted-foreground">
          Aquí empieza su conversación. Solo ustedes dos la ven.
        </li>
      ) : (
        messages.map((message) => (
          <li
            key={message.id}
            className={cn("flex max-w-[85%] flex-col", message.mine ? "self-end" : "self-start")}
          >
            <p
              className={cn(
                "rounded-2xl px-3.5 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap",
                message.mine ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border",
              )}
            >
              {message.body}
            </p>
            <time
              dateTime={message.at}
              className={cn("mt-0.5 text-[11px] text-muted-foreground", message.mine && "self-end")}
            >
              {timeFormat.format(new Date(message.at))}
            </time>
          </li>
        ))
      )}
    </ol>
  );
}
