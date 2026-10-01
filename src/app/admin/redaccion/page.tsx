import { Newspaper, PenLine, Send } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { getAdminViewer, requireAdmin } from "@/modules/admin/guard";
import { DRAFT_KIND_LABELS } from "@/modules/editorial/brief";
import { DraftReview } from "@/modules/editorial/components/draft-review";
import { RequestDraftForm } from "@/modules/editorial/components/request-draft-form";
import { type DeskStatus, getDesk } from "@/modules/editorial/service";

/** Título solo para ADMIN: a los demás esta ruta les responde el 404 de siempre. */
export async function generateMetadata(): Promise<Metadata> {
  return (await getAdminViewer()) ? { title: "Redacción" } : {};
}

const STATUS_NOTE: Record<Exclude<DeskStatus, "ready">, string> = {
  off: "La redacción está apagada: no se crean borradores nuevos. Se enciende en IA → Funciones.",
  unavailable:
    "La redacción necesita un modelo de IA de verdad. Con la IA simulada no redacta, para no publicar plantillas como contenido del equipo.",
};

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Newspaper;
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
 * Redacción diaria (ADR-066): la IA deja un borrador por comunidad cada día y aquí el equipo decide
 * qué se publica con la cuenta editorial. Nada sale sin aprobación; lo que nadie revisa en tres días
 * se descarta solo.
 */
export default async function EditorialDeskPage() {
  const admin = await requireAdmin();
  const now = new Date();
  const desk = await getDesk(admin.userId);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Redacción"
        description="La IA redacta y tú publicas. Cada publicación sale como «Equipo Estreno», marcada como cuenta editorial y hecha con ayuda de IA."
        className="px-0"
      />

      {desk.status !== "ready" ? (
        <p role="status" className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          {STATUS_NOTE[desk.status]}
        </p>
      ) : null}

      <Section
        title="Por revisar"
        description={`${formatCount(desk.pending.length, "borrador", "borradores")}. Ajusta el texto si hace falta; lo que no revises en tres días se descarta solo.`}
        icon={PenLine}
      >
        {desk.pending.length === 0 ? (
          <p className="rounded-card border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No hay borradores por revisar. Llega uno por comunidad cada mañana.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {desk.pending.map((draft) => (
              <li
                key={draft.id}
                id={`borrador-${draft.id}`}
                className="flex flex-col gap-3 rounded-card border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-semibold">
                    <span aria-hidden="true">{draft.community.emoji}</span> {draft.community.name}
                  </span>
                  <Badge variant="secondary">{DRAFT_KIND_LABELS[draft.kind]}</Badge>
                  {draft.simulated ? <Badge variant="outline">Texto de ejemplo</Badge> : null}
                  <span className="text-muted-foreground">
                    {formatRelativeTime(draft.createdAt, now)}
                  </span>
                </div>
                {draft.topic ? (
                  <p className="text-sm text-muted-foreground">Tema que pediste: {draft.topic}</p>
                ) : null}
                <DraftReview draftId={draft.id} body={draft.body} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Pedir un borrador"
        description="Uno más para la comunidad que elijas. Si pasa algo hoy, escribe el tema."
        icon={Newspaper}
      >
        <RequestDraftForm communities={desk.communities} disabled={desk.status !== "ready"} />
      </Section>

      {desk.published.length > 0 ? (
        <Section title="Publicadas" description="Lo último que salió de la redacción." icon={Send}>
          <ul className="flex flex-col divide-y rounded-card border bg-card">
            {desk.published.map((item) => (
              <li key={item.id} className="flex flex-col gap-0.5 px-4 py-3">
                <Link href={`/p/${item.postId}` as Route} className="text-sm underline">
                  {item.excerpt}
                </Link>
                <span className="text-xs text-muted-foreground">
                  <span aria-hidden="true">{item.community.emoji}</span> {item.community.name} ·{" "}
                  {formatRelativeTime(item.reviewedAt, now)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
