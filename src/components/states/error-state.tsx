"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Estado de error recuperable, usado por los `error.tsx`. Nunca muestra detalles técnicos. */
export function ErrorState({
  title = "Algo salió mal",
  description = "No pudimos cargar esta sección. Intenta de nuevo en unos segundos.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <section
      role="alert"
      className="flex flex-col items-center gap-3 rounded-3xl border px-6 py-12 text-center"
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <TriangleAlert className="size-7" />
      </span>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-2" onClick={onRetry}>
          <RefreshCw data-icon="inline-start" />
          Reintentar
        </Button>
      ) : null}
    </section>
  );
}
