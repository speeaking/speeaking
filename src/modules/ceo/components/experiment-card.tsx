import { ArrowRight } from "lucide-react";
import { startExperimentAction, stopExperimentAction } from "../actions";
import type { ExperimentDTO } from "../queries";
import { StatusBadge } from "./badges";
import { ConfirmAction } from "./confirm-action";

const integer = new Intl.NumberFormat("es-MX");

function Progress({ label, value, target }: { label: string; value: number; target: number }) {
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {integer.format(value)} de {integer.format(target)} impresiones
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Muestra de ${label.toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(value, target)}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-foreground" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

/** Tarjeta de un experimento: variantes, progreso de la muestra, resultado y acciones. */
export function ExperimentCard({ experiment }: { experiment: ExperimentDTO }) {
  return (
    <article
      aria-labelledby={`experiment-${experiment.id}`}
      className="flex flex-col gap-4 rounded-card border bg-card p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={experiment.status} label={experiment.statusLabel} />
        <span className="text-xs text-muted-foreground">
          {experiment.allocation} al tratamiento · {experiment.key}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <h2
          id={`experiment-${experiment.id}`}
          className="font-heading text-lg font-bold tracking-title"
        >
          {experiment.settingLabel}
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Control</span>
          <span className="font-semibold">{experiment.control}</span>
          <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Tratamiento</span>
          <span className="font-semibold">{experiment.treatment}</span>
        </p>
        <p className="text-sm text-ink-2">{experiment.hypothesis}</p>
        <p className="text-sm">
          <span className="font-semibold">Métrica principal: </span>
          {experiment.primaryMetric}
        </p>
      </div>

      {experiment.progress ? (
        <div className="flex flex-col gap-2">
          <Progress
            label="Control"
            value={experiment.progress.control}
            target={experiment.minSamplePerVariant}
          />
          <Progress
            label="Tratamiento"
            value={experiment.progress.treatment}
            target={experiment.minSamplePerVariant}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Muestra mínima: {integer.format(experiment.minSamplePerVariant)} impresiones por variante.
          Aún sin evaluar.
        </p>
      )}

      {experiment.comparison ? (
        <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Cambio</dt>
            <dd className="font-semibold">{experiment.comparison.change}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Intervalo de 95 %</dt>
            <dd className="font-semibold">{experiment.comparison.interval}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Valor p</dt>
            <dd className="font-semibold">{experiment.comparison.pValue}</dd>
          </div>
        </dl>
      ) : null}

      {experiment.verdict ? (
        <p className="rounded-xl bg-secondary px-3 py-2 text-sm">{experiment.verdict}</p>
      ) : null}
      {experiment.guardrailChecks.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-destructive">
          {experiment.guardrailChecks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Inicio: {experiment.startedAt} · Fin: {experiment.endedAt}
        {experiment.origin ? ` · Propuesta: ${experiment.origin}` : ""}
      </p>

      {experiment.actions.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {experiment.actions.includes("start") ? (
            <ConfirmAction
              action={startExperimentAction}
              fields={{ experimentId: experiment.id }}
              triggerLabel="Iniciar"
              triggerVariant="default"
              title="Iniciar experimento"
              description={`El ${experiment.allocation} de las personas con sesión verá ${experiment.settingLabel.toLowerCase()} en ${experiment.treatment}. Las salvaguardas lo detienen solas si alguna se rompe en el tratamiento tras la exposición mínima.`}
              confirmLabel="Iniciar"
            />
          ) : null}
          {experiment.actions.includes("stop") ? (
            <ConfirmAction
              action={stopExperimentAction}
              fields={{ experimentId: experiment.id }}
              triggerLabel="Detener"
              triggerVariant="destructive"
              title="Detener experimento"
              description="Todas las personas vuelven al valor actual de inmediato. El resultado hasta hoy queda guardado."
              confirmLabel="Detener"
              confirmVariant="destructive"
              withNote
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
