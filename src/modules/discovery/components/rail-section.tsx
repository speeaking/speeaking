import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Caja de la columna «Para ti»: título con ícono de marca, bajada opcional y contenido. Con `bleed`,
 * el contenido llega a los bordes (p. ej. un carrusel) y solo el encabezado conserva el margen.
 */
export function RailSection({
  id,
  title,
  icon: Icon,
  description,
  action,
  bleed = false,
  className,
  children,
}: {
  /** Id del título: la sección se anuncia con él (región con nombre). */
  id: string;
  title: string;
  icon: LucideIcon;
  description?: ReactNode;
  /** Control a la derecha del título (p. ej. cerrar). */
  action?: ReactNode;
  /** El contenido ocupa todo el ancho de la caja (sin margen lateral). */
  bleed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("rounded-3xl border bg-card py-4", !bleed && "px-4", className)}
    >
      <div className={cn("flex min-h-7 items-center justify-between gap-2", bleed && "px-4")}>
        <h2
          id={id}
          className="flex items-center gap-2 font-heading text-[17px] leading-tight font-bold tracking-title"
        >
          <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          {title}
        </h2>
        {action}
      </div>
      {description ? (
        <p className={cn("mt-1 text-xs leading-snug text-muted-foreground", bleed && "px-4")}>
          {description}
        </p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
