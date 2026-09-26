"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { changeAiRoutingAction, type RoutingFormState } from "../admin-actions";
import type { AdminAiOverview } from "../admin-overview";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive";

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  return errors?.length ? (
    <p id={id} role="alert" className="text-sm text-destructive">
      {errors[0]}
    </p>
  ) : null;
}

/**
 * Cambiar el modelo de una tarea (riesgo medio). Solo se pueden elegir modelos con evaluación
 * aprobada; el motivo queda en la bitácora de decisiones.
 */
export function RoutingForm({ routes }: { routes: AdminAiOverview["routes"] }) {
  const [state, formAction, pending] = useActionState<RoutingFormState, FormData>(
    changeAiRoutingAction,
    {},
  );
  const [task, setTask] = useState(routes[0]?.task ?? "sale_proposal");
  const route = routes.find((item) => item.task === task) ?? routes[0];
  const [choice, setChoice] = useState(route?.current ?? "default");
  const selected = route?.choices.find((option) => option.value === choice);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ruta-tarea" className="text-sm font-medium">
            Tarea
          </label>
          <select
            id="ruta-tarea"
            name="task"
            value={task}
            onChange={(event) => {
              const next = routes.find((item) => item.task === event.target.value);
              setTask(event.target.value as typeof task);
              setChoice(next?.current ?? "default");
            }}
            className={selectClass}
          >
            {routes.map((item) => (
              <option key={item.task} value={item.task}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ruta-modelo" className="text-sm font-medium">
            Modelo
          </label>
          <select
            id="ruta-modelo"
            name="choice"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className={selectClass}
            aria-invalid={errors.choice || selected?.blocked ? true : undefined}
            aria-describedby={
              errors.choice ? "ruta-modelo-ayuda ruta-modelo-error" : "ruta-modelo-ayuda"
            }
          >
            {route?.choices.map((option) => (
              <option key={option.value} value={option.value} disabled={Boolean(option.blocked)}>
                {option.label}
                {option.blocked ? " · sin evaluación aprobada" : ""}
              </option>
            ))}
          </select>
          <p id="ruta-modelo-ayuda" className="text-xs text-muted-foreground">
            {selected?.blocked ??
              "Solo modelos con una evaluación aprobada en los últimos 30 días (el simulado no la necesita)."}
          </p>
          <FieldError id="ruta-modelo-error" errors={errors.choice} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ruta-motivo" className="text-sm font-medium">
          Motivo
        </label>
        <Textarea
          id="ruta-motivo"
          name="reason"
          rows={2}
          maxLength={300}
          placeholder="Por ejemplo: pasó la evaluación y cuesta menos por propuesta."
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={errors.reason ? "ruta-motivo-error" : undefined}
          className="text-base"
        />
        <FieldError id="ruta-motivo-error" errors={errors.reason} />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
          {state.ok}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="h-11 self-start px-4"
        disabled={pending || choice === route?.current}
      >
        {pending ? "Aplicando…" : "Aplicar cambio"}
      </Button>
    </form>
  );
}
