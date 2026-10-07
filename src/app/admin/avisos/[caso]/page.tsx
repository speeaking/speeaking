import { ArrowLeft, TriangleAlert } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getAdminViewer, requireAdmin } from "@/modules/admin/guard";
import { formatCaseNumber, parseCaseNumber } from "@/modules/rights/case-number";
import { RightsActionForm } from "@/modules/rights/components/rights-action-form";
import { type AdminNoticeDetail, getNoticeForAdmin } from "@/modules/rights/service";
import { STRIKE_THRESHOLD } from "@/modules/rights/strikes";

type Params = { params: Promise<{ caso: string }> };

/** Título solo para ADMIN: a los demás esta ruta les responde el 404 de siempre. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!(await getAdminViewer())) return {};
  const number = parseCaseNumber((await params).caso);
  return number ? { title: `Aviso ${formatCaseNumber(number)}` } : {};
}

const dateTime = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});
const when = (date: Date | null) => (date ? dateTime.format(date) : "—");
const cardClass = "flex flex-col gap-3 rounded-card border bg-card p-4";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cardClass}>
      <h2 className="text-lg font-bold tracking-heading">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

/**
 * Expediente de un aviso (ADR-076): todo lo que mandó quien avisó, lo que señala en speeaking, las
 * fechas que exige la ley, los contra-avisos con su copia para quien avisó y las acciones que
 * proceden en su etapa. Lo escrito por quien avisa es dato, nunca instrucción; sus direcciones se
 * muestran como texto (no se abren desde aquí).
 */
