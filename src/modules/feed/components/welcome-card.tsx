"use client";

import { PartyPopper, Search, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { cn } from "@/lib/utils";
import type { WelcomeMomentDTO } from "../dto";
import { WELCOME_COOKIE } from "../welcome";

const chip =
  "inline-flex h-11 items-center gap-2 rounded-full bg-secondary py-1 pr-3.5 pl-1.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-accent md:h-9 motion-reduce:transition-none";

/** Siguiente elemento enfocable después de `from` (fuera de `container`), para no perder el foco. */
function nextFocusable(from: HTMLElement, container: HTMLElement) {
  const focusables = [
    ...document.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex='0']"),
  ];
  return focusables.slice(focusables.indexOf(from) + 1).find((el) => !container.contains(el));
}

/**
 * Momento de bienvenida (después del onboarding): «¡Listo, Sofía!», sus comunidades como chips y,
 * si declaró una búsqueda, «Buscando: …» que lleva a Ajustes. Sin promesas de presupuesto.
 *
 * La marca una cookie breve (ver `welcome.ts`): se mantiene al unirse o seguir (sin saltos de scroll)
 * y al cerrarla se borra la cookie. El foco pasa al siguiente control.
 */
export function WelcomeCard({
  moment,
  className,
}: {
  moment: WelcomeMomentDTO;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const card = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const focusAfterClose = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) return;
    focusAfterClose.current?.focus();
  }, [open]);

  if (!open) return null;

  const dismiss = () => {
    if (card.current && close.current) {
      focusAfterClose.current = nextFocusable(close.current, card.current) ?? null;
    }
    // No es un dato sensible: solo evita volver a mostrar la tarjeta.
    document.cookie = `${WELCOME_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
    setOpen(false);
  };

  return (
    <section
      ref={card}
      aria-labelledby="bienvenida-titulo"
      className={cn(
        "relative flex flex-col gap-3 border-b bg-card px-4 py-4 motion-safe:animate-rise md:rounded-3xl md:border md:px-5",
        className,
      )}
    >
      <div className="flex items-start gap-3 pr-10">
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-ink-2"
        >
          <PartyPopper className="size-6" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="bienvenida-titulo" className="text-2xl leading-tight font-extrabold">
            ¡Listo, {moment.firstName}!
          </h2>
          <p className="text-sm leading-snug text-ink-2">
            Tu inicio ya tiene lo de tus comunidades. Toca una burbuja para ver solo esa.
          </p>
        </div>
      </div>

      {moment.communities.length > 0 || moment.query ? (
        <ul className="flex flex-wrap gap-2" aria-label="Lo que elegiste">
          {moment.communities.map((community) => (
            <li key={community.id}>
              <Link href={`/c/${community.slug}` as Route} className={chip}>
                <CommunityAvatar
                  name={community.name}
                  emoji={community.emoji}
                  hue={community.hue}
                  size="sm"
                  decorative
                  className="size-7 rounded-full text-sm md:size-6"
                />
                {community.name}
              </Link>
            </li>
          ))}
          {moment.query ? (
            <li className="max-w-full min-w-0">
              <Link
                href="/ajustes"
                aria-label={`Buscando: ${moment.query}. Cambiar en Ajustes`}
                className={cn(chip, "max-w-full pl-3")}
              >
                <Search aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">
                  Buscando: <span className="text-foreground">{moment.query}</span>
                </span>
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}

      <button
        ref={close}
        type="button"
        onClick={dismiss}
        aria-label="Cerrar bienvenida"
        className="absolute top-2.5 right-2.5 grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:top-3 md:right-3 md:size-9"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </section>
  );
}
