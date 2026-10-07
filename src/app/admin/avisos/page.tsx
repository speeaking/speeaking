import { Copyright, FolderClosed, TriangleAlert } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { getAdminViewer, requireAdmin } from "@/modules/admin/guard";
import { formatLegalDate } from "@/modules/rights/messages";
import { type AdminNoticeRow, listNoticesForAdmin } from "@/modules/rights/service";
import { STRIKE_THRESHOLD } from "@/modules/rights/strikes";

/** Título solo para ADMIN: a los demás esta ruta les responde el 404 de siempre. */
export async function generateMetadata(): Promise<Metadata> {
  return (await getAdminViewer()) ? { title: "Avisos de derechos" } : {};
}

const cardClass = "flex flex-col gap-2 rounded-card border bg-card p-4";

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Copyright;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-heading">
          <Icon className="size-5" aria-hidden />
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Avisos de derechos de autor, marcas e imagen de artistas (ADR-076), aparte de los reportes de la
 * comunidad: el canal formal de la LFDA (art. 114 Octies). Lo abierto primero, el más antiguo
 * arriba; las faltas de cada cuenta en los últimos 12 meses y cuándo toca restaurar.
 */
export default async function RightsNoticesPage() {
  const admin = await requireAdmin();
  const now = new Date();
  const { open, closed } = await listNoticesForAdmin(admin.userId, now);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Avisos de derechos"
        description="Retira sin demora lo que señala un aviso completo; restaura a los 10 días hábiles de un contra-aviso si nadie acreditó una acción legal."
        className="px-0"
      />

      <Section
        title="Abiertos"
        description={`${formatCount(open.length, "caso abierto", "casos abiertos")}. El más antiguo primero.`}
        icon={Copyright}
      >
        {open.length === 0 ? (
          <p className="rounded-card border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No hay avisos abiertos.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((notice) => (
              <li key={notice.id}>
                <NoticeCard notice={notice} now={now} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Cerrados"
        description="Restaurados, que se mantienen retirados, que no procedieron o que retiró quien avisó."
        icon={FolderClosed}
      >
        {closed.length === 0 ? (
          <p className="rounded-card border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Todavía no hay casos cerrados.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {closed.map((notice) => (
              <li key={notice.id}>
                <NoticeCard notice={notice} now={now} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function NoticeCard({ notice, now }: { notice: AdminNoticeRow; now: Date }) {
  return (
    <article className={cardClass} aria-label={`Caso ${notice.caseNumber}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            href={`/admin/avisos/${notice.caseNumber}` as Route}
            className="font-semibold underline"
          >
            {notice.caseNumber} · {notice.claimantName}
          </Link>
          <span className="text-sm text-muted-foreground">
            {notice.kindLabel} · recibido {formatRelativeTime(notice.receivedAt, now)} ·{" "}
            {formatCount(notice.targetCount, "contenido de speeaking", "contenidos de speeaking")}{" "}
            de {formatCount(notice.urlCount, "dirección", "direcciones")}
            {notice.manualTargetCount > 0
              ? ` · ${formatCount(notice.manualTargetCount, "se retira a mano", "se retiran a mano")}`
              : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{notice.statusLabel}</Badge>
          {notice.restoreDue ? <Badge variant="destructive">Toca restaurar</Badge> : null}
        </div>
      </div>
      {notice.status === "COUNTER_NOTICE_RECEIVED" && notice.restoreDueAt ? (
        <p className="text-sm text-muted-foreground">
          Restaurar a partir del {formatLegalDate(notice.restoreDueAt)} si quien avisó no acreditó
          una acción legal.
        </p>
      ) : null}
      {notice.owners.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {notice.owners.map((owner) => (
            <li key={owner.userId} className="flex items-center gap-1.5">
              {owner.reviewClosure ? (
                <TriangleAlert className="size-4 text-destructive" aria-hidden />
              ) : null}
              {owner.username ? `@${owner.username}` : "Cuenta sin perfil"} ·{" "}
              {formatCount(owner.strikes, "falta", "faltas")} en 12 meses
              {owner.reviewClosure ? (
                <span className="font-semibold text-destructive">
                  {" "}
                  (≥ {STRIKE_THRESHOLD}: revisar cierre)
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
