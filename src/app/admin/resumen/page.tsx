import { CircleAlert, Snowflake, Sparkles } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { getAdminViewer, requireAdmin } from "@/modules/admin/guard";
import { AutonomyToggle } from "@/modules/ceo/components/autonomy-toggle";
import { RiskBadge, StatusBadge } from "@/modules/ceo/components/badges";
import { CeoSubnav } from "@/modules/ceo/components/ceo-subnav";
import { formatDay } from "@/modules/ceo/labels";
import { getCeoWeeklyReport } from "@/modules/ceo/service";

/** Solo ADMIN recibe título; a los demás, el 404 sin metadatos propios (ver layout de /admin). */
export async function generateMetadata(): Promise<Metadata> {
  return (await getAdminViewer()) ? { title: "Reporte semanal" } : {};
}

const integer = new Intl.NumberFormat("es-MX");
const decimal = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

const JOB_LABELS: Record<string, string> = {
  "ops-daily": "Operación diaria",
  "daily-metrics": "Métricas diarias",
  experiments: "Experimentos",
  guardrails: "Salvaguardas",
  analyst: "Analista",
  "expire-checkouts": "Checkouts vencidos",
  "orphan-media": "Imágenes huérfanas",
  "ai-input-redaction": "Retención de entradas de IA",
};

const JOB_STATUS: Record<string, string> = {
  RUNNING: "Corriendo",
  SUCCEEDED: "Bien",
  FAILED: "Falló",
};

