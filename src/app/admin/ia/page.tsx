import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { getAdminViewer, requireAdmin } from "@/modules/admin/guard";
import { getAdminAiOverview } from "@/modules/ai/admin-overview";
import { FeatureToggles } from "@/modules/ai/components/feature-toggles";
import { ProposalDiscardForm } from "@/modules/ai/components/proposal-discard-form";
import { AI_FEATURES, isAiFeatureEnabled } from "@/modules/ai/features";
import { getAiFeatures } from "@/modules/ai/features-store";
import { RoutingForm } from "@/modules/ai/components/routing-form";
import { formatUsdMicros } from "@/modules/ai/evals/report";
import { closeStaleAiRoutingProposals } from "@/modules/ai/routing-decisions";

/** El título solo lo recibe ADMIN; a cualquier otra persona, el mismo 404 sin metadatos. */
export async function generateMetadata(): Promise<Metadata> {
  return (await getAdminViewer()) ? { title: "IA" } : {};
}

const dateTime = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

const SOURCE: Record<"routing" | "default" | "fallback", string> = {
  routing: "Elegido en esta página",
  default: "Predeterminado (variables de entorno)",
  fallback: "Simulado: falta configurar el servidor de IA",
};

const STATUS: Record<string, string> = {
  PENDING: "En curso",
  SUCCEEDED: "Respondidas",
  FAILED: "Fallidas",
  BLOCKED_BUDGET: "Bloqueadas por presupuesto",
  PROPOSED: "Propuesta pendiente",
  APPROVED: "Aprobada",
  // Aquí una propuesta solo se rechaza al descartarla (una persona) o al cerrarse sola (sistema).
  REJECTED: "Descartada",
  APPLIED: "Aplicada",
  REVERTED: "Revertida",
};

/**
 * Quién originó la decisión. Una propuesta de la IA que se aplicó aquí la aplicó una persona: la IA
 * nunca cambia el modelo sola, así que nunca se muestra como «IA · Aplicada».
 */
