import { CheckCircle2, ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DayPoint } from "../seller-panel";

/** Porcentaje con un decimal y espacio antes del signo, como el resto del Studio («6.8 %»). */
export function formatPercent(value: number) {
  return `${value.toLocaleString("es-MX", { maximumFractionDigits: 1 })} %`;
}

/** «▲ 12 %» o «▼ 6.8 %» contra el periodo anterior; sin periodo anterior no se pinta. */
export function TrendBadge({
  changePct,
  period = "la semana anterior",
}: {
  changePct: number | null;
  period?: string;
}) {
  if (changePct === null) return null;
  const up = changePct > 0;
  const flat = changePct === 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums",
        flat
          ? "bg-secondary text-muted-foreground"
          : up
            ? "bg-success/10 text-success"
            : "bg-destructive/10 text-destructive",
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {formatPercent(Math.abs(changePct))}
      <span className="sr-only">
        {flat ? " igual que" : up ? " más que" : " menos que"} {period}
      </span>
    </span>
  );
}

/**
 * Ventas por día en una línea pequeña (SVG propio, sin librería). Es decorativa: los mismos números
 * van en una lista solo para lectores de pantalla.
 */
export function Sparkline({ points }: { points: readonly DayPoint[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points.map((point) => point.value), 0);
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = max > 0 ? 30 - (point.value / max) * 26 : 30;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="h-10 w-full overflow-visible text-primary"
      >
        <polygon points={`0,32 ${coords.join(" ")} 100,32`} className="fill-primary/10" />
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div aria-hidden="true" className="flex justify-between text-[11px] text-muted-foreground">
        <span>{points[0]!.label}</span>
        <span>{points.at(-1)!.label}</span>
      </div>
      <ol className="sr-only" aria-label="Ventas por día">
        {points.map((point) => (
          <li key={point.day}>
            {point.label}: {formatMoney(point.value)}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Mosaico de una cifra: etiqueta, número grande, tendencia y, si se toca, adónde lleva. Todo el
 * mosaico se puede tocar, pero el enlace solo se llama como su etiqueta: el número, la tendencia y
 * la gráfica se leen como contenido, no como el nombre del enlace.
 */
export function StatTile({
  label,
  value,
  href,
  trend,
  footer,
  children,
}: {
  label: string;
  value: string;
  href?: Route;
  trend?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 rounded-2xl border bg-card p-4",
        href && "transition-colors has-[a:hover]:bg-secondary/60",
      )}
    >
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {href ? (
          <Link
            href={href}
            className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {label}
          </Link>
        ) : (
          label
        )}
        {href ? <ChevronRight aria-hidden="true" className="size-4" /> : null}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-heading text-2xl font-extrabold tabular-nums">{value}</span>
        {trend}
      </span>
      {children}
      {footer ? <span className="text-xs text-muted-foreground">{footer}</span> : null}
    </div>
  );
}

export type PendingItem = { label: string; count: number; href: Route; detail?: string };

/**
 * Tarjeta de pendientes, como las de Mercado Libre: solo lo que pide atención, cada uno con su
 * número y adónde ir. Sin pendientes dice «Todo en orden».
 */
export function PendingCard({
  title,
  items,
  allClear,
}: {
  title: string;
  items: readonly PendingItem[];
  allClear: string;
}) {
  const open = items.filter((item) => item.count > 0);
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      {open.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
          {allClear}
        </p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {open.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-secondary"
              >
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-sm font-semibold">{item.label}</span>
                  {item.detail ? (
                    <span className="text-xs text-muted-foreground">{item.detail}</span>
                  ) : null}
                </span>
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary/10 px-2 text-xs font-bold text-primary-text tabular-nums">
                  {item.count}
                </span>
                <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
