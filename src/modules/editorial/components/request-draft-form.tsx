"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DeskFormState, requestDraftAction } from "../actions";
import { TOPIC_MAX_CHARS } from "../brief";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring";

/**
 * Pedir un borrador más a la redacción (ADR-066): para una comunidad y, si se quiere, sobre un tema
 * propio (algo que está pasando hoy). El tema es un dato para la IA; el borrador se revisa igual.
 */
export function RequestDraftForm({
  communities,
  disabled = false,
}: {
  communities: { id: string; name: string; emoji: string }[];
  disabled?: boolean;
}) {
  const id = useId();
  const [topic, setTopic] = useState("");
  const [state, formAction, pending] = useActionState<DeskFormState, FormData>(
    async (previous, formData) => {
      const result = await requestDraftAction(previous, formData);
      if (result.ok) setTopic("");
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-comunidad`} className="text-sm font-medium">
            Comunidad
          </label>
          <select id={`${id}-comunidad`} name="communityId" required className={selectClass}>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.emoji} {community.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-tema`} className="text-sm font-medium">
            Tema (opcional)
          </label>
          <Input
            id={`${id}-tema`}
            name="topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            maxLength={TOPIC_MAX_CHARS}
            placeholder="Ej.: empezó el frío, ¿qué se antoja?"
            className="h-11"
            aria-describedby={`${id}-tema-ayuda`}
          />
        </div>
      </div>
      <p id={`${id}-tema-ayuda`} className="text-xs text-muted-foreground">
        Sin tema, la redacción elige una pregunta o un consejo. Si escribes una noticia, que sea
        algo que tú ya comprobaste: la IA no verifica hechos.
      </p>
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
      <Button
        type="submit"
        variant="outline"
        className="h-11 self-start px-4"
        disabled={pending || disabled}
      >
        {pending ? "Redactando…" : "Pedir borrador"}
      </Button>
    </form>
  );
}
