import type { Metadata, Route } from "next";
import Link from "next/link";
import { requireViewer } from "@/modules/identity/session";
import { formatCaseNumber, parseCaseNumber } from "@/modules/rights/case-number";
import { CounterNoticeForm } from "@/modules/rights/components/counter-notice-form";
import { formatLegalDate } from "@/modules/rights/messages";
import { getOwnerCase, type OwnerCaseView } from "@/modules/rights/service";

export const metadata: Metadata = { title: "Contra-aviso" };

const LINK = "font-semibold text-primary-text underline underline-offset-4";

/**
 * El caso visto por quien subió lo señalado (ADR-076): quién avisó y qué reclama (el aviso formal no
 * es anónimo), en qué va y el formulario de contra-aviso. Pide sesión; a cualquier otra cuenta, y
 * mientras no se haya retirado nada, le responde lo mismo que a un caso que no existe.
 */
export default async function CounterNoticePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { caso } = await searchParams;
  const number = parseCaseNumber(Array.isArray(caso) ? caso[0] : caso);
  if (number === null) {
    return (
      <>
        <h1 className="text-3xl font-extrabold">Contra-aviso</h1>
        <p>
          Abre el enlace del aviso que te mandamos en la campana: ahí está el número de caso y desde
          ahí puedes mandar tu contra-aviso.
        </p>
        <p>
          <Link className={LINK} href={"/avisos" as Route}>
            Ver mis avisos
          </Link>{" "}
          ·{" "}
          <Link className={LINK} href={"/derechos-de-autor#contra-aviso" as Route}>
            Cómo funciona el contra-aviso
          </Link>
        </p>
      </>
    );
  }

  const viewer = await requireViewer(
    `/derechos-de-autor/contra-aviso?caso=${formatCaseNumber(number)}`,
  );
  const view = await getOwnerCase(viewer.userId, number);
  if (!view) {
    return (
      <>
        <h1 className="text-3xl font-extrabold">Contra-aviso</h1>
        <p>
          No encontramos este caso en tu cuenta. Revisa que entraste con la cuenta que subió el
          contenido.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold">Caso {view.caseNumber}</h1>
      <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
        {view.kindLabel} · {view.statusLabel} · recibido el {formatLegalDate(view.receivedAt)}
      </p>

      <h2>Lo que señaló el aviso</h2>
      <ul>
        {view.targets.map((target, index) => (
          <li key={index}>
            {target.typeLabel}:{" "}
            {target.href ? (
              <Link className={LINK} href={target.href as Route}>
                {target.label}
              </Link>
            ) : (
              target.label
            )}{" "}
            <span className="text-sm text-muted-foreground">({target.state})</span>
          </li>
        ))}
      </ul>

      <h2>Quién avisó y qué reclama</h2>
      <p>
        {view.claimant.name}
        {view.claimant.principalName ? `, en representación de ${view.claimant.principalName}` : ""}
        {" · "}
        {view.claimant.email}
      </p>
      <dl className="flex flex-col gap-3">
        <div>
          <dt className="text-sm font-semibold">Obra, marca o interpretación</dt>
          <dd className="whitespace-pre-line">{view.workDescription}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold">Derecho que reclama</dt>
          <dd className="whitespace-pre-line">{view.rightDescription}</dd>
        </div>
        {view.facts ? (
          <div>
            <dt className="text-sm font-semibold">Hechos</dt>
            <dd className="whitespace-pre-line">{view.facts}</dd>
          </div>
        ) : null}
      </dl>

      <h2 id="contra-aviso">Tu contra-aviso</h2>
      <CaseStatus view={view} />
      {view.canFile ? (
        <>
          <p>
            Puedes mandarlo si la obra es tuya, tienes licencia o permiso, es un uso permitido por
            la ley o es de dominio público (
            <Link className={LINK} href={"/derechos-de-autor#contra-aviso" as Route}>
              cómo funciona
            </Link>
            ).
          </p>
          <CounterNoticeForm
            caseNumber={view.caseNumber}
            defaultName={viewer.name}
            defaultEmail={viewer.email}
          />
        </>
      ) : null}
    </>
  );
}

function CaseStatus({ view }: { view: OwnerCaseView }) {
  if (view.myCounterNotice) {
    return (
      <p>
        Recibimos tu contra-aviso el {formatLegalDate(view.myCounterNotice.createdAt)} (
        {view.myCounterNotice.basisLabel.toLowerCase()}).{" "}
        {view.status === "COUNTER_NOTICE_RECEIVED" && view.restoreDueAt
          ? `Volveremos a mostrar el contenido a partir del ${formatLegalDate(view.restoreDueAt)}, salvo que quien avisó compruebe que inició una acción legal.`
          : null}
        {view.status === "RESTORED" && view.restoredAt
          ? `Volvimos a mostrar el contenido el ${formatLegalDate(view.restoredAt)}.`
          : null}
        {view.status === "KEPT_DOWN"
          ? "El contenido se mantiene retirado: quien avisó comprobó que inició una acción legal o el contra-aviso no procedió."
          : null}
      </p>
    );
  }
  switch (view.status) {
    case "RECEIVED":
      return (
        <p>
          Todavía no retiramos nada por este aviso. Si lo hacemos, te avisaremos y podrás mandar tu
          contra-aviso.
        </p>
      );
    case "CONTENT_REMOVED":
      return (
        <p>
          Retiramos el contenido el{" "}
          {view.contentRemovedAt ? formatLegalDate(view.contentRemovedAt) : "día del aviso"}.
        </p>
      );
    case "COUNTER_NOTICE_RECEIVED":
      return (
        <p>
          Ya recibimos un contra-aviso para este caso
          {view.restoreDueAt
            ? `; el contenido vuelve a mostrarse a partir del ${formatLegalDate(view.restoreDueAt)}, salvo que quien avisó compruebe una acción legal`
            : ""}
          .
        </p>
      );
    case "RESTORED":
      return (
        <p>
          Volvimos a mostrar el contenido
          {view.restoredAt ? ` el ${formatLegalDate(view.restoredAt)}` : ""}.
        </p>
      );
    case "KEPT_DOWN":
      return (
        <p>
          El contenido se mantiene retirado: quien avisó comprobó que inició una acción legal o el
          contra-aviso no procedió.
        </p>
      );
    case "WITHDRAWN":
      return <p>Quien avisó retiró su aviso: no hace falta un contra-aviso.</p>;
    case "REJECTED":
      return <p>El aviso no procedió: no retiramos nada.</p>;
  }
}
