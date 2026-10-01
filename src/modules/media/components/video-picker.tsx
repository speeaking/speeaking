"use client";

import { Clapperboard, Loader, Play, RotateCcw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { prepareImageUpload, shrinkImage } from "@/lib/upload-image";
import { finishVideoUploadAction, startVideoUploadAction } from "../video-actions";
import {
  formatDuration,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_MS,
  POSTER_DIMENSION,
} from "../video-rules";

type Phase =
  | { step: "empty" }
  | { step: "working"; label: string; progress: number | null; poster: string | null }
  | { step: "ready"; videoId: string; poster: string | null; durationMs: number }
  | { step: "error"; message: string };

/** Lo que el navegador sabe del video antes de subirlo (para avisar; el servidor decide). */
type LocalFacts = { durationMs: number | null; poster: Blob | null };

function waitFor(target: HTMLMediaElement, event: string, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => done(new Error("timeout")), timeoutMs);
    const onEvent = () => done();
    const onError = () => done(new Error("error"));
    function done(error?: Error) {
      window.clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
      if (error) reject(error);
      else resolve();
    }
    target.addEventListener(event, onEvent);
    target.addEventListener("error", onError);
  });
}

/**
 * Duración y portada (un cuadro cerca del primer segundo, en JPEG de ≤ 1080 px). Si el navegador no
 * puede abrir el video (un HEVC en Firefox), se sube igual sin portada y el servidor lo revisa.
 */
