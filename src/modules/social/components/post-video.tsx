"use client";

import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { FEED_FRAME, fitForFrame, frameAspect } from "@/lib/image";
import { cn } from "@/lib/utils";
import type { FeedVideoDTO } from "@/modules/feed/dto";
import { formatDuration } from "@/modules/media/video-rules";

/** El video que se reproduce ahora: al empezar otro, este se pausa (uno a la vez, como Facebook). */
let playingNow: HTMLVideoElement | null = null;

/** Marco de un video en su publicación abierta: de 9:16 (vertical de teléfono) a 16:9. */
const OPEN_FRAME = { min: 9 / 16, max: 16 / 9 } as const;
const HEVC = new Set(["hvc1", "hev1"]);

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

/**
 * ¿Puede empezar solo (sin sonido)? No con ahorro de datos, en una red 2G ni con «reducir
 * movimiento» (P13): ahí se ve la portada y empieza al tocarlo.
 */
export function autoplayAllowed() {
  // Sin estas APIs (navegadores viejos, pruebas), nada empieza solo: se ve la portada.
  if (typeof IntersectionObserver === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && /2g$/.test(connection.effectiveType)) return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Video corto de una publicación (ADR-062). En el feed empieza solo y sin sonido cuando se ve al
 * menos el 60 % (salvo ahorro de datos), se pausa al salir de la pantalla y suena al tocar la
 * bocina; antes de reproducirse solo baja la portada. En la publicación abierta, con los controles
 * del navegador. Un HEVC que este navegador no reproduce muestra la portada con un aviso.
 */
export function PostVideo({
  video,
  label,
  expanded = false,
  reel = false,
  overlay,
  className,
}: {
  video: FeedVideoDTO;
  label: string;
  expanded?: boolean;
  reel?: boolean;
  /** Lo que va encima del video, arriba: el precio y «Ver cómo me veo» del producto (ADR-063). */
  overlay?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [unsupported, setUnsupported] = useState(false);
  const aspect = frameAspect(video, expanded || reel ? OPEN_FRAME : FEED_FRAME);
  const fit = expanded || reel ? "contain" : fitForFrame(video, aspect);
  const poster = video.poster ? `${video.poster.url}?w=828` : undefined;

  useEffect(() => {
    const element = ref.current;
    if (!element || !video.codec || !HEVC.has(video.codec)) return;
    if (element.canPlayType(`video/mp4; codecs="${video.codec}"`) === "") setUnsupported(true);
  }, [video.codec]);

  useEffect(() => {
    const element = ref.current;
    if (!element || expanded || unsupported || !autoplayAllowed()) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.intersectionRatio >= 0.6) {
          // Otro video ya suena: no se le interrumpe por pasar junto.
          if (playingNow && playingNow !== element && !playingNow.paused) return;
          void element.play().catch(() => undefined);
        } else if (!element.paused) {
          element.pause();
        }
      },
      { threshold: [0, 0.6] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, unsupported]);

  const onPlay = () => {
    const element = ref.current;
    if (playingNow && playingNow !== element) playingNow.pause();
    playingNow = element;
    setPlaying(true);
  };
  const onPause = () => setPlaying(false);
  const toggle = () => {
    const element = ref.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
  };
  const toggleSound = () => {
    const element = ref.current;
    if (!element) return;
    element.muted = !element.muted;
    setMuted(element.muted);
    if (!element.muted && element.paused) void element.play().catch(() => undefined);
  };

  return (
    <div
      className={cn("relative mx-auto overflow-hidden rounded-2xl bg-black", className)}
      // Nunca más alto que el 75 % de la pantalla: un video vertical en un teléfono deja ver sus
      // controles y el texto; se angosta conservando su proporción.
      style={{ aspectRatio: aspect, width: `min(100%, calc(75dvh * ${aspect}))` }}
      data-video=""
    >
      <video
        ref={ref}
        src={unsupported ? undefined : video.url}
        poster={poster}
        muted={muted}
        playsInline
        loop={!expanded}
        controls={expanded && !unsupported}
        preload={expanded ? "metadata" : "none"}
        aria-label={label}
        onPlay={onPlay}
        onPause={onPause}
        onError={() => setUnsupported(true)}
        onClick={expanded ? undefined : toggle}
        className={cn("size-full", fit === "cover" ? "object-cover" : "object-contain")}
      />
      {!expanded && !unsupported ? (
        <>
          {playing ? null : (
            <button
              type="button"
              onClick={toggle}
              aria-label="Reproducir video"
              className="absolute inset-0 grid place-items-center outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <span className="grid size-14 place-items-center rounded-full bg-background/90 text-foreground shadow-sm">
                <Play aria-hidden="true" className="size-6 translate-x-px" />
              </span>
            </button>
          )}
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              {playing ? (
                <button
                  type="button"
                  onClick={toggle}
                  aria-label="Pausar video"
                  className="pointer-events-auto grid size-9 place-items-center rounded-full bg-black/60 text-white outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <Pause aria-hidden="true" className="size-4" />
                </button>
              ) : null}
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                {formatDuration(video.durationMs)}
              </span>
            </span>
            <button
              type="button"
              onClick={toggleSound}
              aria-label={muted ? "Activar sonido" : "Silenciar"}
              aria-pressed={!muted}
              className="pointer-events-auto grid size-9 place-items-center rounded-full bg-black/60 text-white outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              {muted ? (
                <VolumeX aria-hidden="true" className="size-4" />
              ) : (
                <Volume2 aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
        </>
      ) : null}
      {overlay ? (
        <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-start gap-2 *:pointer-events-auto">
          {overlay}
        </div>
      ) : null}
      {unsupported ? (
        <p className="absolute inset-x-0 bottom-0 bg-black/80 px-3 py-2 text-sm text-white">
          Este navegador no puede reproducir este video. Ábrelo desde tu teléfono.
        </p>
      ) : null}
    </div>
  );
}
