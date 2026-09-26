import { Skeleton } from "@/components/ui/skeleton";

/** Carga del producto con su forma real: galería, título, precio, caja de compra y vendedor. */
export default function ProductLoading() {
  return (
    <div role="status" className="flex flex-col">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true" className="flex flex-col gap-6 pb-6">
        {/* Galería: el marco del producto (4:5) y sus puntos. */}
        <div className="flex flex-col gap-2">
          <Skeleton className="aspect-4/5 w-full rounded-none md:mt-2 md:rounded-3xl" />
          <div className="flex justify-center gap-1">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="size-1.5 rounded-full" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 md:px-0">
          <Skeleton className="h-4 w-44" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-11/12 md:h-8" />
            <Skeleton className="h-7 w-2/3 md:h-8" />
          </div>
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />

          {/* Caja de compra: cantidad y dos botones. */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>

        {/* Vendido por… y «Seguir». */}
        <div className="mx-4 flex items-center gap-3 rounded-3xl border bg-card p-4 md:mx-0">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-36 max-w-full" />
          </div>
          <Skeleton className="h-11 w-24 shrink-0 rounded-lg md:h-10" />
        </div>
      </div>
    </div>
  );
}
