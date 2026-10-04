import { PageHeader } from "@/components/layout/page-header";

export default function LoadingSearch() {
  return (
    <div aria-busy="true" aria-label="Cargando resultados de búsqueda">
      <PageHeader title="Buscar" />
      <div aria-hidden="true" className="flex flex-col gap-4 px-4 md:px-0">
        <div className="h-11 rounded-full bg-secondary motion-safe:animate-pulse md:hidden" />
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-11 w-24 shrink-0 rounded-full bg-secondary motion-safe:animate-pulse"
            />
          ))}
        </div>
        <div className="h-36 rounded-2xl bg-secondary motion-safe:animate-pulse" />
        <div className="h-36 rounded-2xl bg-secondary motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
