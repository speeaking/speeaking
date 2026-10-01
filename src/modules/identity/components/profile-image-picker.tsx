"use client";

import { Camera, Loader, Trash2 } from "lucide-react";
import { type CSSProperties, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Igual que `MAX_UPLOAD_BYTES` del servidor: un archivo más pesado ni se manda. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function uploadErrorMessage(status: number) {
  if (status === 413) return "La imagen pesa más de 10 MB.";
  if (status === 429) return "Subiste muchas imágenes seguidas. Intenta en unos minutos.";
  if (status === 503) return "Hay muchas subidas en este momento. Intenta en unos segundos.";
  return "No pudimos subir la imagen.";
}

/**
 * Foto de perfil o portada (ADR-058): muestra la actual, sube la nueva a /api/uploads (el servidor la
 * valida, la re-codifica y le quita metadatos) y deja en un campo oculto qué hacer al guardar:
 * `keep`, `remove` o el id de la imagen nueva. Nada cambia hasta que se guarda el formulario.
 */
export function ProfileImagePicker({
  name,
  label,
  shape,
  initialUrl,
  fallback,
  hue,
  error,
}: {
  name: "avatar" | "cover";
  label: string;
  shape: "circle" | "wide";
  initialUrl: string | null;
  /** Lo que se ve sin imagen: iniciales (foto) o el aviso de la portada automática. */
  fallback: string;
  /** Tono de la persona para el fondo sin imagen. */
  hue: number;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [value, setValue] = useState("keep");
  const [preview, setPreview] = useState<string | null>(initialUrl);
  /** La última vista previa que corresponde a `value` (a ella se regresa si una subida falla). */
  const confirmed = useRef<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error("La imagen pesa más de 10 MB.");
      return;
    }
    const local = URL.createObjectURL(file);
    setPreview(local);
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/uploads", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (!response.ok || !data?.id) {
        throw new Error(data?.error ?? uploadErrorMessage(response.status));
      }
      setValue(data.id);
      confirmed.current = local;
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "No pudimos subir la imagen.");
      setPreview(confirmed.current);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = () => {
    setValue("remove");
    setPreview(null);
    confirmed.current = null;
  };

  const circle = shape === "circle";
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className={cn("flex gap-3", circle ? "items-center" : "flex-col")}>
        <div
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden avatar-tint bg-secondary",
            circle ? "size-24 rounded-full" : "aspect-[3/1] w-full rounded-2xl",
          )}
          style={{ "--hue": hue } as CSSProperties}
        >
          {preview ? (
            // Vista previa local o URL propia: `img` simple (no hace falta optimizarla).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span
              className={cn(
                "px-4 text-center",
                circle ? "font-heading text-2xl font-bold" : "text-sm text-muted-foreground",
              )}
            >
              {fallback}
            </span>
          )}
          {busy ? (
            <span className="absolute inset-0 grid place-items-center bg-background/60">
              <Loader aria-hidden="true" className="size-6 animate-spin" />
              <span className="sr-only">Subiendo…</span>
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Camera data-icon="inline-start" />
            {preview
              ? `Cambiar ${circle ? "foto" : "portada"}`
              : `Subir ${circle ? "foto" : "portada"}`}
          </Button>
          {preview ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={remove}>
              <Trash2 data-icon="inline-start" />
              Quitar
            </Button>
          ) : null}
        </div>
      </div>
      <label htmlFor={inputId} className="sr-only">
        {label}: elegir imagen
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <input type="hidden" name={name} value={value} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
