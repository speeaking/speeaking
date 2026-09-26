import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga de la pasarela simulada con su forma real (aviso, monto y botón). Sin este archivo, al tocar
 * «Pagar» se veía la carga de «Revisa tu pedido» (`checkout/loading.tsx` también envuelve esta ruta).
 */
export default function PaymentLoading() {
  return (
    <div role="status" className="flex flex-col">
      <span className="sr-only">Cargando…</span>
      <div
        aria-hidden="true"
        className="mx-4 mt-6 flex flex-col gap-5 rounded-3xl border bg-card p-6 md:mx-0"
      >
        <Skeleton className="h-6 w-full rounded-full" />
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="mx-auto h-4 w-32" />
      </div>
    </div>
  );
}
