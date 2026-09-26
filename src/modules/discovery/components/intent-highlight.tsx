import { ChevronRight, ShoppingBag, Target } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import type { IntentHighlightDTO } from "../dto";
import { DismissIntentButton, DismissibleIntent } from "./dismissible-intent";
import { RailSection } from "./rail-section";

/**
 * «Lo que buscas»: lo que la persona declaró buscar, su presupuesto y el mejor producto que cabe en
 * él (lo eligió el servidor, P2). Sin coincidencias, una frase honesta en lugar de un relleno.
 * Si ese producto ya está en la primera página del feed (`productInFeed`), no se repite: se dice
 * que ya está en su feed y se ofrece buscar más.
 */
export function IntentHighlight({
  intent,
  productInFeed = false,
}: {
  intent: IntentHighlightDTO;
  productInFeed?: boolean;
}) {
  const hasBudget = intent.budgetMaxCents !== null;
  const details = [
    hasBudget ? `Hasta ${formatMoney(intent.budgetMaxCents!, intent.currency)}` : null,
    savedWhen(intent),
  ]
    .filter(Boolean)
    .join(" · ");
  const product = intent.product;

  return (
    <DismissibleIntent intentId={intent.id}>
      <RailSection
        id="columna-lo-que-buscas"
        title="Lo que buscas"
        icon={Target}
        action={<DismissIntentButton query={intent.query} />}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingBag aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="leading-tight font-bold break-words first-letter:uppercase">
              {intent.query}
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{details}</p>
          </div>
        </div>

        {product && productInFeed ? (
          <p className="mt-3 rounded-2xl bg-secondary px-3 py-2.5 text-sm leading-snug text-ink-2">
            Lo que mejor coincide ya está en tu feed.{" "}
            <Link
              href={`/buscar?q=${encodeURIComponent(intent.query)}` as Route}
              className="font-semibold text-primary-text underline-offset-2 hover:underline"
            >
              Buscar más opciones
            </Link>
          </p>
        ) : product ? (
          <Link
            href={`/producto/${product.slug}` as Route}
            className="mt-3 flex items-center gap-3 rounded-2xl border p-2 transition-colors hover:bg-secondary"
          >
            <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
              {product.image ? (
                <Image
                  src={product.image.url}
                  // El título visible ya nombra el producto.
                  alt=""
                  fill
                  sizes="56px"
                  style={{ objectFit: "cover" }}
                />
              ) : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="line-clamp-2 text-sm leading-snug font-semibold">
                {product.title}
              </span>
              <span className="text-xs text-muted-foreground">
                <span className="font-heading text-sm font-extrabold text-foreground">
                  {formatMoney(product.priceCents, product.currency)}
                </span>
                {hasBudget ? (
                  <>
                    {" · "}
                    <span className="font-semibold text-success">En tu presupuesto</span>
                  </>
                ) : null}
              </span>
              <span className="truncate text-xs text-muted-foreground">{product.city}</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ) : (
          <p className="mt-3 rounded-2xl bg-secondary px-3 py-2.5 text-sm leading-snug text-ink-2">
            Todavía no hay productos que coincidan
            {hasBudget ? " dentro de tu presupuesto" : ""}. Te los mostraremos aquí en cuanto
            aparezcan.
          </p>
        )}
      </RailSection>
    </DismissibleIntent>
  );
}

/** De dónde salió la intención, sin atribuirle a la persona algo que no hizo. */
function savedWhen(intent: IntentHighlightDTO) {
  const when = formatRelativeTime(new Date(intent.createdAt));
  switch (intent.source) {
    case "ONBOARDING":
      return "la guardaste al registrarte";
    case "SEARCH":
      return `la buscaste ${when}`;
    case "AI_COMPANION":
      return `la guardaste ${when}`;
  }
}
