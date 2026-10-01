import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatCompactNumber } from "@/lib/format";
import type { ProductActivityRow } from "../seller-panel-queries";
import { formatPercent } from "./panel-pieces";

/**
 * Actividad por producto (ADR-056): visitas, guardados, al carrito, pruebas de «Ver cómo me veo»,
 * piezas vendidas y conversión de los últimos 30 días. En teléfono, una tarjeta por producto; en
 * escritorio, las cifras en columnas.
 */
export function ProductActivityList({ rows }: { rows: readonly ProductActivityRow[] }) {
  return (
    <ul className="flex flex-col divide-y">
      {rows.map((row) => {
        const stats = [
          { label: "Visitas", value: formatCompactNumber(row.views) },
          { label: "Guardados", value: formatCompactNumber(row.saves) },
          { label: "Al carrito", value: formatCompactNumber(row.carts) },
          { label: "Pruebas", value: formatCompactNumber(row.tryOns) },
          { label: "Vendidos", value: formatCompactNumber(row.orders) },
          { label: "Conversión", value: formatPercent(row.conversion) },
        ];
        return (
          <li
            key={row.productId}
            className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:gap-4"
          >
            <Link
              href={`/producto/${row.slug}` as Route}
              className="flex min-w-0 items-center gap-3 md:w-64 md:shrink-0"
            >
              <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                {row.image ? (
                  <Image src={row.image.url} alt="" fill sizes="48px" className="object-cover" />
                ) : null}
              </span>
              <span className="line-clamp-2 text-sm font-semibold">{row.title}</span>
            </Link>
            <dl className="grid flex-1 grid-cols-3 gap-x-3 gap-y-2 md:grid-cols-6">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col">
                  <dt className="text-[11px] text-muted-foreground">{stat.label}</dt>
                  <dd className="font-heading text-sm font-bold tabular-nums">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
