import { Check } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LookDTO } from "../service";
import { BuyLookButton, SwapButton } from "./look-actions";

/** Ruta de Pruébatelo con las prendas del look. */
export function tryOnLookHref(look: LookDTO) {
  const params = new URLSearchParams();
  if (look.id) params.set("look", look.id);
  else for (const item of look.items) params.append("producto", item.product.slug);
  return `/probar?${params.toString()}` as Route;
}

/**
 * Un look: nombre, piezas con foto, precio y vendedor de cada una, total y acciones. Cada pieza es
 * un producto real (P4). Con sesión: cambiar piezas, comprar el look y probárselo; visitantes:
 * ver productos y crear cuenta para probárselo.
 */
export function LookCard({
  look,
  isSignedIn,
  tryOnAvailable,
  returnTo,
}: {
  look: LookDTO;
  isSignedIn: boolean;
  tryOnAvailable: boolean;
  returnTo: string;
}) {
  const tryOnHref = isSignedIn
    ? tryOnLookHref(look)
    : (`/registro?next=${encodeURIComponent(returnTo)}` as Route);
  return (
    <article
      aria-labelledby={`look-${look.id ?? look.title}`}
      className="flex flex-col gap-4 rounded-3xl border bg-card p-4 md:p-5"
    >
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id={`look-${look.id ?? look.title}`}
            className="font-heading text-xl leading-tight font-extrabold tracking-title"
          >
            {look.title}
          </h2>
          <p className="font-heading text-xl font-extrabold tabular-nums">
            {formatMoney(look.totalCents, look.currency)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {look.explanation ? <p>{look.explanation}</p> : null}
          {look.withinBudget ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success">
              <Check aria-hidden="true" className="size-3.5" />
              En tu presupuesto
            </span>
          ) : null}
        </div>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {look.items.map((item) => (
          <li key={item.product.id} className="flex flex-col gap-1.5">
            <Link
              href={`/producto/${item.product.slug}` as Route}
              className="group flex flex-col gap-1.5"
            >
              <span className="relative aspect-4/5 overflow-hidden rounded-2xl bg-muted">
                {item.product.image ? (
                  <Image
                    src={item.product.image.url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, 200px"
                    style={{ objectFit: "cover" }}
                    className="transition-transform duration-300 group-hover:scale-105"
                  />
                ) : null}
              </span>
              <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {item.slotLabel}
              </span>
              <span className="line-clamp-2 text-sm leading-snug font-semibold">
                {item.product.title}
              </span>
              <span className="text-sm font-bold tabular-nums">
                {formatMoney(item.product.priceCents, item.product.currency)}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {item.product.sellerName}
              </span>
            </Link>
            {isSignedIn && look.id ? (
              <span className="-ml-1 flex flex-wrap">
                <SwapButton lookId={look.id} slot={item.slot}>
                  Otra opción
                </SwapButton>
                <SwapButton lookId={look.id} slot={item.slot} direction="cheaper">
                  Más barato
                </SwapButton>
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <footer className="flex flex-wrap items-center gap-2">
        {tryOnAvailable ? (
          <Link href={tryOnHref} className={cn(buttonVariants({ size: "lg" }), "h-10 font-bold")}>
            Pruébatelo
          </Link>
        ) : null}
        {isSignedIn && look.id ? <BuyLookButton lookId={look.id} /> : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {look.items.length === 1 ? "1 pieza" : `${look.items.length} piezas`} · cada una se compra
          a quien la vende
        </span>
      </footer>
    </article>
  );
}
