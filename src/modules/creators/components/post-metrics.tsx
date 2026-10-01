import { formatCompactNumber } from "@/lib/format";
import type { PostMetrics } from "../metrics";

const ITEMS: { key: keyof PostMetrics; label: string }[] = [
  { key: "views", label: "Visitas" },
  { key: "tryOns", label: "Pruebas" },
  { key: "carts", label: "Al carrito" },
  { key: "orders", label: "Pedidos" },
];

/**
 * Lo que logró una publicación (ADR-063): visitas a la ficha, pruebas de «Ver cómo me veo», veces al
 * carrito y pedidos que llegaron desde ella. Solo conteos: nunca quién ni montos.
 */
export function PostMetricsList({ metrics, label }: { metrics: PostMetrics; label: string }) {
  return (
    <dl aria-label={label} className="grid grid-cols-4 gap-2 text-center">
      {ITEMS.map(({ key, label: name }) => (
        <div key={key} className="flex flex-col-reverse rounded-xl bg-secondary px-1 py-2">
          <dt className="text-[11px] text-muted-foreground">{name}</dt>
          <dd className="font-heading text-lg leading-tight font-extrabold tabular-nums">
            {formatCompactNumber(metrics[key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
