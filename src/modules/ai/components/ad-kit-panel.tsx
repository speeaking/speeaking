"use client";

import {
  Copy,
  FileText,
  Heading,
  Image as ImageIcon,
  Link2,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useActionState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { type AdKitState, generateAdKitAction, recordAdKitCopyAction } from "../ad-kit/actions";
import type { AdKitChannel, AdKitVariant } from "../ad-kit/compose";
import type { AdKitView } from "../ad-kit/service";
import {
  AI_OUTPUT_LABEL,
  type AiAvailability,
  SIMULATED_OUTPUT_LABEL,
  WRITE_BY_HAND,
} from "../tasks/simulation";

const ICONS: Record<AdKitChannel, LucideIcon> = {
  whatsapp: MessageCircle,
  facebook: Megaphone,
  instagram: ImageIcon,
  headline: Heading,
};

const COPIED: Record<AdKitChannel, string> = {
  whatsapp: "Copiado. Pégalo en WhatsApp.",
  facebook: "Copiado. Pégalo en Facebook o Marketplace.",
  instagram: "Copiado. Pégalo como pie de foto en Instagram.",
  headline: "Titular copiado.",
};

async function copy(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
    return true;
  } catch {
    toast.error("No pudimos copiar. Selecciona el texto y cópialo a mano.");
    return false;
  }
}

/**
 * Etiqueta de contenido generado con IA (principio 5). La lima es solo de la IA: un texto de la IA
 * simulada (piloto, ADR-038) lleva otra etiqueta y otro color, porque no lo escribió un modelo.
 */
function AiLabel({ simulated }: { simulated: boolean }) {
  if (simulated) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
        {SIMULATED_OUTPUT_LABEL}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ai px-2 py-0.5 text-[11px] font-bold text-ai-foreground">
      <Sparkles aria-hidden="true" className="size-3" />
      {AI_OUTPUT_LABEL}
    </span>
  );
}

