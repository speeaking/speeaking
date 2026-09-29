"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { featureProductAction, type BillingFormState } from "../actions";
import { FEATURED_DAY_PRICE_CENTS, featuredCostCents } from "../pricing";

const OPTIONS = [3, 7, 14, 30] as const;

/** «Destacar» un producto N días desde el saldo de la tienda (ADR-046). */
export function FeatureForm({
  productId,
  title,
  balanceCents,
}: {
  productId: string;
  title: string;
  balanceCents: number;
}) {
  const [state, formAction, pending] = useActionState<BillingFormState, FormData>(
    featureProductAction,
    {},
  );
  const [days, setDays] = useState<number>(7);
  const cost = featuredCostCents(days) ?? 0;
  const short = cost > balanceCents;
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="productId" value={productId} />
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">Días</span>
        <select
          name="days"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="h-9 rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring"
        >
          {OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} días · {formatMoney(option * FEATURED_DAY_PRICE_CENTS)}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending || short}>
        {pending ? "Destacando…" : `Destacar por ${formatMoney(cost)}`}
        <span className="sr-only"> {title}</span>
      </Button>
      {short ? (
        <span className="text-xs text-muted-foreground">Te falta saldo para esos días.</span>
      ) : null}
      {state.error ? (
        <p role="alert" className="w-full text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="w-full text-xs text-success">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
