"use client";

import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronRight,
  Eye,
  Handshake,
  Heart,
  type LucideIcon,
  MapPin,
  MessageCircle,
  PenLine,
  Search,
  SendHorizontal,
  Share2,
  ShieldCheck,
  Sparkles,
  Truck,
  Undo2,
  Camera,
  LockKeyhole,
  ExternalLink,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand/brand-mark";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { UserAvatar } from "@/components/brand/user-avatar";
import { MediaCarousel } from "@/components/media/media-carousel";
import { MediaCollage } from "@/components/media/media-collage";
import { tapHaptic } from "@/lib/haptics";
import { formatCompactNumber, formatCount, formatMoney, formatRelativeTime } from "@/lib/format";
import { FEED_FRAME, frameAspect, PRODUCT_FRAME } from "@/lib/image";
import { PROFILE_TRANSITION } from "@/lib/page-turn";
import { cn } from "@/lib/utils";
import { COLLABORATION_LABEL } from "@/modules/creators/rules";
import {
  localDeliveryLine,
  nationalShippingLine,
  type ProductFacts,
} from "@/modules/catalog/quick-answers";
import {
  type CardVariant,
  extractHeadline,
  type HeadlineSize,
  headlineSize,
} from "@/modules/feed/card-variant";
import type {
  FeedIntentDTO,
  FeedItemDTO,
  FeedMediaDTO,
  ProductAvailability,
} from "@/modules/feed/dto";
import { type ReactResult, reactAction, type ToggleResult, toggleSaveAction } from "../actions";
import { canHaveContext } from "../context-rules";
import { recordShareAction } from "../interaction-actions";
import { getPostTextAction } from "../post-text-actions";
import { postTextPreview } from "../post-text";
import { applyReaction, type ReactionKind, type ReactionState } from "../reactions";
import { ContextButton } from "./context-button";
import { PostVideo } from "./post-video";
import { MentionText } from "./mention-text";
import { PostOwnerMenu } from "./post-owner-menu";
import { ReactionButton, reactionLabel } from "./reaction-button";

type Post = FeedItemDTO;
type Product = NonNullable<Post["product"]>;
type Community = NonNullable<Post["community"]>;

/** Crear cuenta y volver a donde estaba (la persona visitante no tiene toggles optimistas). */
export function signUpHref(next: string) {
  return `/registro?next=${encodeURIComponent(next)}` as Route;
}

const AVAILABILITY_LABELS: Record<Exclude<ProductAvailability, "available">, string> = {
  sold_out: "Agotado",
  paused: "Pausado",
  unavailable: "No disponible",
};

const LONG_BODY = 220;

type Toggle = { active: boolean; count: number };

function useToggle(
  initial: Toggle,
  action: () => Promise<ToggleResult>,
  /** Al activar (no al quitar): avisos como «Guardado». */
  onActivate?: () => void,
) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(confirmed);
  const [, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      const activating = !optimistic.active;
      setOptimistic({
        active: activating,
        count: optimistic.count + (activating ? 1 : -1),
      });
      // Micro-respuesta (ADR-052): un «clic» en el pulgar al activar; nunca al quitar.
      if (activating) {
        tapHaptic();
        onActivate?.();
      }
      const result = await action();
      if (result.ok) {
        setConfirmed({
          active: result.active,
          count: result.count >= 0 ? result.count : confirmed.count,
        });
      } else if (result.needsAuth) {
        // La sesión venció entre la carga y el toque: se invita a entrar sin perder la página.
        toast(result.error, {
          action: {
            label: "Entrar",
            onClick: () =>
              router.push(`/entrar?next=${encodeURIComponent(window.location.pathname)}` as Route),
          },
        });
      } else {
        toast.error(result.error);
      }
    });
  return [optimistic, toggle] as const;
}

/**
 * Reacciones (ADR-054) con estado optimista: `react(kind)` pone esa reacción (repetir la que ya
 * está la quita), `toggle()` es el toque simple (❤️ o quitar la puesta). El servidor devuelve el
 * estado real (reacción, total y resumen); con `count` negativo (carrera entre dos toques) se
 * conserva lo que ya había.
 */
function useReaction(
  initial: ReactionState,
  action: (kind: ReactionKind | null) => Promise<ReactResult>,
) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(confirmed);
  const [, startTransition] = useTransition();

  const react = (kind: ReactionKind | null) =>
    startTransition(async () => {
      const next = kind === optimistic.kind ? null : kind;
      setOptimistic(applyReaction(optimistic, next));
      // Micro-respuesta (ADR-052): un «clic» en el pulgar al reaccionar; nunca al quitar.
      if (next !== null) tapHaptic();
      const result = await action(next);
      if (result.ok) {
        setConfirmed(
          result.count >= 0
            ? { kind: result.kind, count: result.count, top: result.top }
            : { ...confirmed, kind: result.kind },
        );
      } else if (result.needsAuth) {
        toast(result.error, {
          action: {
            label: "Entrar",
            onClick: () =>
              router.push(`/entrar?next=${encodeURIComponent(window.location.pathname)}` as Route),
          },
        });
      } else {
        toast.error(result.error);
      }
    });
  const toggle = () => react(optimistic.kind ?? "LIKE");
  return [optimistic, react, toggle] as const;
}

