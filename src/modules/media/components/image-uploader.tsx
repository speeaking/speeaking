"use client";

import { ChevronLeft, ChevronRight, ImagePlus, Loader, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Uploaded = { id: string; url: string; width: number; height: number };
type Slot = { key: string; preview: string; uploaded?: Uploaded; failed?: boolean };

/** Igual que `MAX_UPLOAD_BYTES` del servidor: un archivo más pesado ni se manda. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TOO_LARGE = "La imagen pesa más de 10 MB.";

/**
 * Mensaje cuando la respuesta no trae el suyo: un 413 que corta la conexión (SEC-03) o que manda el
 * proxy puede llegar sin cuerpo JSON.
 */
function uploadErrorMessage(status: number) {
  if (status === 413) return TOO_LARGE;
  if (status === 429) return "Subiste muchas imágenes seguidas. Intenta en unos minutos.";
  if (status === 503) return "Hay muchas subidas en este momento. Intenta en unos segundos.";
  return "No pudimos subir la imagen.";
}

/** Botón sobre la miniatura: se ve de 32 px y su área táctil llega a 44 px. */
const tileButton =
  "absolute grid size-8 place-items-center rounded-full bg-foreground/80 text-background outline-none after:absolute after:-inset-1.5 focus-visible:ring-3 focus-visible:ring-ring";

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/**
 * Selector de imágenes: sube cada archivo a /api/uploads (el servidor valida, re-codifica y
 * elimina metadatos) y agrega un campo oculto `name` por imagen lista, en el orden en que se ven
 * (la primera es la portada). Las flechas cambian el orden; funcionan con toque y con teclado.
 */
export function ImageUploader({
  name,
  max,
  initial = [],
}: {
  name: string;
  max: number;
  /** Imágenes ya subidas (p. ej. la foto que se usó en Vende con IA o las de un producto). */
  initial?: Uploaded[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /**
   * Botón que recibe el foco después de mover o quitar una foto (el que se usó puede desaparecer
   * y el foco no debe perderse en la página).
   */
  const focusAfter = useRef<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>(() =>
    initial.map((media) => ({ key: media.id, preview: media.url, uploaded: media })),
  );
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const selector = focusAfter.current;
    if (!selector) return;
    focusAfter.current = null;
    gridRef.current?.querySelector<HTMLButtonElement>(selector)?.focus();
  }, [slots]);

  const upload = async (slot: Slot, file: File) => {
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/uploads", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as
        (Uploaded & { error?: string }) | null;
      if (!response.ok || !data) {
        throw new Error(data?.error ?? uploadErrorMessage(response.status));
      }
      setSlots((current) =>
        current.map((item) => (item.key === slot.key ? { ...item, uploaded: data } : item)),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos subir la imagen.");
      setSlots((current) =>
        current.map((item) => (item.key === slot.key ? { ...item, failed: true } : item)),
      );
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const room = max - slots.length;
    // Una imagen de más de 10 MB se rechaza aquí: el servidor corta la conexión sin leerla.
    const light = [...files].filter((file) => file.size <= MAX_FILE_BYTES);
    if (light.length < files.length) {
      toast.error(files.length === 1 ? TOO_LARGE : "Algunas imágenes pesan más de 10 MB.");
    }
    const accepted = light.slice(0, room);
    if (light.length > room) toast(`Puedes agregar hasta ${max} imágenes.`);
    const created = accepted.map((file) => ({
      key: crypto.randomUUID(),
      preview: URL.createObjectURL(file),
      file,
    }));
    setSlots((current) => [...current, ...created.map(({ key, preview }) => ({ key, preview }))]);
    for (const { key, preview, file } of created) void upload({ key, preview }, file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (index: number) => {
    const slot = slots[index];
    if (!slot) return;
    if (slot.preview.startsWith("blob:")) URL.revokeObjectURL(slot.preview);
    setSlots((current) => current.filter((item) => item.key !== slot.key));
    // El foco pasa a la foto que ocupa su lugar (o a la anterior); sin fotos, a "Agregar".
    const neighbor = slots[index + 1] ?? slots[index - 1];
    focusAfter.current = neighbor ? `[data-remove="${neighbor.key}"]` : "[data-add]";
    setAnnouncement(`Foto ${index + 1} quitada.`);
  };

  const move = (index: number, step: -1 | 1) => {
    const slot = slots[index];
    const to = index + step;
    if (!slot || to < 0 || to >= slots.length) return;
    setSlots((current) => moveItem(current, index, to));
    // En un extremo ya no hay flecha hacia ese lado: el foco pasa a la del lado contrario.
    const atEdge = to === 0 || to === slots.length - 1;
    focusAfter.current = `[data-move="${slot.key}:${atEdge ? -step : step}"]`;
    setAnnouncement(
      to === 0 ? "Foto movida al inicio: ahora es la portada." : `Foto movida al lugar ${to + 1}.`,
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div ref={gridRef} className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2">
        {slots.map((slot, index) => (
          <div
            key={slot.key}
            // El formulario no se envía mientras haya una foto subiéndose (se perdería).
            data-uploading={!slot.uploaded && !slot.failed ? "" : undefined}
            className="relative aspect-square overflow-hidden rounded-2xl border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
            <img src={slot.preview} alt="" className="size-full object-cover" />
            {!slot.uploaded && !slot.failed ? (
              <span className="absolute inset-0 grid place-items-center bg-background/60">
                <Loader className="size-5 animate-spin" aria-label="Subiendo" />
              </span>
            ) : null}
            {slot.failed ? (
              <span className="absolute inset-0 grid place-items-center bg-background/80 text-xs font-bold text-destructive">
                Error
              </span>
            ) : null}
            {slot.uploaded ? <input type="hidden" name={name} value={slot.uploaded.id} /> : null}
            {index === 0 && max > 1 ? (
              <span className="absolute top-1.5 left-1.5 rounded-full bg-background/90 px-1.5 text-[11px] leading-5 font-semibold text-foreground">
                Portada
              </span>
            ) : null}
            <button
              type="button"
              data-remove={slot.key}
              onClick={() => remove(index)}
              aria-label={`Quitar foto ${index + 1}`}
              className={`${tileButton} top-1.5 right-1.5`}
            >
              <X className="size-4" />
            </button>
            {index > 0 ? (
              <button
                type="button"
                data-move={`${slot.key}:-1`}
                onClick={() => move(index, -1)}
                aria-label={`Mover foto ${index + 1} a la izquierda`}
                className={`${tileButton} bottom-1.5 left-1.5`}
              >
                <ChevronLeft className="size-4" />
              </button>
            ) : null}
            {index < slots.length - 1 ? (
              <button
                type="button"
                data-move={`${slot.key}:1`}
                onClick={() => move(index, 1)}
                aria-label={`Mover foto ${index + 1} a la derecha`}
                className={`${tileButton} right-1.5 bottom-1.5`}
              >
                <ChevronRight className="size-4" />
              </button>
            ) : null}
          </div>
        ))}
        {slots.length < max ? (
          <button
            type="button"
            data-add
            onClick={() => inputRef.current?.click()}
            className="grid aspect-square place-items-center rounded-2xl border border-dashed text-muted-foreground transition-colors hover:bg-secondary"
          >
            <span className="flex flex-col items-center gap-1 text-xs font-medium">
              <ImagePlus className="size-6" />
              Agregar
            </span>
          </button>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Elegir imágenes"
        onChange={(event) => onFiles(event.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        Hasta {max} imágenes de 10 MB. Borramos la ubicación y otros datos ocultos de tus fotos.
      </p>
    </div>
  );
}
