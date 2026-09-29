import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { approveDecisionAction, rejectDecisionAction, revertDecisionAction } from "../actions";
import type { DecisionDTO } from "../queries";
import { Pill, RiskBadge, StatusBadge } from "./badges";
import { ConfirmAction } from "./confirm-action";

function approveDescription(decision: DecisionDTO): string {
  if (decision.proposalOnly) {
    return "Es solo propuesta: el sistema no cambia nada. Al aprobarla queda registrada y te toca ejecutarla a ti.";
  }
  const change = decision.setting
    ? `${decision.setting.label}: ${decision.setting.from} → ${decision.setting.to}.`
    : "";
  if (decision.risk === "LOW") {
    return `Se aplica ahora para todas las personas. ${change} Las salvaguardas la vigilan y la revierten sola si alguna se rompe tras la exposición mínima.`;
  }
  if (decision.approveLabel === "Adoptar") {
    return `Se adopta para todas las personas con la evidencia del experimento. ${change} Las salvaguardas la vigilan después.`;
  }
  return `Se prueba con el 10 % de las personas con sesión. ${change} Adoptarlo requerirá otra aprobación tuya.`;
}

function guardrailStatusText(guardrails: NonNullable<DecisionDTO["guardrails"]>) {
  if (guardrails.status === "breached") return "rotas";
  if (guardrails.conclusion === "no_harm") return "vigilancia terminada, sin daño detectado";
  if (guardrails.conclusion === "no_evidence") {
    return "vigilancia cerrada, sin evidencia de daño con esta muestra";
  }
  return guardrails.status === "pending" ? "esperando exposición mínima" : "sin problemas";
}

/** Tarjeta de una decisión del motor de automejora (propuesta, cambio aplicado o revertido). */
export function DecisionCard({ decision }: { decision: DecisionDTO }) {
  return (
    <article
      aria-labelledby={`decision-${decision.id}`}
      className="flex flex-col gap-4 rounded-card border bg-card p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={decision.status} label={decision.statusLabel} />
        <RiskBadge risk={decision.risk} label={decision.riskLabel} />
        {decision.proposalOnly ? <Pill>Solo propuesta</Pill> : null}
        {decision.handledIn ? <Pill>{decision.handledIn.label}</Pill> : null}
        {decision.autoApplied ? <Pill>Aplicada sola</Pill> : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {decision.actorLabel} · {decision.createdAt}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h2
          id={`decision-${decision.id}`}
          className="font-heading text-lg font-bold tracking-title"
        >
          {decision.title}
        </h2>
        {decision.setting ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{decision.setting.label}:</span>
            <span className="font-semibold">{decision.setting.from}</span>
            <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
            <span className="sr-only">a</span>
            <span className="font-semibold">{decision.setting.to}</span>
          </p>
        ) : null}
        <p className="text-sm text-ink-2">{decision.hypothesis}</p>
        {decision.expectedImpact ? (
          <p className="text-sm">
            <span className="font-semibold">Impacto esperado: </span>
            {decision.expectedImpact}
          </p>
        ) : null}
      </div>

      {decision.narrative?.source === "ai" ? (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-muted p-3 text-sm">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-ink-2">
            <Sparkles className="size-3" /> Redactado por IA
          </span>
          <p>{decision.narrative.text}</p>
        </div>
      ) : null}

      {decision.handledIn ? (
        <p className="rounded-xl bg-secondary px-3 py-2 text-sm">
          No se aprueba desde aquí: se revisa y, si procede, se aplica en{" "}
          <Link
            href={decision.handledIn.href}
            className="inline-flex items-center gap-1 font-semibold text-primary-text underline-offset-4 hover:underline"
          >
            {decision.handledIn.href}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
          , con la evaluación del modelo como evidencia.
        </p>
      ) : null}

      {decision.reason ? (
        <p className="rounded-xl bg-secondary px-3 py-2 text-sm">
          <span className="font-semibold">Motivo: </span>
          {decision.reason}
        </p>
      ) : null}

      {decision.impact ? (
        <p className="text-sm">
          <span className="font-semibold">Medido ({decision.impact.label}): </span>
          {decision.impact.baseline} antes → {decision.impact.observed} después
          {decision.impact.change ? ` (${decision.impact.change})` : ""}.
        </p>
      ) : null}

      {decision.experiment ? (
        <p className="text-sm text-muted-foreground">
          Experimento {decision.experiment.key} · {decision.experiment.statusLabel}
        </p>
      ) : null}

      {decision.guardrails ? (
        <details className="group rounded-2xl border px-3 py-2 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold">
            <ShieldCheck className="size-4" />
            Salvaguardas: {guardrailStatusText(decision.guardrails)}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
            {decision.guardrails.checks.map((check) => (
              <li
                key={check.summary}
                className={check.verdict === "breach" ? "text-destructive" : undefined}
              >
                {check.summary}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {decision.trail.length > 0 ? (
        <details className="rounded-2xl border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold">Bitácora</summary>
          <ol className="mt-2 flex flex-col gap-1.5">
            {decision.trail.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="text-muted-foreground">
                <span className="text-foreground">{entry.action}</span> · {entry.actor} · {entry.at}
                {entry.note ? <span className="block">{entry.note}</span> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {decision.approvedBy ? (
        <p className="text-xs text-muted-foreground">Decidió: {decision.approvedBy}</p>
      ) : null}

      {decision.actions.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {decision.actions.includes("approve") && decision.approveLabel ? (
            <ConfirmAction
              action={approveDecisionAction}
              fields={{ decisionId: decision.id }}
              triggerLabel={decision.approveLabel}
              triggerVariant="default"
              title={decision.approveLabel}
              description={approveDescription(decision)}
              confirmLabel="Confirmar"
              withNote
            />
          ) : null}
          {decision.actions.includes("reject") ? (
            <ConfirmAction
              action={rejectDecisionAction}
              fields={{ decisionId: decision.id }}
              triggerLabel="Rechazar"
              title="Rechazar propuesta"
              description="No se cambia nada. La propuesta queda en la bitácora como rechazada."
              confirmLabel="Rechazar"
              confirmVariant="destructive"
              withNote
            />
          ) : null}
          {decision.actions.includes("revert") ? (
            <ConfirmAction
              action={revertDecisionAction}
              fields={{ decisionId: decision.id }}
              triggerLabel="Revertir"
              triggerVariant="destructive"
              title="Revertir cambio"
              description={
                decision.setting
                  ? `${decision.setting.label} vuelve a ${decision.setting.from} para todas las personas.`
                  : "El ajuste vuelve a su valor anterior."
              }
              confirmLabel="Revertir"
              confirmVariant="destructive"
              withNote
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