function VariantCard({
  productId,
  variant,
  simulated,
}: {
  productId: string;
  variant: AdKitVariant;
  simulated: boolean;
}) {
  const Icon = ICONS[variant.channel];
  const onCopy = async () => {
    if (await copy(variant.text, COPIED[variant.channel])) {
      void recordAdKitCopyAction(productId, variant.channel);
    }
  };
  const onCopyLink = async () => {
    if (await copy(variant.shareUrl, "Liga copiada. Ponla en tu perfil o en una historia.")) {
      void recordAdKitCopyAction(productId, "link");
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-3xl border bg-card p-4 md:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold tracking-title">
          <Icon aria-hidden="true" className="size-5" />
          {variant.title}
        </h3>
        <AiLabel simulated={simulated} />
      </header>
      <p className="rounded-2xl bg-secondary px-3 py-2.5 text-sm break-words whitespace-pre-wrap">
        {variant.text}
      </p>
      <div className="flex flex-wrap gap-2 [&_a]:h-11 [&_a]:px-4 [&_button]:h-11 [&_button]:px-4">
        <Button type="button" onClick={onCopy} aria-label={`Copiar: ${variant.title}`}>
          <Copy data-icon="inline-start" />
          Copiar
        </Button>
        {variant.channel === "whatsapp" ? (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(variant.text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
            onClick={() => void recordAdKitCopyAction(productId, "whatsapp")}
          >
            <MessageCircle data-icon="inline-start" />
            Abrir WhatsApp
          </a>
        ) : null}
        {variant.channel === "instagram" ? (
          <Button type="button" variant="outline" onClick={onCopyLink}>
            <Link2 data-icon="inline-start" />
            Copiar liga
          </Button>
        ) : null}
      </div>
    </article>
  );
}

/** Sin IA de verdad ni simulación permitida (ADR-038): nada de plantillas; se escribe a mano. */
function WriteByHand() {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-2xl bg-secondary p-3 text-foreground">
      <p className="font-semibold">{WRITE_BY_HAND}</p>
      <p className="text-sm text-muted-foreground">
        La IA no está disponible en este momento. Comparte la liga de tu producto desde su página y
        escribe el anuncio con tus palabras: el precio y los datos de envío ya están ahí.
      </p>
    </div>
  );
}

/**
 * Kit de anuncios de un producto: 4 textos (WhatsApp, Facebook, Instagram y titular) que redacta la
 * IA con los datos del producto. El precio, los datos de envío, garantía y devoluciones, y la liga
 * con atribución los pone el código (P2, P4). La persona revisa y copia; nada se publica solo.
 *
 * Dos cosas distintas (ADR-038, `tasks/simulation.ts`):
 * - `availability` es la ruta de HOY: decide el botón y los avisos (con la IA simulada de un piloto
 *   se ofrecen «textos de ejemplo»; sin IA disponible no se ofrece generar).
 * - `kit.simulated` es de ESE kit: su etiqueta sigue al proveedor que lo escribió. Sin IA disponible
 *   no se muestra un kit simulado (nada de plantillas), pero uno que escribió un modelo, sí.
 */
export function AdKitPanel({
  initial,
  availability,
}: {
  initial: AdKitView;
  availability: AiAvailability;
}) {
  const [state, formAction, pending] = useActionState<AdKitState, FormData>(
    generateAdKitAction,
    {},
  );
  const view = state.view ?? initial;
  const { product, usage } = view;
  const simulated = availability === "simulated";
  const unavailable = availability === "unavailable";
  // Sin IA disponible no se entregan plantillas: un kit simulado guardado no se muestra.
  const kit = unavailable && view.kit?.simulated ? null : view.kit;

  return (
    <div data-ai-availability={availability} className="flex flex-col gap-4">
      <section className="dark flex flex-col gap-3 rounded-3xl border bg-card p-5 text-foreground">
        {availability === "real" ? (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-ai px-2.5 py-1 text-xs font-bold text-ai-foreground">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Kit de anuncios
          </span>
        ) : (
          // La lima es solo de la IA: sin un modelo de verdad, el distintivo es neutro.
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
            Kit de anuncios
          </span>
        )}
        <h2 className="font-heading text-2xl leading-tight font-extrabold tracking-heading">
          {product.title}
        </h2>
        <p className="text-sm text-ink-2">
          {product.priceLabel} ·{" "}
          {unavailable
            ? "Comparte tu producto con tus palabras: el precio, el envío y la liga ya están en su página."
            : "Textos listos para compartir, escritos con los datos de tu producto. El precio, el envío y la liga los ponemos nosotros; revísalos antes de publicar."}
        </p>
        {simulated ? (
          <p className="text-sm text-ink-2">
            Piloto: la IA está simulada. Verás textos de ejemplo armados con los datos de tu
            producto, no escritos por un modelo de IA.
          </p>
        ) : null}
        {product.unavailable ? (
          <p role="status" className="text-sm text-ink-2">
            Este producto no puede llevar kit ahora ({product.unavailable.toLowerCase()}). Actívalo
            desde Productos.
          </p>
        ) : unavailable ? (
          <WriteByHand />
        ) : (
          <form action={formAction} className="flex flex-col gap-2">
            <input type="hidden" name="productId" value={product.id} />
            <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
              {kit ? (
                <RefreshCw data-icon="inline-start" />
              ) : simulated ? (
                <FileText data-icon="inline-start" />
              ) : (
                <Sparkles data-icon="inline-start" />
              )}
              {simulated
                ? pending
                  ? "Armando tus textos de ejemplo…"
                  : kit
                    ? "Crear otros textos de ejemplo"
                    : "Crear textos de ejemplo"
                : pending
                  ? "La IA está escribiendo tus anuncios…"
                  : kit
                    ? "Crear otro kit"
                    : "Crear mi kit con IA"}
            </Button>
            <p className="text-xs text-ink-2">
              {simulated
                ? `Llevas ${usage.used} de ${formatCount(usage.limit, "uso", "usos")} este mes (cuentan también las propuestas de Vende con IA).`
                : `Llevas ${usage.used} de ${formatCount(usage.limit, "generación", "generaciones")} con IA este mes (cuenta todo lo que haces con IA).`}
            </p>
          </form>
        )}
      </section>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {kit ? (
        <>
          {kit.stale ? (
            <p className="flex items-start gap-2 rounded-2xl bg-secondary px-3 py-2 text-sm">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Tu producto cambió después de crear este kit. El precio y los datos ya están
              actualizados y quitamos lo que ya no aplica; aun así, revisa los textos o crea uno
              nuevo.
            </p>
          ) : null}
          {kit.guard.removed > 0 ? (
            <p className="flex items-start gap-2 rounded-2xl bg-secondary px-3 py-2 text-sm">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {kit.guard.removed === 1
                ? "Quitamos 1 frase"
                : `Quitamos ${kit.guard.removed} frases`}{" "}
              que {kit.simulated ? "no podíamos" : "la IA no podía"} respaldar con los datos de tu
              producto: promesas de envío, garantía o entrega que no tienes, urgencia, datos de
              contacto o cifras distintas.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Creado el {kit.createdAtLabel} · Las visitas que lleguen por estas ligas aparecen en tu
            Studio como «Links compartidos».
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {kit.variants.map((variant) => (
              <VariantCard
                key={variant.channel}
                productId={product.id}
                variant={variant}
                simulated={kit.simulated}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
