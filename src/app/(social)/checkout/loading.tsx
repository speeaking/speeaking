import { Skeleton } from "@/components/ui/skeleton";

/** Carga de «Revisa tu pedido» con su forma real: entrega por vendedor, pago, total y botón. */
export default function CheckoutLoading() {
  return (
    <div role="status" className="flex flex-col">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true" className="flex flex-col">
        <div className="flex flex-col gap-2 px-4 pt-4 pb-5 md:px-0">
          <Skeleton className="h-8 w-56 md:h-9" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-col gap-5 px-4 md:px-0">
          {/* Entrega de un vendedor: productos y opciones. */}
          <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="flex justify-between gap-3">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
          {/* Método de pago. */}
          <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
            <Skeleton className="h-6 w-48" />
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-2xl" />
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-3xl bg-secondary p-4">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20 bg-background/70" />
              <Skeleton className="h-4 w-16 bg-background/70" />
            </div>
            <div className="mt-1 flex justify-between">
              <Skeleton className="h-6 w-24 bg-background/70" />
              <Skeleton className="h-6 w-24 bg-background/70" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
