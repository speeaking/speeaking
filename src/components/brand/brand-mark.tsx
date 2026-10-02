import { useId } from "react";
import { cn } from "@/lib/utils";

/*
 * Marca de speeaking (ADR-070): dos globos de diálogo con cara; el violeta habla y el cian escucha.
 * Colores fijos de la marca (`brand-*` en globals.css), iguales en claro y en oscuro. Versión
 * vectorial provisional hecha a partir de la hoja de marca, hasta tener el SVG del diseñador.
 */

/** Globo que escucha (cian), con su cola abajo a la derecha. */
function Listener({ className, strokeWidth }: { className?: string; strokeWidth: number }) {
  return (
    <g className={className} strokeWidth={strokeWidth} strokeLinejoin="round">
      <circle cx="43" cy="37" r="15" />
      <path d="M56 44.5 60 56l-11.9-4.9z" />
    </g>
  );
}

/**
 * Isotipo: los dos globos encimados, con un hueco transparente entre ellos para que se vean igual
 * sobre cualquier fondo. Es la misma figura que `public/brand/mark.svg` (fuente de los íconos de la
 * PWA) y `src/app/icon.svg`.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  // Un id por dibujo: el mismo id repetido en la página haría que todos usaran la primera máscara.
  const gap = `hueco-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <mask id={gap}>
        <rect width="64" height="64" fill="#fff" />
        <Listener className="fill-black stroke-black" strokeWidth={5} />
      </mask>
      <g
        mask={`url(#${gap})`}
        className="fill-brand-violet stroke-brand-violet"
        strokeWidth={1.5}
        strokeLinejoin="round"
      >
        <circle cx="23" cy="27" r="18" />
        <path d="M7.4 36 5 50l10.4-6.7z" />
      </g>
      <g className="fill-white">
        <ellipse cx="15.5" cy="23.5" rx="2.3" ry="3.1" />
        <ellipse cx="25" cy="23.5" rx="2.3" ry="3.1" />
        <path d="M15 30.5h10a5 5 0 0 1-10 0z" />
      </g>
      <Listener className="fill-brand-cyan stroke-brand-cyan" strokeWidth={1.5} />
      <g className="fill-brand-navy">
        <ellipse cx="39" cy="35" rx="2.1" ry="2.9" />
        <ellipse cx="47.5" cy="35" rx="2.1" ry="2.9" />
      </g>
      <path
        d="M39.5 42.5h7.5"
        className="stroke-brand-navy"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Las dos caras una junto a la otra, como letras: las «ee» del logotipo. */
export function BrandFaces({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 58 34" className={cn("shrink-0", className)} aria-hidden="true">
      <g className="fill-brand-violet stroke-brand-violet" strokeWidth={1.2} strokeLinejoin="round">
        <circle cx="14" cy="15" r="13" />
        <path d="M3.4 22.5 2 32.5l8.2-5.7z" />
      </g>
      <g className="fill-white">
        <ellipse cx="9.8" cy="12.6" rx="1.7" ry="2.3" />
        <ellipse cx="17.2" cy="12.6" rx="1.7" ry="2.3" />
        <path d="M9.4 17.6h8.2a4.1 4.1 0 0 1-8.2 0z" />
      </g>
      <g className="fill-brand-cyan stroke-brand-cyan" strokeWidth={1.2} strokeLinejoin="round">
        <circle cx="43" cy="17" r="13" />
        <path d="M53.6 24.5 56 33.5l-9.2-4.3z" />
      </g>
      <g className="fill-brand-navy">
        <ellipse cx="39.2" cy="15.6" rx="1.7" ry="2.3" />
        <ellipse cx="46.8" cy="15.6" rx="1.7" ry="2.3" />
      </g>
      <path d="M40 21.6h6" className="stroke-brand-navy" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}
