"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/states/error-state";

export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // El detalle solo va a la consola; al usuario nunca se le muestra.
    console.error(error);
  }, [error]);

  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-xl items-center px-4">
      <div className="w-full">
        <ErrorState onRetry={retry} />
      </div>
    </main>
  );
}
