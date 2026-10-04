"use client";

import { Copy, MessageCircle, Share2 } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { revokeLookAction, shareLookAction, type ShareLookState } from "../share-actions";
import type { TryOnResultDTO } from "../service";

type ExistingShare = { id: string; message: string; recipient: string; expiresAt: string };

export function ShareLookButton({
  result,
  shares = [],
}: {
  result: TryOnResultDTO;
  shares?: ExistingShare[];
}) {
  const fieldId = useId();
  const [state, action, pending] = useActionState<ShareLookState, FormData>(shareLookAction, {});
  const [message, setMessage] = useState("¿Me lo compras, amor? ❤️");
  const [recipient, setRecipient] = useState("");
  const [copied, setCopied] = useState<string | undefined>();
  const [removed, setRemoved] = useState<string[]>([]);
  const [removing, startRemoving] = useTransition();
  const [removeError, setRemoveError] = useState("");
  if (result.status !== "READY" || !result.image || new Date(result.expiresAt) <= new Date())
    return null;
  const visibleShares = shares.filter((share) => !removed.includes(share.id));

  async function copy() {
    try {
      await navigator.clipboard.writeText(state.url!);
      setCopied(state.url);
    } catch {
      setRemoveError("Selecciona el enlace y cópialo para compartirlo.");
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <Share2 className="size-4" />
        Compartir mi look
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Un look, una indirecta ❤️</DialogTitle>
          <DialogDescription>
            Comparte cómo te queda y deja que esa persona te lo regale.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="resultId" value={result.id} />
          <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
            <Image
              src={result.image.url}
              width={80}
              height={104}
              alt="El resultado que vas a compartir"
              className="h-26 w-20 shrink-0 rounded-xl object-cover"
            />
            <p className="text-sm leading-relaxed">{message || "Tu look y tu mensaje"}</p>
          </div>
          <label
            className="flex flex-col gap-1.5 text-sm font-medium"
            htmlFor={`${fieldId}-message`}
          >
            Tu mensaje
            <textarea
              id={`${fieldId}-message`}
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={240}
              rows={2}
              required
              className="resize-none rounded-xl border bg-background p-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-right text-xs font-normal text-muted-foreground">
              {message.length}/240
            </span>
          </label>
          {result.products.map((product) => (
            <label key={product.id} className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                {product.title} · {formatMoney(product.priceCents, product.currency)}
              </span>
              <input
                name={`size:${product.id}`}
                maxLength={40}
                placeholder="Talla que quieres (opcional), ej. M o 24"
                className="rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          ))}
          <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <input name="consent" type="checkbox" required className="mt-0.5 size-4 shrink-0" />
            <span>
              Acepto compartir esta simulación. En el chat solo la verá esa persona; con un enlace
              podrá verla quien lo reciba. Vence en un máximo de 7 días y puedo desactivarlo.
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Enviar por speeaking
            <input
              name="recipient"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              maxLength={40}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="@nombredeusuario"
              className="rounded-xl border bg-background px-3 py-2.5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button name="channel" value="chat" type="submit" disabled={pending || !recipient.trim()}>
            <MessageCircle className="size-4" />
            {pending ? "Preparando…" : "Enviar al chat"}
          </Button>
          <Button name="channel" value="link" type="submit" variant="outline" disabled={pending}>
            <Share2 className="size-4" />
            Crear enlace para WhatsApp
          </Button>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p role="status" className="text-sm text-primary-text">
              {state.ok}
            </p>
          ) : null}
          {state.conversationPath ? (
            <Link
              href={state.conversationPath as Route}
              className="text-sm font-semibold text-primary-text underline"
            >
              Abrir conversación
            </Link>
          ) : null}
          {state.url ? (
            <div className="flex flex-col gap-2 rounded-2xl border p-3">
              <input
                aria-label="Enlace para compartir tu look"
                value={state.url}
                readOnly
                onFocus={(event) => event.target.select()}
                className="w-full rounded-lg bg-muted p-2 text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <a
                  href={state.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
                >
                  Abrir WhatsApp
                </a>
                <Button type="button" variant="outline" onClick={copy}>
                  <Copy className="size-4" />
                  {copied === state.url ? "Copiado" : "Copiar enlace"}
                </Button>
              </div>
            </div>
          ) : null}
        </form>
        {visibleShares.length ? (
          <section className="border-t pt-3">
            <h3 className="mb-2 text-sm font-semibold">Looks que estás compartiendo</h3>
            <ul className="flex flex-col gap-2">
              {visibleShares.map((share) => (
                <li key={share.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0">
                    <span className="block font-semibold">{share.recipient}</span>
                    <span className="line-clamp-1 text-muted-foreground">{share.message}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={removing}
                    onClick={() =>
                      startRemoving(async () => {
                        try {
                          const outcome = await revokeLookAction(share.id);
                          if (outcome.error) setRemoveError(outcome.error);
                          else setRemoved((current) => [...current, share.id]);
                        } catch {
                          setRemoveError("No se pudo desactivar. Intenta de nuevo.");
                        }
                      })
                    }
                  >
                    Desactivar
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {removeError ? (
          <p role="alert" className="text-sm text-destructive">
            {removeError}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