function Section({
  title,
  id,
  children,
  className,
}: {
  title: string;
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("flex flex-col gap-3 rounded-card border bg-card p-4 md:p-5", className)}
    >
      <h2 id={id} className="font-heading text-lg font-bold tracking-heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function WeeklyReportPage() {
  const admin = await requireAdmin();
  const report = await getCeoWeeklyReport(admin.userId);
  const { autonomy, freeze, counts, ai } = report;
  const threshold = autonomy.threshold;
  const assumptions = autonomy.assumptions;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reporte semanal"
        description={`Del ${formatDay(report.period.from)} al ${formatDay(report.period.to)}: qué cambió, por qué, su impacto, el costo de IA y la cobertura. Todas las cifras las calcula el código.`}
        className="px-0 pt-0 pb-0"
      />
      <CeoSubnav current="/admin/resumen" />

      {report.alerts.length > 0 ? (
        <ul role="status" className="flex flex-col gap-2">
          {report.alerts.map((alert) => (
            <li
              key={alert}
              className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {alert}
            </li>
          ))}
        </ul>
      ) : null}

      <Section title="Autonomía" id="autonomia">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Modo actual</p>
            <p className="font-heading text-2xl font-extrabold" data-testid="autonomy-mode">
              {autonomy.label}
            </p>
          </div>
          <AutonomyToggle
            mode={autonomy.mode}
            thresholdMet={threshold.met}
            thresholdReason={threshold.reason}
          />
        </div>
        <p className="text-sm text-ink-2">
          {autonomy.mode === "observer"
            ? "La IA solo propone. Nada se aplica ni se prueba sin tu aprobación."
            : "Lo de riesgo bajo se aplica solo y lo de riesgo medio se prueba al 10 %, siempre que se cumpla el umbral de tráfico y fuera de congelamientos. Lo de riesgo alto nunca se aplica solo."}
        </p>
        <div
          className={cn(
            "flex flex-col gap-1 rounded-2xl px-3 py-2 text-sm",
            threshold.met ? "bg-success/10 text-success" : "bg-secondary",
          )}
        >
          <p className="font-semibold">
            Umbral de tráfico: {threshold.met ? "cumplido" : "no cumplido"}
          </p>
          <p>{threshold.reason}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Muestra mínima: {integer.format(assumptions.minSamplePerVariant)} impresiones por variante
          para detectar +{decimal.format(assumptions.relativeLift * 100)} % sobre una tasa base de{" "}
          {decimal.format(assumptions.baselineRate * 100)} %{" "}
          {assumptions.baselineRateSource === "measured" ? "(medida)" : "(supuesta)"}, con{" "}
          {decimal.format(assumptions.impressionsPerPerson)} impresiones por persona en 14 días{" "}
          {assumptions.impressionsPerPersonSource === "measured" ? "(medidas)" : "(supuestas)"} y ρ
          = {decimal.format(assumptions.icc)}: efecto de diseño{" "}
          {decimal.format(assumptions.designEffect)}. El umbral cuenta solo impresiones de personas
          con sesión (las únicas que entran a un experimento).
        </p>
        <p className="flex items-start gap-2 text-sm">
          <Snowflake className="mt-0.5 size-4 shrink-0" />
          {freeze.active
            ? `Congelamiento activo (${freeze.active.name}): nada cambia solo hasta el ${formatDay(freeze.active.to)}.`
            : `Próximo congelamiento: ${freeze.next.name}, del ${formatDay(freeze.next.from)} al ${formatDay(freeze.next.to)}.`}
        </p>
      </Section>

      <Section title="Qué cambió y por qué" id="cambios">
        <p className="text-sm text-muted-foreground">
          Esta semana: {integer.format(counts.proposed)} propuestas nuevas,{" "}
          {integer.format(counts.applied)} aplicadas ({integer.format(counts.autoApplied)} solas),{" "}
          {integer.format(counts.reverted)} revertidas.{" "}
          <Link
            href={"/admin/decisiones" as Route}
            className="font-semibold text-primary-text underline-offset-4 hover:underline"
          >
            {integer.format(counts.pending)} pendientes de revisar
          </Link>
          .
        </p>
        {report.changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ningún ajuste cambió en los últimos 7 días.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {report.changes.map((change) => (
              <li key={change.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={change.status} label={change.statusLabel} />
                  <RiskBadge risk={change.risk} label={change.riskLabel} />
                  {change.autoApplied ? (
                    <span className="text-xs text-muted-foreground">Aplicada sola</span>
                  ) : null}
                </div>
                <p className="font-semibold">{change.title}</p>
                {change.reason ? <p className="text-sm text-ink-2">{change.reason}</p> : null}
                {change.impact ? (
                  <p className="text-sm text-muted-foreground">
                    {change.impact.label}: {change.impact.baseline} → {change.impact.observed}
                    {change.impact.change ? ` (${change.impact.change})` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Métricas de la semana" id="metricas">
        <p className="text-xs text-muted-foreground">
          Últimos 7 días completos contra los 7 anteriores, con la muestra detrás de cada valor.
        </p>
        <ul className="flex flex-col divide-y">
          {report.metrics.map((metric) => (
            <li
              key={metric.key}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 md:flex-row md:items-start md:gap-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">{metric.label}</span>
                <span className="text-xs text-muted-foreground">{metric.definition}</span>
              </div>
              <dl className="grid grid-cols-4 gap-2 text-sm md:w-[26rem] md:shrink-0 md:text-right">
                <div>
                  <dt className="text-xs text-muted-foreground">Esta semana</dt>
                  <dd className="font-semibold whitespace-nowrap">{metric.current}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Anterior</dt>
                  <dd className="whitespace-nowrap text-muted-foreground">{metric.previous}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Cambio</dt>
                  <dd
                    className={cn(
                      "whitespace-nowrap",
                      metric.improved === true && "text-success",
                      metric.improved === false && "text-destructive",
                    )}
                  >
                    {metric.change ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Muestra</dt>
                  <dd className="whitespace-nowrap text-muted-foreground">
                    {integer.format(metric.sample)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          «—» = sin datos suficientes. Los errores 5xx aún no se registran, así que su salvaguarda
          aparece «sin datos».
        </p>
      </Section>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Costo de IA contra el tope" id="ia">
          <p className="inline-flex w-fit items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-ink-2">
            <Sparkles className="size-3" /> IA
          </p>
          <p className="font-heading text-2xl font-extrabold">
            {ai.costMonth}{" "}
            <span className="text-base font-medium text-muted-foreground">de {ai.limitMonth}</span>
          </p>
          <div
            role="progressbar"
            aria-label="Tope de IA usado este mes"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(1, ai.usedRatio ?? 0) * 100)}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full",
                (ai.usedRatio ?? 0) >= 0.8 ? "bg-destructive" : "bg-foreground",
              )}
              style={{ width: `${Math.min(1, ai.usedRatio ?? 0) * 100}%` }}
            />
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Tope usado</dt>
              <dd className="font-semibold">{ai.usedShare}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ingresos de plataforma del mes</dt>
              <dd className="font-semibold">{ai.revenueMonth}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Cobertura (ingresos ÷ costo de IA)</dt>
              <dd className="font-semibold">{ai.coverage}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Mes calendario en UTC, como el guardián de presupuesto. El gasto y el tope no los toca
            el motor: son decisiones humanas.
          </p>
        </Section>

        <Section title="Ajustes vigentes del feed" id="ajustes">
          <ul className="flex flex-col divide-y text-sm">
            {report.tunables.map((tunable) => (
              <li key={tunable.label} className="flex items-center justify-between gap-3 py-2">
                <span>{tunable.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{tunable.value}</span>
                  <span className="text-xs text-muted-foreground">{tunable.risk}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Tareas programadas" id="tareas">
        {report.jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no corre ninguna. Ejecuta <code>pnpm ops:daily</code> o configura el cron de{" "}
            <code>/api/cron/daily</code>.
          </p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {report.jobs.map((job) => (
              <li key={job.job} className="flex flex-col gap-0.5 py-2">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{JOB_LABELS[job.job] ?? job.job}</span>
                  <span
                    className={cn(
                      job.status === "FAILED" && "text-destructive",
                      job.status === "SUCCEEDED" && "text-success",
                    )}
                  >
                    {JOB_STATUS[job.status] ?? job.status}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {job.startedAt}
                  {job.error ? ` · ${job.error}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
