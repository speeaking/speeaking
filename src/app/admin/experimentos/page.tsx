import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getAdminViewer, requireAdmin } from "@/modules/admin/guard";
import { CeoSubnav } from "@/modules/ceo/components/ceo-subnav";
import { ExperimentCard } from "@/modules/ceo/components/experiment-card";
import { getExperiments } from "@/modules/ceo/service";

/** Solo ADMIN recibe título; a los demás, el 404 sin metadatos propios (ver layout de /admin). */
export async function generateMetadata(): Promise<Metadata> {
  return (await getAdminViewer()) ? { title: "Experimentos" } : {};
}

export default async function ExperimentsPage() {
  const admin = await requireAdmin();
  const experiments = await getExperiments(admin.userId);
  const running = experiments.filter((experiment) => experiment.status === "RUNNING");
  const others = experiments.filter((experiment) => experiment.status !== "RUNNING");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Experimentos"
        description="Asignación estable por persona; se analiza por persona con el efecto de diseño. Adoptar un resultado siempre pasa por tu aprobación."
        className="px-0 pt-0 pb-0"
      />
      <CeoSubnav current="/admin/experimentos" />

      <section aria-labelledby="en-curso" className="flex flex-col gap-3">
        <h2 id="en-curso" className="font-heading text-xl font-bold tracking-heading">
          En curso
        </h2>
        {running.length === 0 ? (
          <p className="rounded-card border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            No hay experimentos en curso. Se lanzan al aprobar una propuesta de riesgo medio.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {running.map((experiment) => (
              <li key={experiment.id}>
                <ExperimentCard experiment={experiment} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 ? (
        <section aria-labelledby="historial" className="flex flex-col gap-3">
          <h2 id="historial" className="font-heading text-xl font-bold tracking-heading">
            Borradores e historial
          </h2>
          <ul className="flex flex-col gap-4">
            {others.map((experiment) => (
              <li key={experiment.id}>
                <ExperimentCard experiment={experiment} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
