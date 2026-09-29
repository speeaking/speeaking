"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type FeatureToggleState, setAiFeatureAction } from "../admin-actions";
import type { AiFeatureKey } from "../features";

export type FeatureRow = {
  key: AiFeatureKey;
  label: string;
  description: string;
  phase: number;
  status: "built" | "planned";
  enabled: boolean;
};

/** Una fila por función: encender o apagar con un motivo (queda en la bitácora de decisiones). */
function FeatureToggle({ feature }: { feature: FeatureRow }) {
  const [state, formAction, pending] = useActionState<FeatureToggleState, FormData>(
    setAiFeatureAction,
    {},
  );
  const planned = feature.status === "planned";
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-secondary px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold">
            {feature.label}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              · fase {feature.phase}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">{feature.description}</span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
            planned
              ? "bg-card text-muted-foreground"
              : feature.enabled
                ? "bg-success/10 text-success"
                : "bg-card text-ink-2",
          )}
        >
          {planned ? "Planeada" : feature.enabled ? "Encendida" : "Apagada"}
        </span>
      </div>
      {planned ? null : (
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="key" value={feature.key} />
          <input type="hidden" name="enabled" value={feature.enabled ? "false" : "true"} />
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
            <span className="font-medium" aria-hidden="true">
              Motivo
            </span>
            <input
              name="reason"
              aria-label={`Motivo para ${feature.enabled ? "apagar" : "encender"} ${feature.label}`}
              required
              minLength={10}
              maxLength={300}
              placeholder={feature.enabled ? "Por qué la apagas" : "Por qué la enciendes"}
              className="h-9 rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring"
              aria-invalid={state.error && state.key === feature.key ? true : undefined}
            />
          </label>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {feature.enabled ? "Apagar" : "Encender"}
          </Button>
          {state.key === feature.key && state.error ? (
            <p role="alert" className="w-full text-xs text-destructive">
              {state.error}
            </p>
          ) : null}
          {state.key === feature.key && state.ok ? (
            <p role="status" className="w-full text-xs text-success">
              {state.ok}
            </p>
          ) : null}
        </form>
      )}
    </li>
  );
}

export function FeatureToggles({ features }: { features: FeatureRow[] }) {
  return (
    <ul aria-label="Funciones de IA" className="flex flex-col gap-2">
      {features.map((feature) => (
        <FeatureToggle key={feature.key} feature={feature} />
      ))}
    </ul>
  );
}
