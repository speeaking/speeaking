"use client";

import { type ReactNode, useState } from "react";
import { ViewTransition } from "@/lib/view-transition";

/**
 * La foto de una tarjeta de producto viaja hasta su ficha al abrirla (ADR-052). El nombre de
 * transición solo se pone cuando la persona la toca (puntero o foco): dos tarjetas del mismo producto
 * en pantalla a la vez (p. ej. en dos carruseles del feed) no pueden compartir nombre, React lo
 * rechaza. Armada justo antes de navegar, la tarjeta tocada es la única con nombre.
 */
export function ProductImageMorph({
  productId,
  children,
}: {
  productId: string;
  children: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const arm = () => setArmed(true);
  const disarm = () => setArmed(false);
  return (
    <span
      className="contents"
      data-slot="product-image-morph"
      data-armed={armed ? "" : undefined}
      onPointerDown={arm}
      onPointerLeave={disarm}
      onFocus={arm}
      onBlur={disarm}
    >
      <ViewTransition
        name={armed ? `producto-${productId}` : undefined}
        share="morph"
        default="none"
      >
        {children}
      </ViewTransition>
    </span>
  );
}
