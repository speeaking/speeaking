"use client";

import {
  Calculator,
  Copy,
  Lightbulb,
  MessageSquareQuote,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import type { ProposalState } from "../actions";

type Result = NonNullable<ProposalState["result"]>;

function Card({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold">
          <Icon className="size-5" />
          {title}
        </h3>
        {badge ? (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground uppercase">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function CopyLine({ text }: { text: string }) {
  return (
    <li className="flex items-start justify-between gap-2 rounded-2xl bg-secondary px-3 py-2 text-sm">
      <span>{text}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Copiar texto"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          toast.success("Copiado");
        }}
      >
        <Copy />
      </Button>
    </li>
  );
}

/** Propuesta de "Vende con IA": separa lo CALCULADO (código, P2) de las HIPÓTESIS de la IA. */
export function ProposalView({ result, onReset }: { result: Result; onReset: () => void }) {
  const { proposal, numbers, quantity } = result;
  const { economics } = numbers;
  const daily = proposal.suggestedDailyBudgetCents;

  return (
    <div className="flex flex-col gap-4">
      <section className="dark flex flex-col gap-2 rounded-3xl border bg-card p-5 text-foreground">
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-ai px-2.5 py-1 text-xs font-bold text-ai-foreground">
          <Sparkles className="size-3.5" />
          Propuesta de IA · revísala antes de publicar
        </span>
        <h2 className="font-heading text-2xl leading-tight font-extrabold">{proposal.headline}</h2>
        <p className="text-sm text-ink-2">{proposal.valueProposition}</p>
      </section>

      <Card icon={Calculator} title="Tus números" badge="Calculado, no estimado">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Ganas por pieza</dt>
            <dd
              className={
                economics.isLoss
                  ? "font-heading text-xl font-extrabold text-destructive"
                  : "font-heading text-xl font-extrabold"
              }
            >
              {formatMoney(economics.grossMarginCents)} ({economics.grossMarginPercent.toFixed(1)}{" "}
              %)
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Si vendes las {quantity}</dt>
            <dd className="font-heading text-xl font-extrabold">
              {formatMoney(numbers.potentialProfitCents)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tu inversión</dt>
            <dd className="font-heading text-xl font-extrabold">
              {formatMoney(numbers.investmentCents)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Para cubrir {formatMoney(daily)}/día × 7 días</dt>
            <dd className="font-heading text-xl font-extrabold">
              {numbers.breakEvenWeek === null ? "Sin margen" : `${numbers.breakEvenWeek} ventas`}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Con tu precio y costo exactos. Aún no incluye envío ni comisiones del procesador de pago.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card icon={Target} title="Precio sugerido" badge="Hipótesis">
          <p className="font-heading text-xl font-extrabold">
            {formatMoney(proposal.suggestedPriceRange.minCents)} –{" "}
            {formatMoney(proposal.suggestedPriceRange.maxCents)}
          </p>
          <p className="text-sm text-muted-foreground">{proposal.suggestedPriceRange.rationale}</p>
        </Card>
        <Card icon={Target} title="Presupuesto inicial" badge="Hipótesis">
          <p className="font-heading text-xl font-extrabold">{formatMoney(daily)} al día</p>
          <p className="text-sm text-muted-foreground">{proposal.budgetRationale}</p>
        </Card>
      </div>

      <Card icon={Users} title="Público potencial" badge="Hipótesis">
        <ul className="flex flex-col gap-2 text-sm">
          {proposal.targetAudiences.map((audience) => (
            <li key={audience.name}>
              <span className="font-semibold">{audience.name}:</span> {audience.why}
            </li>
          ))}
        </ul>
      </Card>

      <Card icon={Lightbulb} title="Ideas de contenido">
        <ul className="flex flex-col gap-2">
          {proposal.contentIdeas.map((idea) => (
            <CopyLine key={idea} text={idea} />
          ))}
        </ul>
        <div className="rounded-2xl border border-dashed p-3 text-sm">
          <p className="mb-1 font-semibold">Guion de video de 15 segundos</p>
          <p className="text-muted-foreground">{proposal.videoScript}</p>
        </div>
      </Card>

      <Card icon={MessageSquareQuote} title="Textos para anuncios y WhatsApp">
        <ul className="flex flex-col gap-2">
          {proposal.adIdeas.map((ad) => (
            <CopyLine key={ad} text={ad} />
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {proposal.ctas.map((cta) => (
            <span key={cta} className="rounded-full border px-3 py-1 text-sm">
              {cta}
            </span>
          ))}
        </div>
      </Card>

      <Card icon={MessageSquareQuote} title="Lo que te van a preguntar">
        <ul className="flex flex-col gap-3 text-sm">
          {proposal.objections.map((item) => (
            <li key={item.objection}>
              <p className="font-semibold">“{item.objection}”</p>
              <p className="text-muted-foreground">{item.answer}</p>
            </li>
          ))}
        </ul>
      </Card>

      <section className="rounded-3xl bg-secondary p-4 text-sm">
        <p className="mb-1 font-semibold">Supuestos de esta propuesta</p>
        <ul className="ml-5 list-disc text-muted-foreground">
          {proposal.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/studio/productos/nuevo?propuesta=${result.responseId}` as Route}
          className={buttonVariants({ size: "lg", className: "h-12 flex-1 text-base" })}
        >
          <Sparkles data-icon="inline-start" />
          Crear producto con esta propuesta
        </Link>
        <Button type="button" variant="outline" size="lg" className="h-12" onClick={onReset}>
          Hacer otra propuesta
        </Button>
      </div>
    </div>
  );
}
