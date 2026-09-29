import { NeedForm } from "./need-form";

/**
 * Entrada al estilista en el inicio (ADR-043): una frase y un campo. Sin botones extra: la única
 * acción es «Crea mi look».
 */
export function StylistCard({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="estilista-inicio"
      className={
        className ?? "flex flex-col gap-3 border-b bg-card px-4 py-4 md:rounded-3xl md:border"
      }
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="estilista-inicio" className="font-heading text-lg leading-tight font-bold">
          ¿Qué necesitas?
        </h2>
        <p className="text-sm text-muted-foreground">
          Dinos la ocasión y tu presupuesto: te armamos looks con productos reales y te los pruebas
          con tu foto.
        </p>
      </div>
      <NeedForm compact />
    </section>
  );
}
