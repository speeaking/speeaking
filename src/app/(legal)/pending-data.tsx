import type { ReactNode } from "react";

/** Dato que falta llenar antes del lanzamiento: se ve marcado para que nadie lo tome por final. */
export function PendingData({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-accent px-1 font-semibold text-accent-foreground">{children}</span>
  );
}
