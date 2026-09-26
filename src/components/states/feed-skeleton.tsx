import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto de carga con la forma de una tarjeta del feed. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando contenido"
      className="flex flex-col gap-4 px-4 md:px-0"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="aspect-4/5 w-full rounded-2xl" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      ))}
    </div>
  );
}