// ─────────────────────────────── Piezas pequeñas ───────────────────────────────

function Dot() {
  return <span aria-hidden="true">·</span>;
}

/** Etiqueta de IA: la lima es solo para la IA (ADR-027). */
function AiMark() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <span
        aria-hidden="true"
        className="grid size-3.5 place-items-center rounded-sm bg-secondary text-ink-2"
      >
        <Sparkles className="size-2.5" />
      </span>
      Con ayuda de IA
    </span>
  );
}

function EditorialBadge({ hue }: { hue: number | undefined }) {
  return (
    <span
      style={hue === undefined ? undefined : ({ "--hue": hue } as CSSProperties)}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-1.5 py-px text-[10px] font-bold tracking-wide text-muted-foreground uppercase"
    >
      <PenLine aria-hidden="true" className="size-2.5" />
      Editorial
    </span>
  );
}

function CommunityChip({ community }: { community: Community }) {
  return (
    <Link
      href={`/c/${community.slug}` as Route}
      className="inline-flex min-w-0 items-center gap-1 rounded-full bg-secondary py-0.5 pr-2 pl-0.5 font-semibold text-ink-2 transition-colors hover:bg-accent"
    >
      <CommunityAvatar
        name={community.name}
        emoji={community.emoji}
        hue={community.hue}
        size="sm"
        decorative
        className="size-4 rounded-full text-[9px]"
      />
      <span className="truncate">{community.name}</span>
    </Link>
  );
}

/**
 * Cabecera. Cuenta editorial: empieza por la comunidad (su avatar con el sello de speeaking, su nombre
 * y la insignia «Editorial» en su color) y debajo el equipo y la hora. Personas y tiendas: su
 * avatar y nombre, «Tienda» si venden, y la comunidad como chip pequeño.
 */
