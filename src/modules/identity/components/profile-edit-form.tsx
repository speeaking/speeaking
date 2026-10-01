"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type ProfileEditState, updateProfileAction } from "../profile-actions";
import { PROFILE_BIO_MAX, PROFILE_CITY_MAX } from "../profile-edit-schema";
import { ProfileImagePicker } from "./profile-image-picker";

export type ProfileEditDefaults = {
  username: string;
  displayName: string;
  city: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  initials: string;
  hue: number;
};

/**
 * Editar perfil (ADR-058): foto, portada, nombre visible, ciudad y presentación. El usuario
 * (@nombre) no cambia aquí: es la dirección del perfil y de los enlaces compartidos.
 */
export function ProfileEditForm({ defaults }: { defaults: ProfileEditDefaults }) {
  const [state, formAction, pending] = useActionState<ProfileEditState, FormData>(
    updateProfileAction,
    {},
  );
  const [bio, setBio] = useState(defaults.bio ?? "");
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <ProfileImagePicker
        name="cover"
        label="Portada"
        shape="wide"
        initialUrl={defaults.coverUrl}
        fallback="Sin portada propia usamos tu foto más reciente."
        hue={defaults.hue}
        error={errors.cover}
      />
      <ProfileImagePicker
        name="avatar"
        label="Foto de perfil"
        shape="circle"
        initialUrl={defaults.avatarUrl}
        fallback={defaults.initials}
        hue={defaults.hue}
        error={errors.avatar}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className="text-sm font-semibold">
          Nombre
        </label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={defaults.displayName}
          maxLength={50}
          required
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={errors.displayName ? "displayName-error" : undefined}
        />
        {errors.displayName ? (
          <p id="displayName-error" className="text-sm text-destructive">
            {errors.displayName}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Tu usuario sigue siendo @{defaults.username}.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="city" className="text-sm font-semibold">
          Ciudad <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <Input
          id="city"
          name="city"
          defaultValue={defaults.city ?? ""}
          maxLength={PROFILE_CITY_MAX}
          autoComplete="address-level2"
          aria-invalid={errors.city ? true : undefined}
        />
        {errors.city ? <p className="text-sm text-destructive">{errors.city}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-sm font-semibold">
          Presentación <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <Textarea
          id="bio"
          name="bio"
          rows={3}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={PROFILE_BIO_MAX}
          placeholder="Cuéntale a la comunidad quién eres o qué vendes."
          className="text-base"
          aria-invalid={errors.bio ? true : undefined}
          aria-describedby="bio-count"
        />
        <p id="bio-count" className="self-end text-xs text-muted-foreground tabular-nums">
          {bio.length}/{PROFILE_BIO_MAX}
        </p>
        {errors.bio ? <p className="text-sm text-destructive">{errors.bio}</p> : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={`/u/${defaults.username}`} className={buttonVariants({ variant: "ghost" })}>
          Cancelar
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
