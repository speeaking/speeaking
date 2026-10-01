"use client";

import { Heart } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { formatCompactNumber } from "@/lib/format";
import { tapHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { REACTIONS, type ReactionKind, type ReactionState, reactionMeta } from "../reactions";

/** Con el cursor encima la tira aparece sola tras esta pausa (solo puntero fino). */
export const HOVER_OPEN_MS = 400;
/** En teléfono, dejar presionado el botón este tiempo abre la tira. */
export const PRESS_OPEN_MS = 450;
const HOVER_CLOSE_MS = 300;
const PRESS_MOVE_PX = 10;

/** «Me gusta» o «Me divierte, 3»: el nombre lleva la reacción puesta; el estado va en aria-pressed. */
export function reactionLabel(state: ReactionState) {
  const label = reactionMeta(state.kind ?? "LIKE").label;
  return state.count > 0 ? `${label}, ${formatCompactNumber(state.count)}` : label;
}

/**
 * Botón de reacciones (ADR-054). Un toque da ❤️ o quita la reacción puesta; dejar presionado
 * (teléfono), pasar el cursor (escritorio), la flecha arriba o el botón «Elegir reacción» (teclado y
 * lectores de pantalla) abren la tira con las seis. Junto al número va el resumen de la publicación
 * cuando hay reacciones distintas del corazón.
 */
export function ReactionButton({
  state,
  onReact,
  onToggle,
  className,
  labelClassName,
}: {
  state: ReactionState;
  /** Elegir una reacción de la tira (repetir la actual la quita). */
  onReact: (kind: ReactionKind) => void;
  /** Toque simple: ❤️, o quitar la que ya está. */
  onToggle: () => void;
  className?: string;
  /** Clase del texto («Me gusta»): oculto en teléfono o solo para lectores de pantalla. */
  labelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const pickerId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const openPicker = () => {
    clearTimer();
    setOpen(true);
  };
  const closePicker = () => {
    clearTimer();
    setOpen(false);
  };

  // Tocar afuera o Escape cierran la tira.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  useEffect(() => clearTimer, []);

  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearTimer();
    timer.current = window.setTimeout(openPicker, HOVER_OPEN_MS);
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearTimer();
    if (open) timer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    press.current = { x: event.clientX, y: event.clientY };
    clearTimer();
    timer.current = window.setTimeout(() => {
      // La presión larga abre la tira; el «click» que suelta el dedo después no debe dar ❤️.
      suppressClick.current = true;
      tapHaptic();
      openPicker();
    }, PRESS_OPEN_MS);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!press.current) return;
    const moved = Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y);
    if (moved > PRESS_MOVE_PX) {
      press.current = null;
      clearTimer();
    }
  };
  const onPointerUp = () => {
    press.current = null;
    clearTimer();
  };
  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (open) setOpen(false);
    onToggle();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      openPicker();
    }
  };
  const choose = (kind: ReactionKind) => {
    closePicker();
    onReact(kind);
  };

  const current = state.kind ? reactionMeta(state.kind) : null;
  const showStack = state.top.some((kind) => kind !== "LIKE");
  return (
    <div
      ref={wrapperRef}
      className="relative"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <button
        type="button"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => {
          if (press.current) event.preventDefault();
        }}
        aria-pressed={state.kind !== null}
        aria-label={reactionLabel(state)}
        className={cn(
          className,
          "touch-manipulation select-none [-webkit-touch-callout:none]",
          state.kind !== null && "text-primary-text hover:text-primary-text",
        )}
      >
        {current && current.kind !== "LIKE" ? (
          // La `key` lo vuelve a montar al cambiar: la animación corre cada vez.
          <span
            key={current.kind}
            aria-hidden="true"
            className="text-xl leading-none motion-safe:animate-pop"
          >
            {current.emoji}
          </span>
        ) : (
          <Heart
            key={current ? "on" : "off"}
            aria-hidden="true"
            className={cn(
              "size-5 motion-safe:transition-transform motion-safe:active:scale-125",
              current && "fill-current motion-safe:animate-pop",
            )}
          />
        )}
        <span className={labelClassName}>{current?.label ?? "Me gusta"}</span>
        {showStack ? <ReactionStack top={state.top} /> : null}
        {state.count > 0 ? (
          <span
            key={state.count}
            className="tabular-nums motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
          >
            {formatCompactNumber(state.count)}
          </span>
        ) : null}
      </button>
      {/* Teclado y lectores de pantalla: la tira también se abre sin presión larga ni cursor. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={pickerId}
        onClick={() => (open ? closePicker() : openPicker())}
        className="pointer-events-none absolute top-1/2 left-full z-10 ml-1 -translate-y-1/2 rounded-full bg-secondary px-2 py-1 text-xs font-semibold whitespace-nowrap opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100"
      >
        Elegir reacción
      </button>
      {open ? <ReactionPicker id={pickerId} current={state.kind} onChoose={choose} /> : null}
    </div>
  );
}

/** La tira: seis emojis grandes que entran escalonados y crecen bajo el cursor o el foco. */
function ReactionPicker({
  id,
  current,
  onChoose,
}: {
  id: string;
  current: ReactionKind | null;
  onChoose: (kind: ReactionKind) => void;
}) {
  return (
    <div
      id={id}
      role="group"
      aria-label="Reacciones"
      className="absolute bottom-full left-0 z-20 mb-1.5 flex gap-0.5 rounded-full border bg-card p-1 shadow-lg motion-safe:animate-in motion-safe:duration-150 motion-safe:zoom-in-95 motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
    >
      {REACTIONS.map((reaction, index) => (
        <button
          key={reaction.kind}
          type="button"
          aria-label={reaction.label}
          aria-pressed={reaction.kind === current}
          onClick={() => onChoose(reaction.kind)}
          style={{ animationDelay: `${index * 30}ms`, animationFillMode: "both" }}
          className={cn(
            "grid size-10 place-items-center rounded-full text-[26px] leading-none transition-transform hover:scale-125 focus-visible:scale-125 motion-safe:animate-in motion-safe:duration-200 motion-safe:zoom-in-50 motion-safe:fade-in motion-reduce:transition-none",
            reaction.kind === current && "bg-accent",
          )}
        >
          <span aria-hidden="true">{reaction.emoji}</span>
        </button>
      ))}
    </div>
  );
}

/** Resumen de la publicación: los emojis más usados, encimados, antes del número. */
function ReactionStack({ top }: { top: readonly ReactionKind[] }) {
  return (
    <span aria-hidden="true" className="flex -space-x-1">
      {top.map((kind) => (
        <span
          key={kind}
          className="grid size-4 place-items-center rounded-full bg-card text-[11px] leading-none ring-1 ring-card"
        >
          {reactionMeta(kind).emoji}
        </span>
      ))}
    </span>
  );
}
