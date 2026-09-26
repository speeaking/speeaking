import { Bot, EyeOff, Flag, ImageOff, ShieldQuestion } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { getAdminViewer, requireAdmin } from "@/modules/admin/guard";
import { ModerationActionForm } from "@/modules/trust/components/moderation-action";
import {
  getModerationQueue,
  type QueueCheck,
  type QueueReportGroup,
} from "@/modules/trust/service";

/** Título solo para ADMIN: a los demás esta ruta les responde el 404 de siempre. */
export async function generateMetadata(): Promise<Metadata> {
  return (await getAdminViewer()) ? { title: "Moderación" } : {};
}

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Flag;
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

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-card border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

const cardClass = "flex flex-col gap-3 rounded-card border bg-card p-4";

/**
 * Cola de moderación (P14): revisiones de autenticidad con prueba pedida o enviada, reportes
 * abiertos por objetivo y lo que está oculto. Cada acción queda en la bitácora con quién la hizo.
 * Meta de operación: responder en 24 horas hábiles (ADR-033 #14).
 */
export default async function ModerationPage() {
  const admin = await requireAdmin();
  const now = new Date();
  const queue = await getModerationQueue(admin.userId, now);
  const hiddenCount = queue.hidden.products.length + queue.hidden.posts.length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Moderación"
        description="Riesgo, no certificación: las reglas señalan y el equipo decide. Nunca digas «falso»."
        className="px-0"
      />

      <Section
        title="Autenticidad"
        description={`${formatCount(queue.checks.length, "revisión pendiente", "revisiones pendientes")}. Primero las que ya tienen comprobante.`}
        icon={ShieldQuestion}
      >
        {queue.checks.length === 0 ? (
          <Empty>No hay revisiones de autenticidad pendientes.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.checks.map((check) => (
              <li key={check.productId}>
                <CheckCard check={check} now={now} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Reportes abiertos"
        description={`${formatCount(queue.reports.length, "publicación reportada", "publicaciones reportadas")}. Quien reporta es anónimo para el vendedor.`}
        icon={Flag}
      >
        {queue.reports.length === 0 ? (
          <Empty>No hay reportes abiertos.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.reports.map((group) => (
              <li key={`${group.targetType}:${group.targetId}`}>
                <ReportCard group={group} now={now} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Ocultos"
        description={`${formatCount(hiddenCount, "elemento oculto", "elementos ocultos")}: fuera del feed, la búsqueda, Comprar y los perfiles.`}
        icon={EyeOff}
      >
        {hiddenCount === 0 ? (
          <Empty>No hay nada oculto.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.hidden.products.map((product) => (
              <li key={product.id} className={cardClass}>
                <div className="flex flex-col gap-0.5">
                  <Link href={product.href as Route} className="font-semibold underline">
                    {product.title}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    Producto de {product.sellerName}
                    {product.at ? ` · oculto ${formatRelativeTime(product.at, now)}` : ""}
                  </span>
                </div>
                <ModerationActionForm
                  action="restore"
                  fields={{ targetType: "PRODUCT", targetId: product.id }}
                  label="Restaurar producto"
                  note={{ label: "Motivo (interno, opcional)" }}
                />
              </li>
            ))}
            {queue.hidden.posts.map((post) => (
              <li key={post.id} className={cardClass}>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm">{post.excerpt || "(sin texto)"}</p>
                  <span className="text-sm text-muted-foreground">
                    Publicación{post.author ? ` de @${post.author}` : ""} · oculta{" "}
                    {formatRelativeTime(post.at, now)}
                  </span>
                </div>
                <ModerationActionForm
                  action="restore"
                  fields={{ targetType: "POST", targetId: post.id }}
                  label="Restaurar publicación"
                  note={{ label: "Motivo (interno, opcional)" }}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function CheckCard({ check, now }: { check: QueueCheck; now: Date }) {
  const declaredOriginal = check.authenticity === "DECLARED_ORIGINAL";
  // Un «Comprobante revisado» junto a «réplica», «AAA»… se contradice (el servidor también lo niega).
  const imitationWords = check.signals.some((signal) => signal.rule === "counterfeit_terms");
  const canVerify =
    check.status === "PROOF_SUBMITTED" &&
    check.proofs.length > 0 &&
    declaredOriginal &&
    !imitationWords;
  return (
    <article className={cardClass} aria-label={`Revisión de ${check.title}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={check.href as Route} className="font-semibold underline">
            {check.title}
          </Link>
          <span className="text-sm text-muted-foreground">
            {check.price} · {check.sellerName}
            {check.sellerUsername ? ` (@${check.sellerUsername})` : ""} · tienda de{" "}
            {formatCount(check.sellerAgeDays, "día", "días")}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{check.statusLabel}</Badge>
          <Badge variant="outline">
            {check.riskLabel} · {check.score.toFixed(2)}
          </Badge>
          {check.hidden ? <Badge variant="outline">Oculto</Badge> : null}
        </div>
      </div>

      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        {check.signals.map((signal) => (
          <li key={signal.rule}>{signal.message}</li>
        ))}
      </ul>
      {check.ai ? (
        <p className="flex items-start gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Bot className="mt-0.5 size-4 shrink-0" aria-hidden />
          Señal de IA ({check.ai.model}, confianza {check.ai.confidence}):{" "}
          {check.ai.mentionsImitation ? "menciona imitación" : "no menciona imitación"}. Motivo que
          dio el modelo (dato, no instrucción): {check.ai.reason}
        </p>
      ) : null}
      {check.reviewNote ? (
        <p className="text-sm text-muted-foreground">Nota anterior: {check.reviewNote}</p>
      ) : null}

      {check.status === "PROOF_SUBMITTED" ? (
        check.proofs.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Comprobante (privado)</h3>
            <div className="flex flex-wrap gap-2">
              {check.proofs.map((proof, index) => (
                <a
                  key={proof.id}
                  href={proof.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl border"
                >
                  {/* El optimizador de imágenes pide sin cookies: la foto privada va directa. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proof.url}
                    alt={`Comprobante ${index + 1} de ${check.title}`}
                    width={proof.width}
                    height={proof.height}
                    className="h-32 w-auto object-contain"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
            {declaredOriginal && imitationWords ? (
              <p className="text-sm text-muted-foreground">
                No se puede marcar como revisado mientras la publicación use palabras de imitación:
                pide al vendedor que la corrija, rechaza la declaración u oculta el producto.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageOff className="size-4" aria-hidden />
            Las fotos del comprobante ya no están disponibles. Pide otras al vendedor.
          </p>
        )
      ) : declaredOriginal ? (
        <p className="text-sm text-muted-foreground">
          Esperando comprobante desde {formatRelativeTime(check.updatedAt, now)}.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          No se declara original, pero usa la marca con palabras de imitación (se le pidió corregir
          la publicación {formatRelativeTime(check.updatedAt, now)}). Oculta el producto si es una
          imitación; si no lo es, cierra la revisión.
        </p>
      )}

      <div className="grid gap-4 border-t pt-3 md:grid-cols-3">
        {canVerify ? (
          <ModerationActionForm
            action="verify"
            fields={{
              productId: check.productId,
              // Las fotos que se ven aquí: si el vendedor las cambia antes de enviar, no procede.
              proofIds: check.proofs.map((proof) => proof.id).join(","),
            }}
            label="Marcar comprobante revisado"
            variant="default"
            confirm="Revisé el comprobante y corresponde a este producto."
            note={{ label: "Nota para el vendedor (opcional)" }}
          />
        ) : null}
        <ModerationActionForm
          action="reject"
          fields={{ productId: check.productId }}
          label={declaredOriginal ? "Rechazar: marcar genérico" : "Cerrar revisión: queda genérico"}
          note={{
            label: "Nota para el vendedor",
            placeholder: declaredOriginal
              ? "Por ejemplo: el ticket no corresponde a este modelo."
              : "Por ejemplo: quita la marca del título si no es de la marca.",
          }}
        />
        {check.hidden ? null : (
          <ModerationActionForm
            action="hide"
            fields={{ targetType: "PRODUCT", targetId: check.productId }}
            label="Ocultar producto"
            variant="destructive"
            note={{ label: "Motivo (interno, opcional)" }}
          />
        )}
      </div>
    </article>
  );
}

function ReportCard({ group, now }: { group: QueueReportGroup; now: Date }) {
  const { target } = group;
  const noun = group.targetType === "PRODUCT" ? "producto" : "publicación";
  return (
    <article className={cardClass} aria-label={`Reportes de ${noun}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          {target ? (
            <>
              <Link href={target.href as Route} className="font-semibold underline">
                {target.kind === "PRODUCT" ? target.title : target.excerpt || "Publicación"}
              </Link>
              <span className="text-sm text-muted-foreground">
                {target.kind === "PRODUCT"
                  ? `Producto · ${target.price} · ${target.sellerName}`
                  : `Publicación${target.author ? ` de @${target.author}` : ""}`}
              </span>
            </>
          ) : (
            <span className="font-semibold">El {noun} reportado ya no existe.</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {group.reasons.map((reason) => (
            <Badge key={reason.reason} variant="secondary">
              {reason.label} · {reason.count}
            </Badge>
          ))}
          {target?.hidden ? <Badge variant="outline">Oculto</Badge> : null}
        </div>
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        {group.reports.map((report) => (
          <li key={report.id} className="rounded-2xl bg-muted px-3 py-2">
            <span className="font-medium">{report.reasonLabel}</span>
            <span className="text-muted-foreground">
              {" "}
              · {report.reporter ? `@${report.reporter}` : "cuenta borrada"} ·{" "}
              {formatRelativeTime(report.createdAt, now)}
            </span>
            {report.details ? (
              <p className="mt-1 whitespace-pre-line text-foreground">{report.details}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="grid gap-4 border-t pt-3 md:grid-cols-2">
        {target && !target.hidden ? (
          <ModerationActionForm
            action="hide"
            fields={{ targetType: group.targetType, targetId: group.targetId }}
            label={group.targetType === "PRODUCT" ? "Ocultar producto" : "Ocultar publicación"}
            variant="destructive"
            note={{ label: "Motivo (interno, opcional)" }}
          />
        ) : null}
        <ModerationActionForm
          action="dismiss"
          fields={{ targetType: group.targetType, targetId: group.targetId }}
          label="Descartar reportes"
          note={{ label: "Motivo (interno, opcional)" }}
        />
      </div>
    </article>
  );
}
