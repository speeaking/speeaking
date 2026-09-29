"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { setSponsorAction, type BillingFormState } from "../actions";
import { MIN_SPONSOR_DAILY_CAP_CENTS } from "../pricing";

/** «Pruebas gratis en mis productos»: interruptor y tope diario en pesos (ADR-044). */
export function SponsorForm({
  enabled,
  dailyCapCents,
  priceCents,
}: {
  enabled: boolean;
  dailyCapCents: number;
  priceCents: number;
}) {
  const [state, formAction, pending] = useActionState<BillingFormState, FormData>(
    setSponsorAction,
    {},
  );
  const [on, setOn] = useState(enabled);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          <span className="font-semibold">Pruebas gratis en mis productos.</span> Quien vea uno de
          tus productos se lo prueba sin gastar sus pruebas ni su saldo; tú pagas cada prueba a
          precio comunitario ({formatMoney(priceCents)} hoy) desde tu saldo.
        </span>
      </label>
      <label className="flex max-w-xs flex-col gap-1 text-sm">
        <span className="font-medium">Tope diario (MXN)</span>
        <Input
          name="dailyCap"
          inputMode="decimal"
          defaultValue={
            dailyCapCents > 0
              ? String(dailyCapCents / 100)
              : String(MIN_SPONSOR_DAILY_CAP_CENTS / 100)
          }
          disabled={!on}
          className="h-10"
        />
        <span className="text-xs text-muted-foreground">
          Mínimo {formatMoney(MIN_SPONSOR_DAILY_CAP_CENTS)}. Al llegar al tope, las pruebas de ese
          día vuelven a las gratis o al saldo de cada persona.
        </span>
      </label>
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
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        Guardar
      </Button>
    </form>
  );
}
