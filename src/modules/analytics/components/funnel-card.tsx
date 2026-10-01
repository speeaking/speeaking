import { formatCompactNumber } from "@/lib/format";
import type { FunnelStep } from "../seller-panel";
import { formatPercent } from "./panel-pieces";

/**
 * De la visita a la venta (ADR-056): cada paso con su número y cuántas de cada 100 visitas llegaron
 * hasta ahí. La barra es proporcional, con un mínimo visible para que un 1 % no desaparezca.
 */
export function FunnelCard({
  steps,
  days,
  ordersFromContent,
}: {
  steps: readonly FunnelStep[];
  days: number;
  ordersFromContent: number;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border bg-card p-5">
      <div className="flex flex-col">
        <h2 className="font-heading text-lg font-bold">De la visita a la venta</h2>
        <p className="text-xs text-muted-foreground">Últimos {days} días</p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{step.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-heading font-bold tabular-nums">
                  {formatCompactNumber(step.count)}
                </span>
                {step.per100 !== null && step.id !== "visits" ? (
                  <span className="text-xs text-muted-foreground">
                    {formatPercent(step.per100)} de las visitas
                  </span>
                ) : null}
              </span>
            </div>
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${step.per100 === null ? 0 : Math.max(step.count > 0 ? 2 : 0, step.per100)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ol>
      {ordersFromContent > 0 ? (
        <p className="text-xs text-muted-foreground">
          {ordersFromContent === 1
            ? "1 pedido llegó desde una publicación del feed."
            : `${ordersFromContent} pedidos llegaron desde publicaciones del feed.`}
        </p>
      ) : null}
    </section>
  );
}
