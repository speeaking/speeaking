"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { topUpAction, type BillingFormState } from "../actions";
import { FEATURED_DAY_PRICE_CENTS, type TopUpPack, tryOnsAffordable } from "../pricing";

/**
 * Recargas de saldo de la tienda (simuladas en esta etapa): un botón por recarga; la acción
 * principal es la de en medio («Impulso»). Cada una dice qué compra al precio de hoy.
 */
export function TopUpForm({
  packs,
  tryOnPriceCents,
}: {
  packs: readonly TopUpPack[];
  tryOnPriceCents: number;
}) {
  const [state, formAction, pending] = useActionState<BillingFormState, FormData>(topUpAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <ul className="grid gap-2 sm:grid-cols-3">
        {packs.map((pack, index) => {
          const total = pack.amountCents + pack.bonusCents;
          return (
            <li key={pack.id} className="flex flex-col gap-1 rounded-2xl border p-3">
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {pack.name}
              </p>
              <p className="font-heading text-xl font-extrabold tabular-nums">
                {formatMoney(pack.amountCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {pack.bonusCents > 0 ? `+ ${formatMoney(pack.bonusCents)} de regalo · ` : ""}≈{" "}
                {tryOnsAffordable(total, tryOnPriceCents)} pruebas o{" "}
                {Math.floor(total / FEATURED_DAY_PRICE_CENTS)} días destacado
              </p>
              <Button
                type="submit"
                name="packId"
                value={pack.id}
                variant={index === 1 ? "default" : "outline"}
                disabled={pending}
                className="mt-1"
              >
                Recargar
              </Button>
            </li>
          );
        })}
      </ul>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success">
          {state.ok}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Etapa de prueba: las recargas son simuladas y no se cobra nada. El saldo no es dinero ni se
        transfiere; sirve para usos dentro de la plataforma.
      </p>
    </form>
  );
}