function CardHeader({ post, onDeleted }: { post: Post; onDeleted: () => void }) {
  const { author, community } = post;
  const profileHref = `/u/${author.username}` as Route;
  // Cada dato lleva su «·» delante: si la línea no cabe (portada angosta), el siguiente baja
  // completo en lugar de recortar el nombre.
  const meta = (afterLead = true) => (
    <>
      <span className="inline-flex shrink-0 items-center gap-1">
        {afterLead ? <Dot /> : null}
        {/* «hace 15 min» se calcula en el servidor y otra vez al hidratar: si en medio cambia el
            minuto, el texto difiere y React regeneraría todo el árbol. La diferencia es esperada. */}
        <time dateTime={post.publishedAt} suppressHydrationWarning>
          {formatRelativeTime(new Date(post.publishedAt))}
        </time>
      </span>
      {post.audience === "friends" ? (
        <span className="inline-flex shrink-0 items-center gap-1" title="Solo amigos aceptados">
          <Dot />
          <LockKeyhole className="size-3" aria-hidden="true" />
          <span className="sr-only">Solo amigos</span>
        </span>
      ) : null}
      {post.isAiGenerated ? (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Dot />
          <AiMark />
        </span>
      ) : null}
    </>
  );
  const metaLine =
    "flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground";

  if (author.isEditorial) {
    return (
      <header className="flex items-center gap-3">
        {community ? (
          <Link
            href={`/c/${community.slug}` as Route}
            aria-hidden="true"
            tabIndex={-1}
            className="shrink-0"
          >
            <CommunityAvatar
              name={community.name}
              emoji={community.emoji}
              hue={community.hue}
              size="sm"
              editorial
              decorative
              className="size-10 rounded-xl text-xl"
            />
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary"
          >
            <BrandMark className="size-7" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
          <div className="flex min-w-0 items-center gap-1.5">
            {community ? (
              <Link
                id={`comunidad-${post.id}`}
                href={`/c/${community.slug}` as Route}
                className="truncate font-semibold hover:underline"
              >
                {community.name}
              </Link>
            ) : (
              <Link
                id={`autor-${post.id}`}
                href={profileHref}
                transitionTypes={PROFILE_TRANSITION}
                className="truncate font-semibold hover:underline"
              >
                {author.displayName}
              </Link>
            )}
            <EditorialBadge hue={community?.hue} />
          </div>
          <p className={metaLine}>
            {community ? (
              <Link
                id={`autor-${post.id}`}
                href={profileHref}
                transitionTypes={PROFILE_TRANSITION}
                className="truncate font-medium hover:text-foreground"
              >
                {author.displayName}
              </Link>
            ) : null}
            {meta(community !== null)}
          </p>
        </div>
        {post.viewer.canDelete ? (
          <PostOwnerMenu
            postId={post.id}
            hasProduct={post.product !== null}
            onDeleted={onDeleted}
          />
        ) : null}
      </header>
    );
  }

  return (
    <header className="flex items-center gap-3">
      <Link
        href={profileHref}
        transitionTypes={PROFILE_TRANSITION}
        aria-hidden="true"
        tabIndex={-1}
        className="shrink-0"
      >
        <UserAvatar name={author.displayName} seed={author.username} src={author.avatarUrl} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            id={`autor-${post.id}`}
            href={profileHref}
            transitionTypes={PROFILE_TRANSITION}
            className="truncate font-semibold hover:underline"
          >
            {author.displayName}
          </Link>
          {author.isSeller ? (
            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-px text-[10px] font-bold tracking-wide text-ink-2 uppercase">
              Tienda
            </span>
          ) : null}
        </div>
        <p className={metaLine}>
          {community ? (
            <CommunityChip community={community} />
          ) : (
            <span className="truncate">@{author.username}</span>
          )}
          {meta()}
        </p>
      </div>
      {post.viewer.canDelete ? (
        <PostOwnerMenu postId={post.id} hasProduct={post.product !== null} onDeleted={onDeleted} />
      ) : null}
    </header>
  );
}

/** «Porque buscas “…”»: chip neutro con la búsqueda que coincidió (nunca una que no ocurrió). */
function IntentChip({ intent }: { intent: FeedIntentDTO }) {
  return (
    <p
      data-slot="intent-chip"
      className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-ink-2"
    >
      {intent.basis === "query" ? (
        <>
          <Search aria-hidden="true" className="size-3.5 shrink-0" />
          {/* Solo la búsqueda se recorta; las comillas quedan pegadas a ella. */}
          <span className="flex min-w-0 whitespace-pre">
            <span className="shrink-0">
              {intent.source === "declared" ? "Porque buscas " : "Porque buscaste "}“
            </span>
            <span className="min-w-0 truncate">{intent.query}</span>
            <span className="shrink-0">”</span>
          </span>
        </>
      ) : (
        <>
          <Eye aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">Por lo que has visto en {intent.categoryName}</span>
        </>
      )}
    </p>
  );
}

function PostBody({
  text,
  expanded,
  className,
  postId,
  bodyTruncated = false,
  omitHeadline = false,
}: {
  text: string;
  expanded: boolean;
  className?: string;
  postId: string;
  bodyTruncated?: boolean;
  omitHeadline?: boolean;
}) {
  const [showAll, setShowAll] = useState(expanded);
  const [loadedBody, setLoadedBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!text) return null;
  const completeText =
    loadedBody === null ? text : omitHeadline ? extractHeadline(loadedBody).rest : loadedBody;
  const isLong = bodyTruncated || completeText.length > LONG_BODY;
  // Las publicaciones editoriales pueden citar una fuente al final. El texto sigue almacenado
  // completo para búsquedas y metadatos; aquí se presenta la liga con un nombre legible.
  const citation = /\n\nFuente: ([^\n]+?) — (https:\/\/[^\s]+)$/.exec(completeText);
  let source: { title: string; url: string; body: string } | null = null;
  if (citation) {
    try {
      const url = new URL(citation[2]!);
      if (url.protocol === "https:" && !url.username && !url.password) {
        source = {
          title: citation[1]!,
          url: url.href,
          body: completeText.slice(0, citation.index),
        };
      }
    } catch {
      /* Una cita mal formada se muestra como texto sin crear un enlace. */
    }
  }
  return (
    <div className={cn("text-[15px] leading-relaxed", className)}>
      <p className={cn("break-words whitespace-pre-line", !showAll && isLong && "line-clamp-4")}>
        <MentionText
          text={
            showAll ? (source?.body ?? completeText) : postTextPreview(source?.body ?? completeText)
          }
        />
      </p>
      {source && (showAll || !isLong) ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="mt-3 inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        >
          <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          Fuente: {source.title}
        </a>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {isLong && !expanded ? (
        <button
          type="button"
          // El área táctil crece con `after` (44 px de alto) sin mover el texto.
          className="relative mt-1 text-sm font-semibold text-muted-foreground after:absolute after:-inset-x-2 after:-inset-y-3 hover:text-foreground"
          disabled={pending}
          aria-expanded={showAll}
          onClick={() => {
            if (showAll) {
              setShowAll(false);
              return;
            }
            if (!bodyTruncated || loadedBody !== null) {
              setShowAll(true);
              return;
            }
            setError(null);
            startTransition(async () => {
              try {
                const result = await getPostTextAction(postId);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setLoadedBody(result.body);
                setShowAll(true);
              } catch {
                setError("No pudimos cargar el texto. Intenta otra vez.");
              }
            });
          }}
        >
          {pending ? "Cargando texto…" : showAll ? "Ver menos" : "Ver más"}
        </button>
      ) : null}
    </div>
  );
}

/** «Foto: <autor> · <licencia>», enlazado al perfil del autor de la foto de stock. */
function PhotoCredit({ media, className }: { media: FeedMediaDTO[]; className?: string }) {
  const seen = new Set<string>();
  const credits = media.flatMap((item) => {
    const credit = item.credit;
    if (!credit) return [];
    const key = `${credit.name}|${credit.license ?? ""}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [credit];
  });
  if (credits.length === 0) return null;
  return (
    <p className={cn("text-[11px] leading-snug text-muted-foreground", className)}>
      {credits.length === 1 ? "Foto" : "Fotos"}:{" "}
      {credits.slice(0, 3).map((credit, index) => (
        <Fragment key={`${credit.name}|${credit.license ?? ""}`}>
          {index > 0 ? ", " : null}
          {credit.url ? (
            <a
              href={credit.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium underline-offset-2 hover:text-foreground hover:underline"
            >
              {credit.name}
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          ) : (
            credit.name
          )}
          {credit.license ? ` · ${credit.license}` : null}
        </Fragment>
      ))}
    </p>
  );
}

// ─────────────────────────────── Producto (P4) ───────────────────────────────

/**
 * Etiqueta de precio sobre la foto: el único lugar de la tarjeta donde aparece el precio. Si el
 * producto no está disponible no hay etiqueta: el bloque del producto dice por qué.
 */
function PriceTag({ product, href }: { product: Product; href: Route }) {
  if (product.availability !== "available") return null;
  return (
    <Link
      href={href}
      // `after:-inset-1`: 36 px a la vista y 44 px al tacto.
      // Pastilla blanca con el precio y una flecha en tinta (ADR-042): sin círculo rosa.
      className="absolute bottom-3 left-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-card pr-2.5 pl-3 font-heading text-[15px] font-extrabold text-foreground shadow-lg transition-transform after:absolute after:-inset-1 motion-safe:hover:-translate-y-px"
    >
      {formatMoney(product.priceCents, product.currency)}
      <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
      <span className="sr-only">, ver {product.title}</span>
    </Link>
  );
}

/**
 * Sobre el video (ADR-063): el precio y «Ver cómo me veo», para ir del video a probarse la prenda y
 * comprarla. Sin etiqueta si el producto no está disponible (el bloque de abajo dice por qué).
 */
function VideoProductTags({ product, href }: { product: Product; href: Route }) {
  const pill =
    "relative inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-sm font-bold text-foreground shadow-lg after:absolute after:-inset-1";
  return (
    <>
      <Link href={href} className={cn(pill, "font-heading text-[15px] font-extrabold")}>
        {formatMoney(product.priceCents, product.currency)}
        <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="sr-only">, ver {product.title}</span>
      </Link>
      {product.tryOn ? (
        <Link
          href={`${href}${href.includes("?") ? "&" : "?"}probar=1` as Route}
          aria-label={`Ver cómo me veo: ${product.title}`}
          className={pill}
        >
          <Camera aria-hidden="true" className="size-4" />
          Ver cómo me veo
        </Link>
      ) : null}
    </>
  );
}

/**
 * «Colaboración» encima del video (ADR-063): visual, sin acción (los toques llegan al video); el
 * nombre de la tienda y el texto para lectores de pantalla ya están en `CollaborationChip`.
 */
function VideoCollaborationLabel() {
  return (
    <span
      aria-hidden="true"
      data-slot="video-collaboration"
      className="pointer-events-none! inline-flex h-7 items-center gap-1 rounded-full bg-black/60 px-2.5 text-xs font-semibold text-white backdrop-blur-sm"
    >
      <Handshake className="size-3.5" />
      {COLLABORATION_LABEL}
    </span>
  );
}

/** «Colaboración con <tienda>» (ADR-063): la publicidad se identifica, arriba de la tarjeta. */
function CollaborationChip({ store }: { store: string }) {
  return (
    <p
      data-slot="collaboration-chip"
      className="inline-flex max-w-full items-center gap-1.5 self-start justify-self-start rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-ink-2"
    >
      <Handshake aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate">Colaboración con {store}</span>
    </p>
  );
}

type Fact = { key: string; icon: LucideIcon; text: string };

/** Datos verificables en una línea cada uno, con las mismas reglas que la ficha y el checkout. */
function productFacts(facts: ProductFacts): Fact[] {
  const lines: Fact[] = [];
  const national = nationalShippingLine(facts);
  if (national) lines.push({ key: "envio", icon: Truck, text: national });
  const local = localDeliveryLine(facts);
  if (local) lines.push({ key: "local", icon: MapPin, text: local });
  if (facts.returnWindowDays > 0) {
    lines.push({
      key: "devoluciones",
      icon: Undo2,
      text: `${formatCount(facts.returnWindowDays, "día", "días")} para devolverlo`,
    });
  }
  if (facts.warrantyType !== "NONE") {
    const who = facts.warrantyType === "SELLER" ? "del vendedor" : "del fabricante";
    lines.push({
      key: "garantia",
      icon: ShieldCheck,
      text: facts.warrantyDays
        ? `Garantía ${who} de ${formatCount(facts.warrantyDays, "día", "días")}`
        : `Garantía ${who}`,
    });
  }
  return lines;
}

function ProductBlock({
  product,
  href,
  withinBudget,
  showPrice,
  showTryOn = true,
}: {
  product: Product;
  href: Route;
  withinBudget: boolean;
  /** Sin foto no hay etiqueta de precio: el precio va aquí (una sola vez por tarjeta). */
  showPrice: boolean;
  /** `false` cuando «Ver cómo me veo» ya va sobre el video (una sola vez por tarjeta). */
  showTryOn?: boolean;
}) {
  const facts = productFacts(product.facts);
  const unavailable =
    product.availability === "available" ? null : AVAILABILITY_LABELS[product.availability];
  const available = unavailable === null;
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border bg-background p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="line-clamp-2 font-heading leading-snug font-bold tracking-title">
            {product.title}
          </p>
          {/* El producto es de otra tienda, no de quien publica (ADR-063): se dice de quién. */}
          {product.thirdPartyStore ? (
            <p className="truncate text-xs text-muted-foreground">
              Vendido por {product.thirdPartyStore}
            </p>
          ) : null}
          {unavailable ? (
            <p className="text-sm font-semibold text-muted-foreground">{unavailable}</p>
          ) : showPrice ? (
            <p className="font-heading text-lg font-extrabold">
              {formatMoney(product.priceCents, product.currency)}
            </p>
          ) : null}
        </div>
        {/* Enlace de texto, no botón (ADR-042): la acción principal de la tarjeta es abrir el producto. */}
        <Link
          href={href}
          className="relative inline-flex h-11 shrink-0 items-center gap-0.5 rounded-lg px-1 text-sm font-semibold text-foreground after:absolute after:-inset-1 hover:underline md:h-9"
        >
          Ver producto<span className="sr-only">: {product.title}</span>
          <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
        </Link>
      </div>
      {product.tryOn && available && showTryOn ? (
        // Una prenda se prueba desde el feed (ADR-046): la ficha abre con el diálogo listo.
        <Link
          href={`${href}${href.includes("?") ? "&" : "?"}probar=1` as Route}
          aria-label={`Ver cómo me veo: ${product.title}`}
          className="inline-flex h-11 items-center gap-1.5 self-start rounded-full bg-secondary px-3 text-sm font-bold text-foreground hover:bg-accent md:h-9"
        >
          <Camera aria-hidden="true" className="size-4" />
          Ver cómo me veo
        </Link>
      ) : null}
      {withinBudget && available ? (
        <p className="inline-flex items-center gap-1 self-start rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success">
          <Check aria-hidden="true" className="size-3.5" />
          En tu presupuesto
        </p>
      ) : null}
      {facts.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-dashed border-line-strong pt-2.5 text-[13px] leading-snug text-ink-2">
          {facts.map((fact) => (
            <li key={fact.key} className="flex items-start gap-2">
              <fact.icon
                aria-hidden="true"
                className="mt-px size-4 shrink-0 text-muted-foreground"
              />
              {fact.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─────────────────────────────── Conversación ───────────────────────────────

// En móvil cada acción mide al menos 44 × 44 px (objetivo táctil); en escritorio, 36 px de alto.
const actionClass =
  "inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground motion-reduce:transition-none md:h-9 md:min-w-0";

/**
 * Acciones. En escritorio llevan texto; en móvil solo el ícono (y el número si no es cero). Una
 * persona visitante no tiene toggles: «Me gusta» y «Guardar» la llevan a crear su cuenta.
 */
function ActionBar({
  post,
  isSignedIn,
  reaction,
  onReact,
  toggleReaction,
  compact = false,
  onPostPage = false,
}: {
  post: Post;
  isSignedIn: boolean;
  /**
   * Estado y acciones de reaccionar (ADR-054): viven en la tarjeta porque el doble toque en la
   * foto también da ❤️.
   */
  reaction: ReactionState;
  onReact: (kind: ReactionKind) => void;
  toggleReaction: () => void;
  /**
   * En la página de la publicación «Comentar» es un ancla nativa (`#comentar`): dispara
   * `hashchange` y el formulario toma el foco (Link cambia la URL sin ese evento).
   */
  onPostPage?: boolean;
  /**
   * Columna angosta (portada): barra compacta de íconos y números también en escritorio (las
   * palabras no caben y se partían). Los textos quedan ocultos a la vista pero el nombre accesible
   * no cambia (va en aria-label).
   */
  compact?: boolean;
}) {
  const secondaryLabel = compact ? "sr-only" : "hidden md:inline";
  const primaryLabel = compact ? "sr-only" : "hidden md:inline";
  const control = cn(actionClass, compact && "px-2");
  const pathname = usePathname();
  const router = useRouter();
  const [save, toggleSave] = useToggle(
    { active: post.viewer.saved, count: post.stats.saves },
    () => toggleSaveAction({ postId: post.id }),
    () =>
      toast("Guardado", {
        description: "Lo encuentras en Guardados cuando quieras.",
        action: { label: "Ver", onClick: () => router.push("/guardados" as Route) },
      }),
  );
  const signUp = signUpHref(pathname || "/");
  const comments = post.stats.comments;

  const share = async () => {
    const url = `${window.location.origin}/p/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.author.displayName,
          text: post.body.slice(0, 120),
          url,
        });
        void recordShareAction(post.id, "native");
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado");
        void recordShareAction(post.id, "copy");
      }
    } catch {
      // La persona canceló el diálogo de compartir: no es un error.
    }
  };

  const commentLabel =
    comments > 0 ? `Comentar, ${formatCount(comments, "comentario", "comentarios")}` : "Comentar";
  const commentContent = (
    <>
      <MessageCircle aria-hidden="true" className="size-5" />
      <span className={primaryLabel}>Comentar</span>
      {comments > 0 ? <span className="tabular-nums">{formatCompactNumber(comments)}</span> : null}
    </>
  );
  const saveContent = (
    <>
      <Bookmark aria-hidden="true" className={cn("size-5", save.active && "fill-current")} />
      <span className={secondaryLabel}>Guardar</span>
    </>
  );

  return (
    <footer className="-mx-2 flex items-center gap-0.5">
      {isSignedIn ? (
        <ReactionButton
          state={reaction}
          onReact={onReact}
          onToggle={toggleReaction}
          className={control}
          labelClassName={primaryLabel}
        />
      ) : (
        <Link href={signUp} aria-label={reactionLabel(reaction)} className={control}>
          <Heart aria-hidden="true" className="size-5" />
          <span className={primaryLabel}>Me gusta</span>
          {reaction.count > 0 ? (
            <span className="tabular-nums">{formatCompactNumber(reaction.count)}</span>
          ) : null}
        </Link>
      )}
      {onPostPage ? (
        <a href="#comentar" aria-label={commentLabel} className={control}>
          {commentContent}
        </a>
      ) : (
        <Link
          href={`/p/${post.id}/comentarios` as Route}
          aria-label={commentLabel}
          className={control}
        >
          {commentContent}
        </Link>
      )}
      {isSignedIn ? (
        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={save.active}
          aria-label="Guardar"
          className={cn(control, "ml-auto", save.active && "text-foreground")}
        >
          {saveContent}
        </button>
      ) : (
        <Link href={signUp} aria-label="Guardar" className={cn(control, "ml-auto")}>
          {saveContent}
        </Link>
      )}
      <button type="button" onClick={share} aria-label="Compartir" className={control}>
        <Share2 aria-hidden="true" className="size-5" />
        <span className={secondaryLabel}>Compartir</span>
      </button>
    </footer>
  );
}

/**
 * Fila de respuesta: abre el panel de comentarios (ADR-057). Sin comentarios, en lugar de un cero
 * invita con honestidad a abrir la conversación.
 */
function ReplyRow({ post, isSignedIn }: { post: Post; isSignedIn: boolean }) {
  const postPath = `/p/${post.id}`;
  return (
    <Link
      href={isSignedIn ? (`${postPath}/comentarios` as Route) : signUpHref(postPath)}
      className="flex h-11 items-center gap-2 rounded-full bg-secondary pr-3 pl-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground motion-reduce:transition-none"
    >
      <span className="min-w-0 flex-1 truncate">
        {post.stats.comments === 0 ? "Sé la primera persona en comentar" : "¿Qué opinas?"}
      </span>
      <SendHorizontal aria-hidden="true" className="size-4 shrink-0" />
    </Link>
  );
}

// ─────────────────────────────── Tarjeta ───────────────────────────────

/**
 * Titular de la portada: baja de tamaño con el largo para no pasar de 3 líneas. En escritorio
 * también sigue el ancho de su columna (`cqi`, la columna es `@container`): 330 px a 1352 px de
 * ventana (36 / 26 / 21 px) y 274 px a 1280 px (30 / 22 / 18 px). Medido con la fuente real.
 */
const HEADLINE_CLASSES: Record<HeadlineSize, string> = {
  lg: "text-[1.75rem] md:text-[length:clamp(1.75rem,11cqi,2.25rem)]",
  md: "text-2xl md:text-[length:clamp(1.375rem,7.9cqi,1.625rem)]",
  sm: "text-xl md:text-[length:clamp(1.125rem,6.4cqi,1.3125rem)]",
};

export function PostCard({
  post,
  index = 0,
  expanded = false,
  reel = false,
  initialMediaIndex = 0,
  isSignedIn = true,
  variant = "standard",
  layout = "card",
  children,
}: {
  post: FeedItemDTO;
  index?: number;
  expanded?: boolean;
  /** En Videos / Reels conserva el encuadre completo del video. */
  reel?: boolean;
  /**
   * `theater`: visor de la capa en escritorio (ADR-064). Con fotos o video, la imagen queda a la
   * izquierda ajustada a la ventana y todo lo demás (texto, acciones y `children`) a la derecha.
   * En pantallas angostas se ve igual que la tarjeta abierta.
   */
  layout?: "card" | "theater";
  /** Lo que sigue a las acciones dentro de la publicación (comentarios en el visor). */
  children?: ReactNode;
  /** Foto con la que abre el carrusel (p. ej. la que se tocó en el collage del feed). */
  initialMediaIndex?: number;
  /**
   * `false` para visitantes: sin toggles optimistas, «Me gusta», «Guardar» y responder llevan a
   * crear cuenta. Sin especificar se comporta como antes (la acción pide entrar si hace falta).
   */
  isSignedIn?: boolean;
  /** Cómo se pinta en el feed (ver `pickCardVariant`). Fuera del feed, estándar. */
  variant?: CardVariant;
}) {
  const [deleted, setDeleted] = useState(false);
  const community = post.community;
  const product = post.product;
  const isSale = post.type === "PRODUCT" || product !== null;
  const [reaction, react, toggleReaction] = useReaction(
    { kind: post.viewer.reaction, count: post.stats.likes, top: post.stats.reactions },
    (kind) => reactAction(post.id, kind),
  );
  // Doble toque sobre la foto (vista abierta): da ❤️ si no hay reacción, nunca la quita (ADR-052).
  const likeByDoubleTap = isSignedIn
    ? () => {
        if (reaction.kind === null) react("LIKE");
      }
    : undefined;
  const images = post.media.map((media, mediaIndex) => ({
    ...media,
    // `||`: un texto alternativo vacío dejaría sin nombre el enlace del mosaico.
    alt:
      media.alt?.trim() ||
      (product
        ? `${product.title}, foto ${mediaIndex + 1}`
        : `Imagen ${mediaIndex + 1} de la publicación de ${post.author.displayName}`),
  }));
  const cover = images[0];
  const productHref = product ? (`/producto/${product.slug}?from=${post.id}` as Route) : null;
  const intent = product ? (post.ranking?.intent ?? null) : null;
  const labelledBy =
    post.author.isEditorial && community
      ? `comunidad-${post.id} autor-${post.id}`
      : `autor-${post.id}`;
  const style = {
    animationDelay: `${(index % 6) * 60}ms`,
    ...(community ? { "--hue": community.hue } : {}),
  } as CSSProperties;
  const showReply = !expanded && product === null;
  // Video con producto disponible: el precio y «Ver cómo me veo» van sobre el video (ADR-063). Si
  // es una colaboración, la etiqueta también va encima: se ve durante todo el video aunque la
  // tarjeta ya no se vea completa (guía de publicidad de la PROFECO).
  const collaborationStore = post.collaboration ? (product?.thirdPartyStore ?? null) : null;
  const productOnVideo =
    product !== null && productHref !== null && product.availability === "available";
  const videoTags =
    post.video && (collaborationStore || productOnVideo) ? (
      <>
        {collaborationStore ? <VideoCollaborationLabel /> : null}
        {productOnVideo ? <VideoProductTags product={product} href={productHref} /> : null}
      </>
    ) : null;
  // Carrusel en la publicación abierta y en una venta de una sola foto; mosaico en lo demás.
  const useCarousel = expanded || (isSale && images.length === 1);
  const shell =
    "flex flex-col gap-3 border-b bg-card px-4 py-4 motion-safe:animate-rise md:rounded-3xl md:border";
  // Abierta, la foto nunca es más alta que la ventana: se angosta conservando su proporción.
  const mediaAspect = cover ? frameAspect(cover, isSale ? PRODUCT_FRAME : FEED_FRAME) : 1;
  const theater = layout === "theater" && expanded && (cover !== undefined || Boolean(post.video));
  if (deleted) return null;

  // Portada: foto a la izquierda (300 px, como la maqueta) y titular, texto y conversación a la
  // derecha. Tarjeta blanca: la foto pone el color (`community-soft` es solo para selección). En
  // móvil, la foto arriba en 16:11 para que el titular quede a la vista.
  if (variant === "cover" && community && cover && !isSale) {
    const { headline, rest } = extractHeadline(post.body);
    return (
      <article
        data-variant="cover"
        className="overflow-hidden border-b bg-card motion-safe:animate-rise md:grid md:grid-cols-[300px_minmax(0,1fr)] md:rounded-3xl md:border"
        style={style}
        aria-labelledby={labelledBy}
      >
        <MediaCollage
          items={images}
          href={`/p/${post.id}`}
          preloadFirst={index === 0}
          className="aspect-[16/11]! rounded-none md:aspect-auto! md:h-full md:min-h-80"
        />
        <div className="@container flex min-w-0 flex-col gap-3 px-4 py-4 md:px-6 md:py-5">
          <CardHeader post={post} onDeleted={() => setDeleted(true)} />
          {headline ? (
            <h2
              data-size={headlineSize(headline)}
              className={cn(
                "font-heading leading-[1.05] font-extrabold tracking-heading text-balance text-foreground",
                HEADLINE_CLASSES[headlineSize(headline)],
              )}
            >
              {headline}
            </h2>
          ) : null}
          <PostBody
            text={rest}
            expanded={expanded}
            className="text-ink-2"
            postId={post.id}
            bodyTruncated={post.bodyTruncated}
            omitHeadline
          />
          {canHaveContext(post.body) ? <ContextButton postId={post.id} /> : null}
          <PhotoCredit media={post.media} />
          <div className="mt-auto flex flex-col gap-2">
            <ActionBar
              post={post}
              isSignedIn={isSignedIn}
              compact
              reaction={reaction}
              onReact={react}
              toggleReaction={toggleReaction}
            />
            {showReply ? <ReplyRow post={post} isSignedIn={isSignedIn} /> : null}
          </div>
        </div>
      </article>
    );
  }

  // Tipográfica: el texto corto en grande sobre un tinte suave de su comunidad con tinta encima
  // (`community-soft`, ADR-042). Ya no es un cartel de color saturado ni una isla oscura.
  if (variant === "bigType" && community && !cover && !post.video && !isSale) {
    return (
      <article
        data-variant="bigType"
        className="flex flex-col gap-4 border-b community-soft px-4 pt-5 pb-4 motion-safe:animate-rise md:rounded-3xl md:border md:px-6 md:pt-6"
        style={style}
        aria-labelledby={labelledBy}
      >
        <CardHeader post={post} onDeleted={() => setDeleted(true)} />
        <p className="font-heading text-[1.75rem] leading-[1.08] font-extrabold tracking-heading text-balance whitespace-pre-line md:text-[2rem]">
          <MentionText text={post.body} />
        </p>
        <div className="flex flex-col gap-2">
          <ActionBar
            post={post}
            isSignedIn={isSignedIn}
            reaction={reaction}
            onReact={react}
            toggleReaction={toggleReaction}
          />
          {showReply ? <ReplyRow post={post} isSignedIn={isSignedIn} /> : null}
        </div>
      </article>
    );
  }

  return (
    <article
      data-variant="standard"
      data-layout={theater ? "theater" : undefined}
      className={cn(shell, theater && THEATER)}
      style={style}
      aria-labelledby={labelledBy}
    >
      {intent ? <IntentChip intent={intent} /> : null}
      {collaborationStore ? <CollaborationChip store={collaborationStore} /> : null}
      <CardHeader post={post} onDeleted={() => setDeleted(true)} />
      <PostBody
        text={post.body}
        expanded={expanded}
        postId={post.id}
        bodyTruncated={post.bodyTruncated}
      />
      {canHaveContext(post.body) ? <ContextButton postId={post.id} /> : null}

      {/* Video corto (ADR-062): empieza solo y sin sonido al verse en el feed; abierto, con controles. */}
      {post.video ? (
        <MediaStage theater={theater}>
          <PostVideo
            video={post.video}
            expanded={expanded}
            reel={reel}
            overlay={videoTags}
            label={
              product
                ? `Video de ${product.title}`
                : `Video de la publicación de ${post.author.displayName}`
            }
          />
        </MediaStage>
      ) : null}

      {/* Varias fotos en el feed: mosaico como Facebook (ocupa poco y cada foto abre la publicación
          en ella), también en las ventas, con el precio en su bloque. Una sola foto de venta y la
          publicación abierta: carrusel de marco fijo (4:5 o cuadrado) con el precio encima. */}
      {cover ? (
        <MediaStage theater={theater}>
          <div
            className={cn(
              "flex flex-col gap-1.5",
              expanded && useCarousel && "mx-auto w-[min(100%,calc(78dvh*var(--media-aspect)))]",
              theater && "lg:w-[min(100%,calc(84dvh*var(--media-aspect)))]",
            )}
            style={
              expanded && useCarousel
                ? ({ "--media-aspect": mediaAspect } as CSSProperties)
                : undefined
            }
          >
            {useCarousel ? (
              <MediaCarousel
                items={images}
                label={
                  product
                    ? `Fotos de ${product.title}`
                    : `Fotos de la publicación de ${post.author.displayName}`
                }
                aspect={mediaAspect}
                preloadFirst={index === 0}
                initialIndex={initialMediaIndex}
                onDoubleTap={likeByDoubleTap}
                overlay={
                  product && productHref ? <PriceTag product={product} href={productHref} /> : null
                }
                className="rounded-2xl"
              />
            ) : (
              <MediaCollage items={images} href={`/p/${post.id}`} preloadFirst={index === 0} />
            )}
            <PhotoCredit media={post.media} className="text-right" />
          </div>
        </MediaStage>
      ) : null}

      {product && productHref ? (
        <ProductBlock
          product={product}
          href={productHref}
          withinBudget={post.viewer.withinBudget}
          showPrice={videoTags === null && (!cover || !useCarousel)}
          showTryOn={videoTags === null}
        />
      ) : null}

      <ActionBar
        post={post}
        isSignedIn={isSignedIn}
        onPostPage={expanded}
        // La columna del visor es angosta: barra de íconos, como en la portada.
        compact={theater}
        reaction={reaction}
        onReact={react}
        toggleReaction={toggleReaction}
      />
      {showReply ? <ReplyRow post={post} isSignedIn={isSignedIn} /> : null}
      {children}
    </article>
  );
}

/**
 * Visor de escritorio (ADR-064): la publicación es una rejilla de dos columnas. La imagen ocupa la
 * izquierda a todo lo alto de la capa y se queda fija mientras la derecha (autor, texto, acciones y
 * comentarios) se desplaza. Las filas vacías no miden nada: el espacio entre piezas va en márgenes.
 */
const THEATER =
  "lg:grid lg:grid-cols-[minmax(0,1fr)_25rem] lg:content-start lg:gap-0 lg:rounded-none lg:border-0 lg:p-0 lg:pb-5 lg:*:col-start-2 lg:*:mx-5 lg:*:mt-3 lg:*:first:mt-5 lg:*:first:mr-12";

/** El lado de la imagen en el visor; fuera de él no agrega nada. */
function MediaStage({ theater, children }: { theater: boolean; children: ReactNode }) {
  if (!theater) return children;
  return (
    <div
      data-slot="post-stage"
      className="lg:sticky lg:top-0 lg:col-start-1! lg:row-[1/span_40] lg:m-0! lg:grid lg:h-[92dvh] lg:min-w-0 lg:place-items-center lg:bg-black lg:p-4"
    >
      {children}
    </div>
  );
}
