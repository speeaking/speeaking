import { Skeleton } from "@/components/ui/skeleton";

/** Carga del carrito con su forma real: filas por vendedor, resumen y botón. */
export default function CartLoading() {
  return (
    <div role="status" className="flex flex-col">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true" className="flex flex-col">
        <div className="flex flex-col gap-2 px-4 pt-4 pb-5 md:px-0">
          <Skeleton className="h-8 w-32 md:h-9" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex flex-col gap-4 px-4 md:px-0">
          <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="size-20 shrink-0 rounded-2xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-32 rounded-full" />
                </div>
              </div>
            ))}
            <div className="flex justify-between border-t pt-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-14" />
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-3xl bg-secondary p-4">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20 bg-background/70" />
              <Skeleton className="h-4 w-16 bg-background/70" />
            </div>
            <div className="mt-1 flex justify-between">
              <Skeleton className="h-6 w-28 bg-background/70" />
              <Skeleton className="h-6 w-24 bg-background/70" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