async function readLocalVideo(file: File): Promise<LocalFacts> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await waitFor(video, "loadedmetadata", 15_000);
    const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null;
    let poster: Blob | null = null;
    try {
      video.currentTime = Math.min(1, video.duration / 3);
      await waitFor(video, "seeked", 8_000);
      const canvas = document.createElement("canvas");
      const scale = Math.min(
        1,
        POSTER_DIMENSION / Math.max(video.videoWidth || 1, video.videoHeight || 1),
      );
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      poster = frame
        ? ((await shrinkImage(frame, { maxDimension: POSTER_DIMENSION, quality: 0.85 })) ?? frame)
        : null;
    } catch {
      poster = null;
    }
    return { durationMs, poster };
  } catch {
    return { durationMs: null, poster: null };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** Sube la portada como una foto más (`/api/uploads`); sin portada, el video se publica igual. */
async function uploadPoster(poster: Blob | null): Promise<string | null> {
  if (!poster) return null;
  const prepared = await prepareImageUpload(
    new File([poster], "portada.jpg", { type: "image/jpeg" }),
  );
  if (!prepared.ok) return null;
  const body = new FormData();
  body.append("file", prepared.file, "portada.jpg");
  try {
    const response = await fetch("/api/uploads", { method: "POST", body });
    const data = (await response.json().catch(() => null)) as { id?: string } | null;
    return response.ok && data?.id ? data.id : null;
  } catch {
    return null;
  }
}

/** Tipo del archivo: algunos Android no lo dicen para un `.mov`. */
function videoType(file: File) {
  if (file.type) return file.type;
  return /\.mov$/i.test(file.name) ? "video/quicktime" : "video/mp4";
}

/**
 * Elegir un video corto para una publicación (ADR-062): revisa duración y peso en el navegador, toma
 * una portada, sube el archivo directo al almacenamiento (con progreso) y el servidor revisa su
 * estructura antes de dejarlo listo. Agrega el campo oculto `videoId` cuando está listo.
 */
export function VideoPicker({ name }: { name: string }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  /** Cada elección (o «Cancelar») abre un intento nuevo: lo que llegue de uno viejo se ignora. */
  const attempt = useRef(0);
  const [phase, setPhase] = useState<Phase>({ step: "empty" });
  const posterUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      request.current?.abort();
      if (posterUrl.current) URL.revokeObjectURL(posterUrl.current);
    },
    [],
  );

  const reset = () => {
    attempt.current += 1;
    request.current?.abort();
    request.current = null;
    if (posterUrl.current) URL.revokeObjectURL(posterUrl.current);
    posterUrl.current = null;
    setPhase({ step: "empty" });
  };

  const fail = (message: string) => {
    request.current = null;
    setPhase({ step: "error", message });
  };

  const onFile = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    attempt.current += 1;
    const current = attempt.current;
    const stale = () => attempt.current !== current;
    if (file.size > MAX_VIDEO_BYTES) return fail("El video pesa más de 50 MB.");
    setPhase({ step: "working", label: "Preparando el video…", progress: null, poster: null });

    const local = await readLocalVideo(file);
    if (stale()) return;
    if (local.durationMs !== null && local.durationMs > MAX_VIDEO_DURATION_MS) {
      return fail("El video dura más de 60 segundos. Recórtalo e inténtalo de nuevo.");
    }
    if (posterUrl.current) URL.revokeObjectURL(posterUrl.current);
    posterUrl.current = local.poster ? URL.createObjectURL(local.poster) : null;
    const poster = posterUrl.current;
    setPhase({ step: "working", label: "Preparando el video…", progress: null, poster });

    const posterId = await uploadPoster(local.poster);
    if (stale()) return;
    const started = await startVideoUploadAction({
      sizeBytes: file.size,
      contentType: videoType(file),
      posterId,
    }).catch(() => ({
      ok: false as const,
      error: "No pudimos empezar la subida. Intenta de nuevo.",
    }));
    if (stale()) return;
    if (!started.ok) return fail(started.error);

    // El archivo va directo al almacenamiento (nunca pasa por la app), con su progreso.
    const uploaded = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      request.current = xhr;
      xhr.open("PUT", started.upload.url);
      for (const [header, value] of Object.entries(started.upload.headers)) {
        xhr.setRequestHeader(header, value);
      }
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || stale()) return;
        setPhase({
          step: "working",
          label: "Subiendo el video…",
          progress: Math.round((event.loaded / event.total) * 100),
          poster,
        });
      };
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.onabort = () => resolve(false);
      xhr.send(file);
    });
    if (stale()) return; // Se canceló.
    request.current = null;
    if (!uploaded) return fail("No pudimos subir el video. Revisa tu conexión e intenta de nuevo.");

    setPhase({ step: "working", label: "Revisando el video…", progress: null, poster });
    const finished = await finishVideoUploadAction(started.mediaId).catch(() => ({
      ok: false as const,
      error: "No pudimos revisar el video. Intenta de nuevo.",
    }));
    if (stale()) return;
    if (!finished.ok) return fail(finished.error);
    setPhase({
      step: "ready",
      videoId: finished.video.id,
      poster,
      durationMs: finished.video.durationMs,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
        aria-label="Elegir video"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      {phase.step === "empty" || phase.step === "error" ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-6 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-secondary">
            <Clapperboard aria-hidden="true" className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Agrega un video corto</p>
            <p className="text-xs text-muted-foreground">
              Hasta 60 segundos y 50 MB, en MP4 o MOV. En el feed empieza sin sonido.
            </p>
          </div>
          {phase.step === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {phase.message}
            </p>
          ) : null}
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            {phase.step === "error" ? (
              <RotateCcw data-icon="inline-start" />
            ) : (
              <Clapperboard data-icon="inline-start" />
            )}
            {phase.step === "error" ? "Elegir otro video" : "Elegir video"}
          </Button>
        </div>
      ) : (
        <div
          className="relative grid aspect-video place-items-center overflow-hidden rounded-2xl bg-foreground"
          data-uploading={phase.step === "working" ? "" : undefined}
        >
          {phase.poster ? (
            // Portada local (blob:), solo para la vista previa.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={phase.poster} alt="" className="absolute inset-0 size-full object-contain" />
          ) : null}
          {phase.step === "working" ? (
            <div className="relative flex w-3/4 flex-col items-center gap-2 rounded-2xl bg-background/90 px-4 py-3 text-center">
              <p role="status" className="flex items-center gap-2 text-sm font-semibold">
                <Loader aria-hidden="true" className="size-4 animate-spin" />
                {phase.label}
                {phase.progress !== null ? ` ${phase.progress}%` : ""}
              </p>
              {phase.progress !== null ? (
                <div
                  role="progressbar"
                  aria-label="Avance de la subida"
                  aria-valuenow={phase.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
                >
                  <div
                    className="h-full rounded-full bg-foreground transition-[width]"
                    style={{ width: `${phase.progress}%` }}
                  />
                </div>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                Cancelar
              </Button>
            </div>
          ) : (
            <>
              <span className="relative grid size-14 place-items-center rounded-full bg-background/90">
                <Play aria-hidden="true" className="size-6 translate-x-px" />
              </span>
              <span className="absolute bottom-2 left-2 rounded-full bg-foreground/80 px-2 py-0.5 text-xs font-semibold text-background tabular-nums">
                {formatDuration(phase.durationMs)}
              </span>
              <button
                type="button"
                onClick={reset}
                aria-label="Quitar video"
                className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-foreground/80 text-background outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
              <input type="hidden" name={name} value={phase.videoId} />
              <p role="status" className="sr-only">
                Video listo para publicar.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
