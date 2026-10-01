import { Skeleton } from "@/components/ui/skeleton";
import { FeedSkeleton } from "./feed-skeleton";

/** Esqueleto con la forma del perfil (ADR-055): es lo que la página revela al «pasar». */
export function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando perfil" className="flex flex-col gap-4">
      <div className="relative">
        <Skeleton className="h-36 rounded-none md:h-44 md:rounded-3xl" />
        <Skeleton className="absolute -bottom-10 left-4 size-22 rounded-full ring-4 ring-background md:left-6" />
      </div>
      <div className="flex flex-col gap-3 px-4 pt-12 md:px-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>
      <FeedSkeleton count={2} />
    </div>
  );
}
