import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto de una lista de personas (ADR-058). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex flex-col gap-4 px-4 pt-4 md:px-0">
      <Skeleton className="h-7 w-40" />
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
