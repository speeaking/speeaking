"use client";

import { useState } from "react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RemoveContentButton } from "@/modules/identity/components/remove-content-button";
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
  allowRemoval = true,
}: {
  messages: readonly MessageDTO[];
  className?: string;
  allowRemoval?: boolean;
}) {
  const [removed, setRemoved] = useState<string[]>([]);
  const visibleMessages = messages.filter((message) => !removed.includes(message.id));
  return (
    <ol aria-label="Mensajes" className={cn("flex flex-col gap-2", className)}>
      {visibleMessages.length === 0 ? (
        <li className="py-8 text-center text-sm text-muted-foreground">
          Aquí empieza su conversación. Solo ustedes dos la ven.
        </li>
      ) : (
        visibleMessages.map((message) => (
          <li
            key={message.id}
            className={cn("flex max-w-[85%] flex-col", message.mine ? "self-end" : "self-start")}
          >
            {message.look ? (
              <Link
                href={`/look/${message.look.id}` as Route}
                className="mb-1 overflow-hidden rounded-2xl border bg-card text-card-foreground"
              >
                <Image
                  src={message.look.image.url}
                  width={message.look.image.width}
                  height={message.look.image.height}
                  unoptimized
                  alt="Look compartido"
                  className="max-h-72 w-full bg-muted object-contain"
                />
                <div className="flex flex-col gap-1.5 p-3 text-sm">
                  <span className="font-semibold">
                    {message.look.mine
                      ? "Tu look compartido"
                      : `El look de ${message.look.owner.name}`}
                  </span>
                  {message.look.products.map((product) => (
                    <span key={product.id} className="text-xs text-muted-foreground">
                      {product.title}
                      {product.size ? ` · talla ${product.size}` : ""} ·{" "}
                      {formatMoney(product.priceCents, product.currency)}
                    </span>
                  ))}
                  <span className="font-semibold text-primary-text">
                    Ver look y {message.mine ? "comprar" : "regalar 🎁"}
                  </span>
                </div>
              </Link>
            ) : message.look === null ? (
              <p className="mb-1 rounded-2xl border bg-muted px-3 py-2 text-xs text-muted-foreground">
                Este look ya no está disponible.
              </p>
            ) : null}
            <p
              className={cn(
                "rounded-2xl px-3.5 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap",
                message.mine ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border",
              )}
            >
              {message.body}
            </p>
            <div className={cn("flex items-center gap-1", message.mine && "self-end")}>
              <time
                dateTime={message.at}
                className={cn(
                  "mt-0.5 text-[11px] text-muted-foreground",
                  message.mine && "self-end",
                )}
              >
                {timeFormat.format(new Date(message.at))}
              </time>
              {message.mine && allowRemoval ? (
                <RemoveContentButton
                  kind="message"
                  id={message.id}
                  compact
                  label="Eliminar mi mensaje"
                  description="Tu mensaje se eliminará de esta conversación para ambas personas."
                  onRemoved={() => setRemoved((current) => [...current, message.id])}
                />
              ) : null}
            </div>
          </li>
        ))
      )}
    </ol>
  );
}
