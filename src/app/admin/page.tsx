import { ArrowRight, CircleAlert, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/modules/admin/guard";
import { ADMIN_AI_HREF, adminNav } from "@/modules/admin/nav";
import { type AdminOverview, getAdminOverview } from "@/modules/admin/service";

/** Qué cuenta cada sección en el resumen (solo números calculados por código). */
const SECTION_SUMMARY: Record<string, (overview: AdminOverview) => string> = {
  "/admin/decisiones": (o) =>
    formatCount(o.proposedDecisions, "propuesta por revisar", "propuestas por revisar"),
  "/admin/experimentos": (o) =>
    formatCount(o.runningExperiments, "experimento en curso", "experimentos en curso"),
  "/admin/moderacion": (o) =>
    `${formatCount(o.openReports, "reporte abierto", "reportes abiertos")} · ${formatCount(
      o.proofsToReview,
      "prueba de autenticidad por revisar",
      "pruebas de autenticidad por revisar",
    )}`,
  "/admin/redaccion": (o) =>
    formatCount(o.editorialDrafts, "borrador por revisar", "borradores por revisar"),
  "/admin/ia": (o) =>
    formatCount(
      o.evalRuns,
      "evaluación de modelos registrada",
      "evaluaciones de modelos registradas",
    ),
};

export default async function AdminHomePage() {
  const admin = await requireAdmin();
  const overview = await getAdminOverview(admin.userId);
  const sections = adminNav.filter((item) => item.href in SECTION_SUMMARY);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Resumen"
        description="Lo que espera tu revisión. La IA propone; tú apruebas lo de riesgo alto."
        className="px-0"
      />

      {overview.failedJobsLast24h > 0 ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {formatCount(
            overview.failedJobsLast24h,
            "tarea programada falló",
            "tareas programadas fallaron",
          )}{" "}
          en las últimas 24 horas.
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {sections.map((item) => (
          <li key={item.href}>
            <SectionCard
              href={item.href}
              icon={item.icon}
              label={item.label}
              summary={SECTION_SUMMARY[item.href]!(overview)}
              isAi={item.href === ADMIN_AI_HREF}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionCard({
  href,
  icon: Icon,
  label,
  summary,
  isAi,
}: {
  href: Route;
  icon: LucideIcon;
  label: string;
  summary: string;
  isAi: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full items-start gap-3 rounded-card border bg-card p-4 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary",
          isAi && "bg-secondary text-ink-2",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-heading font-bold tracking-title">{label}</span>
        <span className="text-sm text-muted-foreground">{summary}</span>
      </span>
      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
