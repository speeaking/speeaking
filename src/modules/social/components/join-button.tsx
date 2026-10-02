"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleMembershipAction } from "../community-actions";

/** Crear cuenta y volver a la misma página; con `unirse`, el onboarding ya trae la comunidad. */
export function joinSignUpHref(next: string, communitySlug?: string) {
  const params = new URLSearchParams({ next });
  if (communitySlug) params.set("unirse", communitySlug);
  return `/registro?${params.toString()}` as Route;
}

/**
 * Alto táctil: 44 px en móvil y 40 px en escritorio. `sm` (listas y columnas) se ve más compacto y
 * el área táctil la completa un `after` transparente.
 */
const SIZE_CLASS = {
  default: "h-11 px-4 text-[15px] font-bold md:h-10",
  sm: "relative h-9 px-3 font-bold after:absolute after:inset-x-0 after:-inset-y-1 md:h-7 md:after:-inset-y-1.5",
} as const;

/**
 * El aviso con «Deshacer» dura 10 s y no los 4 de sonner: con teclado o lector de pantalla hay que
 * llegar hasta el botón.
 */
const UNDO_TOAST_MS = 10_000;

/** Cada aviso lleva un id nuevo: sonner borra POR ID el que se está retirando, y uno nuevo con el
 * mismo id creado en esos 200 ms heredaba el «borrar» y no llegaba a verse. */
let toastSequence = 0;

const membershipToastPrefix = (communityId: string) => `membresia-${communityId}:`;

/** Retira los avisos de membresía activos de una comunidad (de este botón o de otro). */
function dismissMembershipToasts(communityId: string) {
  const prefix = membershipToastPrefix(communityId);
  for (const { id } of toast.getToasts()) {
    if (String(id).startsWith(prefix)) toast.dismiss(id);
  }
}

/**
 * «Unirme» / «Miembro». El nombre accesible empieza con el texto visible y dice lo que hace el botón
 * («Unirme a Gaming», «Miembro, salir de Gaming»: WCAG 2.5.3); por eso no lleva `aria-pressed`. Al
 * salir aparece «Saliste de Gaming» con «Deshacer». Con el puntero encima (o con foco de teclado),
 * «Miembro» se lee «Salir», salvo justo después de unirse: hasta que el puntero sale del botón sigue
 * diciendo «Miembro» (si no, al tocar «Unirme» se leería «Salir» en el acto).
 */
export function JoinButton({
  communityId,
  communityName,
  communitySlug,
  initialJoined,
  size = "default",
  isSignedIn,
  className,
}: {
  communityId: string;
  /** Nombre visible: da el nombre accesible («Unirme a Gaming») y el aviso al salir. */
  communityName?: string;
  /** Para el visitante: `/registro?next=…&unirse=<slug>`. */
  communitySlug?: string;
  initialJoined: boolean;
  size?: "default" | "sm";
  /**
   * `false` para visitantes: «Unirme» lleva directo a crear cuenta, sin cambio optimista. Sin
   * especificar, la acción del servidor decide y, sin sesión, también manda a crear cuenta.
   */
  isSignedIn?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // Lo confirmado por el servidor; si la página vuelve a pintarse con otro valor, manda la página.
  const [confirmed, setConfirmed] = useState(initialJoined);
  const [previousInitial, setPreviousInitial] = useState(initialJoined);
  if (previousInitial !== initialJoined) {
    setPreviousInitial(initialJoined);
    setConfirmed(initialJoined);
  }
  const [joined, setOptimisticJoined] = useOptimistic(confirmed);
  // Recién cambiado con el puntero encima: no se muestra «Salir» hasta que el puntero sale.
  const [fresh, setFresh] = useState(false);

  const classes = cn(SIZE_CLASS[size], className);
  const joinLabel = communityName ? `Unirme a ${communityName}` : undefined;

  if (isSignedIn === false) {
    return (
      <Link
        href={joinSignUpHref(pathname || "/", communitySlug)}
        aria-label={joinLabel}
        // `cn` resuelve los choques con el tamaño base (h-8 frente a h-11), igual que `Button`.
        className={cn(buttonVariants({ size, variant: "soft" }), classes)}
      >
        Unirme
      </Link>
    );
  }

  const update = (join: boolean) =>
    startTransition(async () => {
      setOptimisticJoined(join);
      const result = await toggleMembershipAction(communityId, join);
      if (!result.ok) {
        if (result.needsAuth) {
          router.push(joinSignUpHref(window.location.pathname, communitySlug));
        } else {
          toast.error(result.error);
        }
        return;
      }
      setConfirmed(result.active);
      // Un solo aviso por comunidad: salir otra vez lo reemplaza y volver a unirse lo retira.
      dismissMembershipToasts(communityId);
      if (!result.active) {
        toast(communityName ? `Saliste de ${communityName}` : "Saliste de la comunidad", {
          id: `${membershipToastPrefix(communityId)}${++toastSequence}`,
          duration: UNDO_TOAST_MS,
          action: { label: "Deshacer", onClick: () => update(true) },
        });
      }
    });

  return (
    <Button
      size={size}
      variant={joined ? "outline" : "soft"}
      aria-label={joined ? `Miembro, salir de ${communityName ?? "la comunidad"}` : joinLabel}
      disabled={pending}
      // Sigue enfocable mientras espera: con `disabled` nativo el foco de teclado se perdía.
      focusableWhenDisabled
      data-fresh={fresh || undefined}
      onClick={() => {
        setFresh(true);
        update(!joined);
      }}
      onPointerLeave={() => setFresh(false)}
      onBlur={() => setFresh(false)}
      className={classes}
    >
      {joined ? (
        // Ambos textos ocupan la misma celda: el botón no cambia de ancho al pasar el puntero.
        <span className="grid">
          <span className="col-start-1 row-start-1 group-hover/button:invisible group-focus-visible/button:invisible group-data-[fresh]/button:visible!">
            Miembro
          </span>
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 group-hover/button:visible group-focus-visible/button:visible group-data-[fresh]/button:invisible!"
          >
            Salir
          </span>
        </span>
      ) : (
        "Unirme"
      )}
    </Button>
  );
}
