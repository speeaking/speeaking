import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { getAdminViewer, requireAdmin } from "@/modules/admin/guard";
import { CeoSubnav } from "@/modules/ceo/components/ceo-subnav";
import { DecisionCard } from "@/modules/ceo/components/decision-card";
import {
  DECISION_RISK_FILTERS,
  DECISION_STATUS_FILTERS,
  type DecisionRiskFilter,
  type DecisionStatusFilter,
  parseDecisionFilters,
} from "@/modules/ceo/decision-filters";
import { getDecisionQueue } from "@/modules/ceo/service";

/** Solo ADMIN recibe título; a los demás, el 404 sin metadatos propios (ver layout de /admin). */
export async function generateMetadata(): Promise<Metadata> {
  return (await getAdminViewer()) ? { title: "Decisiones" } : {};
}

const STATUS_LABELS: Record<DecisionStatusFilter, string> = {
  pendientes: "Pendientes",
  aprobadas: "Aprobadas",
  aplicadas: "Aplicadas",
  revertidas: "Revertidas",
  rechazadas: "Rechazadas",
  todas: "Todas",
};

const RISK_LABELS: Record<DecisionRiskFilter, string> = {
  bajo: "Riesgo bajo",
  medio: "Riesgo medio",
  alto: "Riesgo alto",
};

function href(status: DecisionStatusFilter, risk: DecisionRiskFilter | null) {
  const params = new URLSearchParams();
  if (status !== "pendientes") params.set("estado", status);
  if (risk) params.set("riesgo", risk);
  const query = params.toString();
  return `/admin/decisiones${query ? `?${query}` : ""}` as Route;
}

function Chip({
  href: target,
  active,
  children,
}: {
  href: Route;
  active: boolean;
  children: string;
}) {
  return (
    <Link
      href={target}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground",
        active && "border-foreground bg-foreground text-background hover:text-background",
      )}
    >
      {children}
    </Link>
  );
}

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const { status, risk } = parseDecisionFilters(await searchParams);
  const { items, counts } = await getDecisionQueue(admin.userId, { status, risk });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Decisiones"
        description="La IA propone; el código clasifica el riesgo y valida límites. Lo de riesgo alto solo se aplica si tú lo ejecutas."
        className="px-0 pt-0 pb-0"
      />
      <CeoSubnav current="/admin/decisiones" />

      <div className="flex flex-col gap-2">
        <nav aria-label="Filtrar por estado" className="scrollbar-none overflow-x-auto">
          <ul className="flex w-max gap-2">
            {(Object.keys(DECISION_STATUS_FILTERS) as DecisionStatusFilter[]).map((filter) => (
              <li key={filter}>
                <Chip href={href(filter, risk)} active={filter === status}>
                  {`${STATUS_LABELS[filter]} (${counts[filter]})`}
                </Chip>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Filtrar por riesgo" className="scrollbar-none overflow-x-auto">
          <ul className="flex w-max gap-2">
            <li>
              <Chip href={href(status, null)} active={risk === null}>
                Cualquier riesgo
              </Chip>
            </li>
            {(Object.keys(DECISION_RISK_FILTERS) as DecisionRiskFilter[]).map((filter) => (
              <li key={filter}>
                <Chip href={href(status, filter)} active={filter === risk}>
                  {RISK_LABELS[filter]}
                </Chip>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {items.length === 0 ? (
        <p className="rounded-card border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {status === "pendientes"
            ? "No hay propuestas por revisar. El analista corre cada día con la operación diaria."
            : "No hay decisiones con estos filtros."}
        </p>
      ) : (
        <>
          {counts[status] > items.length ? (
            <p className="text-sm text-muted-foreground">
              Se muestran las {items.length} más recientes de {counts[status]}.
            </p>
          ) : null}
          <ul className="flex flex-col gap-4">
            {items.map((decision) => (
              <li key={decision.id}>
                <DecisionCard decision={decision} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
