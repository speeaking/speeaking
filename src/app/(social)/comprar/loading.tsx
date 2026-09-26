import { Skeleton } from "@/components/ui/skeleton";

const CHIP_WIDTHS = ["w-14", "w-24", "w-22", "w-18", "w-26", "w-16"];

/** Carga de Comprar con su forma real: encabezado, búsqueda, categorías y rejilla de 2 (o 3) columnas. */
export default function ShopLoading() {
  return (
    <div role="status" className="flex flex-col">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true" className="flex flex-col">
        <div className="flex flex-col gap-2 px-4 pt-4 pb-5 md:px-0">
          <Skeleton className="h-8 w-36 md:h-9" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="px-4 md:px-0">
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
          <div className="flex gap-2 overflow-hidden px-4 md:flex-wrap md:px-0">
            {CHIP_WIDTHS.map((width) => (
              <Skeleton key={width} className={`h-8 shrink-0 rounded-full ${width}`} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:px-0">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="aspect-4/5 w-full rounded-2xl" />
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
