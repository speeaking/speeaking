import { cn } from "@/lib/utils";
import {
  CANCEL_EXCELLENT_RATE,
  DISPATCH_EXCELLENT_HOURS,
  type Performance,
  PERFORMANCE_LEVEL_LABELS,
  PERFORMANCE_WINDOW_DAYS,
  type PerformanceLevel,
} from "../seller-panel";
import { formatPercent } from "./panel-pieces";

const LEVEL_CLASSES: Record<PerformanceLevel, string> = {
  excelente: "bg-success/10 text-success",
  bien: "bg-secondary text-foreground",
  por_mejorar: "bg-destructive/10 text-destructive",
};

function LevelChip({ level }: { level: PerformanceLevel | null }) {
  if (!level) {
    return (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-muted-foreground">
        Sin envíos todavía
      </span>
    );
  }
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", LEVEL_CLASSES[level])}>
      {PERFORMANCE_LEVEL_LABELS[level]}
    </span>
  );
}

/** «18 h» o «2.5 días». */
export function formatHours(hours: number) {
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${(hours / 24).toLocaleString("es-MX", { maximumFractionDigits: 1 })} días`;
}

/**
 * Desempeño de la tienda (ADR-056): lo que en Mercado Libre es la reputación, pero sin niveles
 * públicos ni datos que no tenemos. Solo con cobros reales y a partir de 5 pedidos en 30 días.
 */
export function PerformanceCard({ performance }: { performance: Performance }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
      <div className="flex flex-col">
        <h2 className="font-heading text-lg font-bold">Desempeño</h2>
        <p className="text-xs text-muted-foreground">
          Últimos {PERFORMANCE_WINDOW_DAYS} días, solo pedidos con cobro real
        </p>
      </div>
      {!performance.enough ? (
        <p className="text-sm text-muted-foreground">
          Aún sin datos suficientes: se califica a partir de {performance.needed} pedidos pagados y
          llevas {performance.orders}.
        </p>
      ) : (
        <dl className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col leading-tight">
              <dt className="text-sm font-semibold">Tiempo para despachar</dt>
              <dd className="text-xs text-muted-foreground">
                {performance.dispatch.medianHours === null
                  ? "Todavía no sale ningún pedido"
                  : `La mitad de tus pedidos sale en ${formatHours(performance.dispatch.medianHours)} o menos`}
                {performance.dispatch.overdue > 0
                  ? ` · ${performance.dispatch.overdue} con más de 72 h esperando`
                  : ""}
              </dd>
            </div>
            <LevelChip level={performance.dispatch.level} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col leading-tight">
              <dt className="text-sm font-semibold">Cancelaciones</dt>
              <dd className="text-xs text-muted-foreground">
                {formatPercent(Math.round(performance.cancellation.rate * 1000) / 10)} de{" "}
                {performance.orders} pedidos
              </dd>
            </div>
            <LevelChip level={performance.cancellation.level} />
          </div>
        </dl>
      )}
      <p className="text-xs text-muted-foreground">
        Excelente: despachas en {DISPATCH_EXCELLENT_HOURS} h o menos y cancelas menos del{" "}
        {formatPercent(CANCEL_EXCELLENT_RATE * 100)}.
      </p>
    </section>
  );
}
