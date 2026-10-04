"use client";

import { Gift, Heart } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { buySharedLookAction, respondToLookAction, type ShareLookState } from "../share-actions";

export function SharedLookActions({
  id,
  token,
  mine,
  canBuy,
  approved,
}: {
  id: string;
  token?: string;
  mine: boolean;
  canBuy: boolean;
  approved: boolean;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ShareLookState>({});
  function act(buy: boolean) {
    start(async () => {
      if (buy) {
        setState(await buySharedLookAction(id, token));
        return;
      }
      setState(await respondToLookAction(id, token));
    });
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          disabled={pending || !canBuy}
          onClick={() => act(true)}
          className="flex-1"
        >
          <Gift className="size-4" />
          {pending ? "Un momento…" : mine ? "Comprar mi look" : "Comprártelo 🎁"}
        </Button>
        {!mine ? (
          <Button
            size="lg"
            variant="outline"
            disabled={pending || approved || Boolean(state.ok)}
            onClick={() => act(false)}
            className="flex-1"
          >
            <Heart className="size-4" />
            {approved || state.ok ? "Ya respondieron ❤️" : "Sí, amor ❤️"}
          </Button>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {mine
          ? "Revisa el precio y la entrega antes de pagar."
          : "Al comprar eliges quién recibe y su dirección. «Sí, amor» envía un mensaje y no realiza ningún cobro."}
      </p>
      {!canBuy ? (
        <p className="text-sm text-muted-foreground">
          Alguna prenda ya no está disponible. Puedes revisar sus fichas.
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}{" "}
          <Link href="/carrito" className="underline">
            Ver carrito
          </Link>
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
          Abrir chat
        </Link>
      ) : null}
    </div>
  );
}
