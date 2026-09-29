"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/modules/media/components/image-uploader";
import { registerTryOnPhotoAction, type TryOnFormState } from "../actions";
import { TRY_ON_CONSENT_TEXT, TRY_ON_RETENTION_DAYS } from "../consent";

/**
 * Subir la foto de la persona con el consentimiento explícito (ADR-045). La foto pasa por
 * /api/uploads (validación y sin metadatos) y luego se registra como foto de Pruébatelo.
 */
export function PhotoRegisterForm({ compact = false }: { compact?: boolean }) {
  const [state, formAction, pending] = useActionState<TryOnFormState, FormData>(
    registerTryOnPhotoAction,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{compact ? "Sube otra foto" : "Sube tu foto"}</p>
        <p className="text-xs text-muted-foreground">
          De frente, con buena luz y de cuerpo completo si vas a probarte pantalón o vestido. Solo
          tú la ves; se borra a los {TRY_ON_RETENTION_DAYS} días.
        </p>
      </div>
      <ImageUploader name="mediaId" max={1} />
      <label className="flex items-start gap-2 text-xs leading-snug">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0" />
        <span>{TRY_ON_CONSENT_TEXT}</span>
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
        Guardar foto
      </Button>
    </form>
  );
}
