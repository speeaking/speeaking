"use client";

import {
  Calculator,
  Copy,
  Lightbulb,
  MessageSquareQuote,
  ShieldCheck,
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
import { DAILY_BUDGET_RULE, PRICE_RANGE_RULE } from "../proposal-numbers";
import { SIMULATED_OUTPUT_LABEL } from "../tasks/simulation";

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

/** Explicación que redactó la IA para una cifra calculada: se muestra como suya (principio 5). */
function AiNote({ text, simulated }: { text: string; simulated: boolean }) {
  if (!text) return null;
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-semibold">{simulated ? "Nota de ejemplo:" : "Nota de la IA:"}</span>{" "}
      {text}
    </p>
  );
}

const percent = (value: number) => `${Math.round(Math.abs(value) * 100)} %`;

/**
 * Propuesta de "Sube y vende": separa lo CALCULADO (código, P2) de lo que REDACTÓ la IA. Todas las
 * cifras salen del código con tus datos (SEC-28); la IA solo escribe textos e hipótesis. Con la IA
 * simulada de un piloto (`simulated`, ADR-038) los textos se marcan como ejemplo, nunca como de la IA.
 */
export function ProposalView({
  result,
  onReset,
  simulated = false,
}: {
  result: Result;
  onReset: () => void;
  simulated?: boolean;
}) {
  const { proposal, numbers, quantity, guard } = result;
  const { economics } = numbers;
  const daily = numbers.dailyBudgetCents;
  const written = simulated ? "Ejemplo (IA simulada)" : "Redactado por IA";

  return (
    <div className="flex flex-col gap-4">
      <section className="dark flex flex-col gap-2 rounded-3xl border bg-card p-5 text-foreground">
        {simulated ? (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {SIMULATED_OUTPUT_LABEL} · revísalo antes de publicar
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-ai px-2.5 py-1 text-xs font-bold text-ai-foreground">
            <Sparkles className="size-3.5" />
            Propuesta de IA · revísala antes de publicar
          </span>
        )}
        <h2 className="font-heading text-2xl leading-tight font-extrabold">{proposal.headline}</h2>
        <p className="text-sm text-ink-2">{proposal.valueProposition}</p>
      </section>

      {guard.removed > 0 ? (
        <p className="flex items-start gap-2 rounded-2xl bg-secondary px-3 py-2 text-sm">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {guard.removed === 1 ? "Quitamos 1 frase" : `Quitamos ${guard.removed} frases`} que{" "}
            {simulated ? "no podíamos" : "la IA no podía"} respaldar con tus datos: garantías,
            envíos o tiempos que no confirmaste, datos de contacto o de pago, urgencia o cifras
            distintas a las tuyas.
          </span>
        </p>
      ) : null}

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
        <Card icon={Target} title="Precio para probar" badge="Calculado">
          <p className="font-heading text-xl font-extrabold">
            {formatMoney(proposal.suggestedPriceRange.minCents)} –{" "}
            {formatMoney(proposal.suggestedPriceRange.maxCents)}
          </p>
          <p className="text-sm text-muted-foreground">
            {percent(1 - PRICE_RANGE_RULE.below)} abajo y {percent(PRICE_RANGE_RULE.above - 1)}{" "}
            arriba de tu precio, terminado en 9. No consultamos precios del mercado.
          </p>
          <AiNote text={proposal.suggestedPriceRange.rationale} simulated={simulated} />
        </Card>
        <Card icon={Target} title="Presupuesto inicial" badge="Calculado">
          <p className="font-heading text-xl font-extrabold">{formatMoney(daily)} al día</p>
          <p className="text-sm text-muted-foreground">
            {percent(DAILY_BUDGET_RULE.share)} de lo que ganas por pieza, entre{" "}
            {formatMoney(DAILY_BUDGET_RULE.minCents)} y {formatMoney(DAILY_BUDGET_RULE.maxCents)} al
            día. Es una prueba, no una garantía de ventas.
          </p>
          <AiNote text={proposal.budgetRationale} simulated={simulated} />
        </Card>
      </div>

      <Card
        icon={Users}
        title="Público potencial"
        badge={simulated ? "Ejemplo (IA simulada)" : "Hipótesis de la IA"}
      >
        <ul className="flex flex-col gap-2 text-sm">
          {proposal.targetAudiences.map((audience) => (
            <li key={audience.name}>
              <span className="font-semibold">{audience.name}:</span> {audience.why}
            </li>
          ))}
        </ul>
      </Card>

      <Card icon={Lightbulb} title="Ideas de contenido" badge={written}>
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

      <Card icon={MessageSquareQuote} title="Textos para anuncios y WhatsApp" badge={written}>
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

      <Card icon={MessageSquareQuote} title="Lo que te van a preguntar" badge={written}>
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