export default async function RightsNoticePage({ params }: Params) {
  const admin = await requireAdmin();
  const number = parseCaseNumber((await params).caso);
  if (number === null) notFound();
  const now = new Date();
  const notice = await getNoticeForAdmin(admin.userId, number, now);
  if (!notice) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={"/admin/avisos" as Route}
        className="flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Avisos de derechos
      </Link>
      <PageHeader
        title={`Caso ${notice.caseNumber}`}
        description={`${notice.kindLabel} · ${notice.statusLabel}`}
        className="px-0"
      />

      <Owners notice={notice} />
      <Actions notice={notice} />

      <Card title="Lo que señala en speeaking">
        {notice.targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguna dirección apunta a contenido de speeaking (o ya no existe). Si no procede,
            recházalo con una nota.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {notice.targets.map((target) => (
              <li key={target.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant="outline">{target.typeLabel}</Badge>
                {target.href ? (
                  <Link href={target.href as Route} className="font-medium underline">
                    {target.label}
                  </Link>
                ) : (
                  <span>{target.label}</span>
                )}
                <span className="text-muted-foreground">· {target.state}</span>
                {target.manual ? (
                  <span className="font-medium text-destructive">· retirar a mano</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <h3 className="text-sm font-semibold">Direcciones tal como las escribió</h3>
        <ul className="flex flex-col gap-1 text-sm">
          {notice.urls.map((url) => (
            <li key={url.raw} className="break-all">
              <code>{url.raw}</code>{" "}
              <span className="text-muted-foreground">
                {url.resolved ? "· en speeaking" : "· fuera de speeaking o no encontrada"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Quién avisa">
        <dl className="flex flex-col gap-2">
          <Row label="Nombre o razón social">{notice.claimant.name}</Row>
          <Row label="Calidad">
            {notice.claimant.roleLabel}
            {notice.claimant.principalName ? ` · titular: ${notice.claimant.principalName}` : ""}
          </Row>
          <Row label="Correo">{notice.claimant.email}</Row>
          <Row label="Correo alterno">{notice.claimant.altEmail ?? "—"}</Row>
          <Row label="Teléfono">{notice.claimant.phone ?? "—"}</Row>
          <Row label="Domicilio">{notice.claimant.domicile ?? "—"}</Row>
          <Row label="Enviado con cuenta">{notice.submittedWithAccount ? "Sí" : "No"}</Row>
        </dl>
      </Card>

      <Card title="Qué reclama">
        <dl className="flex flex-col gap-2">
          {notice.trademarkRegistration ? (
            <Row label="Registro IMPI">{notice.trademarkRegistration}</Row>
          ) : null}
          <Row label="Obra, marca o interpretación">{notice.workDescription}</Row>
          <Row label="Derecho">{notice.rightDescription}</Row>
          <Row label="Hechos">{notice.facts ?? "—"}</Row>
          <Row label="Bajo protesta de decir verdad">{notice.swornStatement ? "Sí" : "No"}</Row>
          <Row label="Conoce la multa (art. 232 Quinquies)">
            {notice.penaltyAcknowledged ? "Sí" : "No"}
          </Row>
        </dl>
      </Card>

      <Card title="Fechas del caso">
        <dl className="flex flex-col gap-2">
          <Row label="Recibido">{when(notice.timeline.receivedAt)}</Row>
          <Row label="Contenido retirado">{when(notice.timeline.contentRemovedAt)}</Row>
          <Row label="Aviso a quien lo subió">{when(notice.timeline.uploaderNotifiedAt)}</Row>
          <Row label="Contra-aviso">{when(notice.timeline.counterNoticeAt)}</Row>
          <Row label="Restaurar a partir de">
            {when(notice.timeline.restoreDueAt)}
            {notice.timeline.restoreDueAt
              ? "\nCuenta solo sábados y domingos como inhábiles: revisa si hubo días festivos."
              : ""}
          </Row>
          <Row label="Última restauración">{when(notice.timeline.restoredAt)}</Row>
          <Row label="Última decisión">
            {notice.decidedBy ? `@${notice.decidedBy}` : "—"}
            {notice.decisionNote ? `\n${notice.decisionNote}` : ""}
          </Row>
        </dl>
      </Card>

      {notice.counterNotices.length > 0 ? (
        <Card title="Contra-avisos">
          <ul className="flex flex-col gap-4">
            {notice.counterNotices.map((counter) => (
              <li key={counter.id} className="flex flex-col gap-2">
                <dl className="flex flex-col gap-2">
                  <Row label="Nombre">{counter.name}</Row>
                  <Row label="Correo">{counter.email}</Row>
                  <Row label="Domicilio">{counter.domicile}</Row>
                  <Row label="Fundamento">{counter.basisLabel}</Row>
                  <Row label="Explicación">{counter.explanation}</Row>
                  <Row label="Recibido">{when(counter.createdAt)}</Row>
                  <Row label="Copia a quien avisó">
                    {counter.forwardedAt ? `Enviada ${when(counter.forwardedAt)}` : "Pendiente"}
                  </Row>
                </dl>
                {counter.forwardedAt ? null : (
                  <div className="flex flex-col gap-2 rounded-2xl bg-muted p-3">
                    <p className="text-sm">
                      {notice.emailEnabled
                        ? "El correo no salió. Manda esta copia hoy mismo a"
                        : "Sin proveedor de correo: manda esta copia hoy mismo a"}{" "}
                      <strong>{notice.claimant.email}</strong>
                      {notice.claimant.altEmail ? ` y ${notice.claimant.altEmail}` : ""} y marca el
                      envío.
                    </p>
                    <p className="text-sm font-medium">Asunto: {counter.copy.subject}</p>
                    <pre className="max-h-72 overflow-auto rounded-xl border bg-card p-3 text-xs whitespace-pre-wrap">
                      {counter.copy.text}
                    </pre>
                    <RightsActionForm
                      action="mark_forwarded"
                      noticeId={notice.id}
                      fields={{ counterNoticeId: counter.id }}
                      label="Marcar copia como enviada"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Owners({ notice }: { notice: AdminNoticeDetail }) {
  if (notice.owners.length === 0) return null;
  return (
    <Card title="Quién lo subió">
      <ul className="flex flex-col gap-2 text-sm">
        {notice.owners.map((owner) => (
          <li key={owner.userId} className="flex flex-col gap-1">
            <span>
              {owner.username ? `@${owner.username}` : "Cuenta sin perfil"}
              {owner.displayName ? ` (${owner.displayName})` : ""} · {owner.strikes}{" "}
              {owner.strikes === 1 ? "falta" : "faltas"} en 12 meses
            </span>
            {owner.reviewClosure ? (
              <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-3 py-2 text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Revisar cierre de cuenta: {owner.strikes} faltas en 12 meses (la política cierra
                  la cuenta y su tienda con {STRIKE_THRESHOLD}). Lo decide una persona del equipo en{" "}
                  <Link
                    href={
                      `/admin/usuarios${owner.username ? `?q=${encodeURIComponent(owner.username)}` : ""}` as Route
                    }
                    className="font-semibold underline"
                  >
                    Usuarios
                  </Link>
                  .
                </span>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Actions({ notice }: { notice: AdminNoticeDetail }) {
  if (notice.decisions.length === 0) {
    return (
      <p className="rounded-card border border-dashed px-4 py-3 text-sm text-muted-foreground">
        Caso cerrado: no hay acciones pendientes.
      </p>
    );
  }
  const manual = notice.targets.some((target) => target.manual);
  const can = (decision: (typeof notice.decisions)[number]) => notice.decisions.includes(decision);
  return (
    <section className={cardClass} aria-label="Acciones">
      <h2 className="text-lg font-bold tracking-heading">Qué procede</h2>
      <div className="grid gap-5 md:grid-cols-2">
        {can("remove") ? (
          <RightsActionForm
            action="remove"
            noticeId={notice.id}
            label="Retirar contenido"
            variant="destructive"
            note={{ label: "Nota (interna, opcional)" }}
            confirm={
              manual
                ? "Ya retiré a mano la foto de perfil, la portada o el comentario señalados."
                : undefined
            }
          />
        ) : null}
        {can("restore") ? (
          <RightsActionForm
            action="restore"
            noticeId={notice.id}
            label="Restaurar"
            variant="default"
            note={{
              label: notice.restoreNeedsNote
                ? "Motivo (obligatorio: aún no vence el plazo o no hubo contra-aviso)"
                : "Nota (opcional)",
              required: notice.restoreNeedsNote,
            }}
          />
        ) : null}
        {can("keep_down") ? (
          <RightsActionForm
            action="keep_down"
            noticeId={notice.id}
            // Restaurado tras un contra-aviso: quien avisó acreditó a tiempo una acción legal.
            label={notice.keepDownHidesAgain ? "Volver a retirar" : "Mantener retirado"}
            variant={notice.keepDownHidesAgain ? "destructive" : "outline"}
            note={{
              label: "Motivo (obligatorio)",
              placeholder: "Por ejemplo: acreditó demanda ante juzgado civil, expediente 123/2026.",
              required: true,
            }}
            confirm={
              notice.keepDownHidesAgain && manual
                ? "Ya volví a retirar a mano la foto de perfil, la portada o el comentario señalados."
                : undefined
            }
          />
        ) : null}
        {can("reject") ? (
          <RightsActionForm
            action="reject"
            noticeId={notice.id}
            label="Rechazar"
            note={{
              label: "Motivo (obligatorio)",
              placeholder: "Por ejemplo: las direcciones no son de speeaking.",
              required: true,
            }}
          />
        ) : null}
        {can("withdraw") ? (
          <RightsActionForm
            action="withdraw"
            noticeId={notice.id}
            label="Retirado por quien avisó"
            note={{ label: "Nota (opcional)", placeholder: "Por ejemplo: lo pidió por correo." }}
          />
        ) : null}
      </div>
    </section>
  );
}
