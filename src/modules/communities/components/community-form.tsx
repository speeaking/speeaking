"use client";

import { useActionState, useState } from "react";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCommunityAction, editCommunityAction } from "../actions";
import {
  COMMUNITY_EMOJIS,
  COMMUNITY_HUES,
  type CommunityDetails,
  type CommunityFormState,
} from "../schemas";

export function CommunityForm({
  initial,
}: {
  initial?: Omit<CommunityDetails, "emoji"> & { id: string; emoji: string };
}) {
  const [state, action, pending] = useActionState<CommunityFormState, FormData>(
    initial ? editCommunityAction : createCommunityAction,
    {},
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "💬");
  const [hue, setHue] = useState(initial?.hue ?? 285);
  const errors = (field: string) => state.fieldErrors?.[field]?.[0];
  return (
    <form action={action} className="flex flex-col gap-5 rounded-3xl border bg-card p-4 sm:p-6">
      {initial ? <input type="hidden" name="communityId" value={initial.id} /> : null}
      <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-4">
        <CommunityAvatar
          name={name || "Tu comunidad"}
          emoji={emoji}
          hue={hue}
          size="lg"
          decorative
        />
        <div className="min-w-0">
          <p className="text-lg font-bold break-words">{name || "Tu nueva comunidad"}</p>
          <p className="text-sm text-muted-foreground">Un lugar para conversar y compartir</p>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="community-name" className="text-sm font-semibold">
          Nombre de la comunidad
        </label>
        <Input
          id="community-name"
          name="name"
          required
          minLength={3}
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Por ejemplo: Moda con estilo CDMX"
          aria-invalid={Boolean(errors("name"))}
          aria-describedby={errors("name") ? "community-name-error" : undefined}
          className="min-h-11"
        />
        {errors("name") ? (
          <p id="community-name-error" className="text-sm text-destructive">
            {errors("name")}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label htmlFor="community-description" className="text-sm font-semibold">
          ¿De qué trata?
        </label>
        <textarea
          id="community-description"
          name="description"
          required
          minLength={10}
          maxLength={500}
          rows={4}
          defaultValue={initial?.description}
          placeholder="Cuenta qué podrán compartir y conversar aquí."
          aria-invalid={Boolean(errors("description"))}
          aria-describedby="community-description-help"
          className="w-full resize-y rounded-xl border bg-background px-3 py-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
        />
        <p
          id="community-description-help"
          className={
            errors("description") ? "text-sm text-destructive" : "text-xs text-muted-foreground"
          }
        >
          {errors("description") ||
            "Hasta 500 caracteres. Elige un nombre y una descripción propios."}
        </p>
      </div>
      <fieldset disabled={pending} className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Icono del grupo</legend>
        <div className="flex flex-wrap gap-2">
          {COMMUNITY_EMOJIS.map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="emoji"
                value={value}
                checked={emoji === value}
                onChange={() => setEmoji(value)}
                className="peer sr-only"
                aria-label={`Icono ${value}`}
              />
              <span className="grid size-11 place-items-center rounded-xl border text-xl peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-3 peer-focus-visible:ring-ring">
                {value}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={pending} className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Color</legend>
        <div className="flex gap-2">
          {COMMUNITY_HUES.map((value, index) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="hue"
                value={value}
                checked={hue === value}
                onChange={() => setHue(value)}
                className="peer sr-only"
                aria-label={["Morado", "Azul", "Verde", "Naranja", "Rosa"][index]}
              />
              <span className="grid size-11 place-items-center rounded-full border peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring">
                <span
                  style={{ backgroundColor: `hsl(${value} 65% 50%)` }}
                  className="size-7 rounded-full"
                />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {!initial ? (
        <p className="rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
          Serás el propietario. Podrás invitar y retirar miembros, nombrar administradores y
          transferir la comunidad. Las publicaciones personales mantienen la privacidad entre
          amigos.
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm font-medium text-primary-text">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11 rounded-xl">
        {pending ? "Guardando…" : initial ? "Guardar cambios" : "Crear mi comunidad"}
      </Button>
    </form>
  );
}
