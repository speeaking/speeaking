"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleFollowAction } from "../follow-actions";

function signUpHref(next: string) {
  return `/registro?${new URLSearchParams({ next }).toString()}` as Route;
}

/** Alto táctil: 44 px en móvil y 40 px en escritorio. */
const SIZE_CLASS = "h-11 px-4 text-[15px] font-bold md:h-10";

/**
 * «Seguir» / «Siguiendo». El nombre accesible empieza con el texto visible y dice lo que hace el
 * botón («Seguir a Ana», «Siguiendo, dejar de seguir a Ana»: WCAG 2.5.3); por eso no lleva
 * `aria-pressed`. Con el puntero encima (o con foco de teclado), «Siguiendo» se lee «Dejar de
 * seguir», salvo justo después de seguir: hasta que el puntero sale del botón dice «Siguiendo».
 */
export function FollowButton({
  targetUserId,
  targetName,
  initialFollowing,
  isSignedIn,
  variant = "default",
  className,
}: {
  targetUserId: string;
  /** Nombre visible de la persona: da el nombre accesible («Seguir a Ana»). */
  targetName?: string;
  initialFollowing: boolean;
  /** `false` para visitantes: «Seguir» lleva directo a crear cuenta, sin cambio optimista. */
  isSignedIn?: boolean;
  /**
   * Color de «Seguir»: rosa (`default`) donde es la acción principal, como el perfil; rosa suave
   * (`soft`) donde hay otra principal, como «Comprar ahora» en el producto.
   */
  variant?: "default" | "soft";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // Lo confirmado por el servidor; si la página vuelve a pintarse con otro valor, manda la página.
  const [confirmed, setConfirmed] = useState(initialFollowing);
  const [previousInitial, setPreviousInitial] = useState(initialFollowing);
  if (previousInitial !== initialFollowing) {
    setPreviousInitial(initialFollowing);
    setConfirmed(initialFollowing);
  }
  const [following, setOptimisticFollowing] = useOptimistic(confirmed);
  // Recién cambiado con el puntero encima: no se muestra «Dejar de seguir» hasta que el puntero sale.
  const [fresh, setFresh] = useState(false);

  const classes = cn(SIZE_CLASS, className);
  const followLabel = targetName ? `Seguir a ${targetName}` : undefined;

  if (isSignedIn === false) {
    return (
      <Link
        href={signUpHref(pathname || "/")}
        aria-label={followLabel}
        // `cn` resuelve los choques con el tamaño base (h-8 frente a h-11), igual que `Button`.
        className={cn(buttonVariants({ variant }), classes)}
      >
        Seguir
      </Link>
    );
  }

  return (
    <Button
      variant={following ? "outline" : variant}
      aria-label={
        following
          ? targetName
            ? `Siguiendo, dejar de seguir a ${targetName}`
            : "Siguiendo, dejar de seguir"
          : followLabel
      }
      disabled={pending}
      // Sigue enfocable mientras espera: con `disabled` nativo el foco de teclado se perdía.
      focusableWhenDisabled
      data-fresh={fresh || undefined}
      onPointerLeave={() => setFresh(false)}
      onBlur={() => setFresh(false)}
      onClick={() => {
        const next = !following;
        setFresh(true);
        startTransition(async () => {
          setOptimisticFollowing(next);
          const result = await toggleFollowAction(targetUserId, next);
          if (result.ok) {
            setConfirmed(result.following);
          } else if (result.needsAuth) {
            router.push(signUpHref(window.location.pathname));
          } else {
            toast.error(result.error);
          }
        });
      }}
      className={classes}
    >
      {following ? (
        // Ambos textos ocupan la misma celda: el botón no cambia de ancho al pasar el puntero.
        <span className="grid">
          <span className="col-start-1 row-start-1 group-hover/button:invisible group-focus-visible/button:invisible group-data-[fresh]/button:visible!">
            Siguiendo
          </span>
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 group-hover/button:visible group-focus-visible/button:visible group-data-[fresh]/button:invisible!"
          >
            Dejar de seguir
          </span>
        </span>
      ) : (
        "Seguir"
      )}
    </Button>
  );
}