const ACTOR: Record<"AI" | "HUMAN" | "SYSTEM", string> = {
  AI: "Propuesta de la IA",
  HUMAN: "Persona",
  SYSTEM: "Sistema",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border bg-card p-4 md:p-5">
      <div>
        <h2 className="font-heading text-lg font-bold tracking-heading">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function perMillion(price: { input: number; output: number } | null) {
  if (!price) return "Sin precio";
  return `US$${price.input} / US$${price.output} por millón de tokens`;
}

export default async function AdminAiPage() {
  const admin = await requireAdmin();
  // Las propuestas que ya no cambiarían nada (la tarea ya usa ese modelo) se cierran solas antes de
  // mostrarse: nunca queda pendiente algo que no hay que aplicar. Es limpieza: si falla (candado
  // ocupado, base lenta), la página se muestra igual y esas propuestas se pueden descartar a mano.
  try {
    await closeStaleAiRoutingProposals();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[ai] no se pudieron cerrar las propuestas sin nada que aplicar", error);
  }
  const [overview, features] = await Promise.all([
    getAdminAiOverview(admin.userId),
    getAiFeatures(),
  ]);
  const { spend } = overview;
  const usedShare = spend.limitMicros > 0 ? spend.committedMicros / spend.limitMicros : 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="IA"
        description="Qué modelo usa cada tarea, cómo le fue en su evaluación y cuánto va del presupuesto del mes. Cambiar un modelo es de riesgo medio: queda en la bitácora de decisiones."
        className="px-0"
      />

      <Section
        title="Gasto del mes"
        description="Calculado por código con el costo de cada solicitud. «Comprometido» suma el costo máximo de las solicitudes en curso o fallidas."
      >
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Gastado</dt>
            <dd className="font-heading text-xl font-extrabold">
              {formatUsdMicros(spend.answeredMicros)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Comprometido</dt>
            <dd className="font-heading text-xl font-extrabold">
              {formatUsdMicros(spend.committedMicros)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Límite del mes</dt>
            <dd className="font-heading text-xl font-extrabold">
              {formatUsdMicros(spend.limitMicros)}
            </dd>
          </div>
        </dl>
        <div
          role="meter"
          aria-label="Presupuesto de IA comprometido"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round(usedShare * 100))}
          className="h-2 overflow-hidden rounded-full bg-secondary"
        >
          <div
            className={cn("h-full", usedShare >= 0.9 ? "bg-destructive" : "bg-foreground")}
            style={{ width: `${Math.min(100, usedShare * 100)}%` }}
          />
        </div>
        {spend.byFeature.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Función</th>
                <th className="py-1 text-right font-medium">Solicitudes</th>
                <th className="py-1 text-right font-medium">Costo</th>
              </tr>
            </thead>
            <tbody>
              {spend.byFeature.map((row) => (
                <tr key={row.label} className="border-t">
                  <td className="py-1.5">{row.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.requests}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatUsdMicros(row.costMicros)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay solicitudes de IA este mes.</p>
        )}
        {spend.requests.length ? (
          <p className="text-xs text-muted-foreground">
            {spend.requests
              .map((row) => `${STATUS[row.status] ?? row.status}: ${row.count}`)
              .join(" · ")}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Servidor de IA:{" "}
          {overview.provider.host
            ? `${overview.provider.host} (pago por uso; modelo predeterminado ${overview.provider.defaultModel})`
            : "simulado (AI_PROVIDER=mock, sin costo)"}
          . Pon el mismo límite de gasto en la consola del proveedor.
        </p>
      </Section>

      <Section
        title="Modelo por tarea"
        description="Elige para cada tarea el modelo más barato que haya pasado su evaluación: nada cambia solo. La IA puede proponer un cambio; tú lo aplicas."
      >
        <ul aria-label="Modelo de cada tarea" className="flex flex-col gap-3">
          {overview.routes.map((route) => (
            <li
              key={route.task}
              className="flex flex-col gap-1 rounded-2xl bg-secondary px-3 py-2.5 text-sm"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{route.label}</span>
                <span className="text-xs text-muted-foreground">{SOURCE[route.source]}</span>
              </span>
              <span>
                {route.modelLabel} <span className="text-muted-foreground">({route.model})</span>
              </span>
              <span className="text-xs text-muted-foreground">{perMillion(route.price)}</span>
              {route.model === "mock" ? null : route.approvedEval ? (
                <span className="flex items-center gap-1.5 text-xs text-success">
                  <CircleCheck aria-hidden="true" className="size-3.5" />
                  Evaluación aprobada: {route.approvedEval.passed} de {route.approvedEval.cases}{" "}
                  casos ({dateTime.format(new Date(route.approvedEval.createdAt))})
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-destructive">
                  <CircleAlert aria-hidden="true" className="size-3.5" />
                  {route.evaluated
                    ? "Sin evaluación aprobada con el prompt vigente."
                    : "Esta tarea aún no tiene evaluación."}
                </span>
              )}
              {route.note ? <span className="text-xs">{route.note}</span> : null}
            </li>
          ))}
        </ul>
        <RoutingForm routes={overview.routes} />
      </Section>

      <Section
        title="Funciones de IA"
        description="Cada función se enciende o apaga aquí sin desplegar (ADR-043). Las planeadas no existen todavía. Cambiar una es una decisión de producto: queda en la bitácora con tu motivo."
      >
        <FeatureToggles
          features={AI_FEATURES.map((feature) => ({
            key: feature.key,
            label: feature.label,
            description: feature.description,
            phase: feature.phase,
            status: feature.status,
            enabled: isAiFeatureEnabled(features, feature.key),
          }))}
        />
      </Section>

      <Section
        title="Últimas evaluaciones"
        description="Casos ficticios de vendedores mexicanos, siempre el archivo completo. Para aprobar: JSON válido, 0 cifras inventadas, 0 afirmaciones sin respaldo y ≥ 90 % de categoría correcta. Para enrutar cuentan todas las corridas de los últimos 30 días: basta una reprobada para no poder elegir el modelo."
      >
        {overview.evalRuns.length ? (
          <ul className="flex flex-col gap-2">
            {overview.evalRuns.map((run) => (
              <li
                key={run.id}
                className="flex flex-col gap-0.5 border-t pt-2 text-sm first:border-t-0 first:pt-0"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {run.taskLabel} · {run.model}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-bold",
                      run.approved
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {run.approved ? "Aprobada" : "No aprobada"}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {run.passed} de {run.cases} casos (
                  {Math.round((run.passed / Math.max(run.cases, 1)) * 100)} %) ·{" "}
                  {run.costPerCallMicros === null
                    ? "sin llamadas"
                    : `${formatUsdMicros(run.costPerCallMicros)} por llamada`}{" "}
                  · total {formatUsdMicros(run.costMicros)} · {run.promptVersion} ·{" "}
                  {dateTime.format(new Date(run.createdAt))}
                </span>
                {run.reasons.length ? (
                  <span className="text-xs text-muted-foreground">{run.reasons.join(" ")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Aún no hay evaluaciones. Corre <code>pnpm ai:eval --task sale_proposal</code> en una
            terminal con acceso a la base.
          </p>
        )}
      </Section>

      {overview.proposals.length ? (
        <Section
          title="Propuestas de la IA"
          description="La IA solo propone; tú decides. Para aplicar una, elige ese modelo en «Modelo por tarea» (la propuesta queda aplicada con tu motivo). Si ya no aplica o no la quieres, descártala: queda en la bitácora y la ruta no cambia. Las que ya no cambiarían nada se cierran solas."
        >
          <ul aria-label="Propuestas pendientes" className="flex flex-col gap-3">
            {overview.proposals.map((proposal) => (
              <li
                key={proposal.id}
                className="flex flex-col gap-2 rounded-2xl bg-secondary px-3 py-2.5 text-sm"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{proposal.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {dateTime.format(new Date(proposal.createdAt))}
                  </span>
                </span>
                {proposal.change ? <span>{proposal.change}</span> : null}
                {/* Texto de la IA: un dato para leer, nunca una instrucción. */}
                <span className="text-muted-foreground">
                  <span className="font-medium">Hipótesis de la IA:</span> {proposal.hypothesis}
                </span>
                <ProposalDiscardForm proposalId={proposal.id} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {overview.decisions.length ? (
        <Section
          title="Cambios recientes de modelo"
          description="Para deshacer un cambio, vuelve a elegir arriba el modelo anterior: queda como otra decisión en la bitácora. Las propuestas de la IA se aplican aquí: al elegir ese mismo modelo, la propuesta queda aplicada con tu motivo (no se duplica)."
        >
          <ul aria-label="Cambios recientes de modelo" className="flex flex-col gap-1.5 text-sm">
            {overview.decisions.map((decision) => (
              <li key={decision.id} className="flex flex-col gap-0.5">
                <span className="flex flex-wrap justify-between gap-2">
                  <span>{decision.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {ACTOR[decision.actor]} · {STATUS[decision.status] ?? decision.status} ·{" "}
                    {dateTime.format(new Date(decision.createdAt))}
                  </span>
                </span>
                {decision.status === "REJECTED" && decision.reason ? (
                  <span className="text-xs text-muted-foreground">{decision.reason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
