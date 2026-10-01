import {
  CheckCircle2,
  EyeOff,
  MapPin,
  PackageCheck,
  ShieldCheck,
  ShieldQuestion,
  Truck,
  Undo2,
  Wallet,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { UserAvatar } from "@/components/brand/user-avatar";
import { MediaCarousel } from "@/components/media/media-carousel";
import { formatMoney } from "@/lib/format";
import { frameAspect, PRODUCT_FRAME } from "@/lib/image";
import { track } from "@/modules/analytics/track";
import { SponsoredCard } from "@/modules/billing/components/sponsored-products";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { ProductShareButton } from "@/modules/catalog/components/product-share-button";
import { QuickQuestions } from "@/modules/catalog/components/quick-questions";
import { SaveProductButton } from "@/modules/catalog/components/save-product-button";
import { CONDITION_LABELS } from "@/modules/catalog/dto";
import {
  getPublicProduct,
  listFeaturedProducts,
  listRelatedProducts,
} from "@/modules/catalog/queries";
import {
  answerQuickQuestion,
  localDeliveryLine,
  nationalShippingLine,
  stockLabel,
} from "@/modules/catalog/quick-answers";
import { getAdminViewer } from "@/modules/admin/guard";
import { BuyBox } from "@/modules/commerce/components/buy-box";
import { getViewer } from "@/modules/identity/session";
import { MessageButton } from "@/modules/messages/components/message-button";
import { FollowButton } from "@/modules/social/components/follow-button";
import { ProductStylistActions } from "@/modules/stylist/components/product-actions";
import { PostCard } from "@/modules/social/components/post-card";
import { hydratePosts } from "@/modules/social/post-queries";
import { AuthenticityNotice } from "@/modules/trust/components/authenticity-notice";
import { ReportButton } from "@/modules/trust/components/report-button";
import { db } from "@/server/db";
import { env } from "@/server/env";

export async function generateMetadata({
  params,
}: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const result = await getPublicProduct((await params).slug);
  if (!result) return {};
  const { product } = result;
  const title = `${product.title} · ${formatMoney(product.priceCents, product.currency)}`;
  const image = product.media[0];
  return {
    title,
    description: product.description.slice(0, 160),
    openGraph: {
      title,
      description: product.description.slice(0, 160),
      images: image ? [{ url: image.url, width: image.width, height: image.height }] : undefined,
    },
  };
}

/** Aviso a quien vende sobre la revisión de autenticidad de su producto (P14). */
const OWNER_AUTHENTICITY_NOTICES: Partial<
  Record<string, { title: string; text: string; link: string }>
> = {
  NEEDS_PROOF: {
    title: "Pedimos un comprobante de autenticidad",
    text: "Mientras no lo revisemos, quienes compran ven «Autenticidad sin verificar». Sube tu ticket o factura, o márcalo como genérico.",
    link: "Subir comprobante",
  },
  // Riesgo alto sin declararse original: la marca aparece con palabras de imitación.
  NEEDS_PROOF_NOT_DECLARED: {
    title: "Revisa cómo usas la marca en tu publicación",
    text: "Usa el nombre de una marca junto con palabras que suelen describir imitaciones. Si no es de la marca, quita la marca del título y la descripción; si es original, decláralo al editarlo y te pediremos un comprobante.",
    link: "Ver revisión",
  },
  PROOF_SUBMITTED: {
    title: "Estamos revisando tu comprobante",
    text: "Te avisamos en el Studio en cuanto el equipo lo revise.",
    link: "Ver revisión",
  },
  REJECTED: {
    title: "El equipo marcó este producto como genérico",
    text: "Revisa la nota del equipo en el Studio.",
    link: "Ver revisión",
  },
};

export default async function ProductPage({ params, searchParams }: PageProps<"/producto/[slug]">) {
  const { slug } = await params;
  const { from, ref, nuevo, probar } = await searchParams;
  const [viewer, admin] = await Promise.all([getViewer(), getAdminViewer()]);
  // Un producto oculto por moderación solo existe para su dueño y el equipo (404 para los demás).
  const result = await getPublicProduct(slug, {
    viewerUserId: viewer?.userId ?? null,
    isAdmin: admin !== null,
  });
  if (!result) notFound();
  const { product, categoryId, moderation } = result;

  const isOwner = viewer?.userId === product.seller.userId;
  const sourcePostId = typeof from === "string" && z.uuid().safeParse(from).success ? from : null;
  if (!moderation.hidden) {
    track({
      type: "PRODUCT_VIEW",
      userId: viewer?.userId ?? null,
      entityType: "PRODUCT",
      entityId: product.id,
      sourcePostId,
      surface: ref === "compartir" ? "SHARE_LINK" : sourcePostId ? "FEED" : "PRODUCT_PAGE",
      // Llegó desde un lugar patrocinado (ADR-046): la tienda ve estas visitas en Campañas.
      ...(ref === "destacado" ? { metadata: { placement: "destacado" } } : {}),
    });
  }
  const review = product.authenticityReview;
  const ownerNotice =
    isOwner && moderation.authenticityStatus
      ? OWNER_AUTHENTICITY_NOTICES[
          moderation.authenticityStatus === "NEEDS_PROOF" &&
          product.facts.authenticity !== "DECLARED_ORIGINAL"
            ? "NEEDS_PROOF_NOT_DECLARED"
            : moderation.authenticityStatus
        ]
      : undefined;

  const [related, sponsored, postRows, saved, followsSeller] = await Promise.all([
    listRelatedProducts(categoryId, product.id),
    listFeaturedProducts({
      limit: 1,
      excludeUserId: viewer?.userId ?? null,
      excludeProductId: product.id,
    }),
    db.post.findMany({
      where: { productId: product.id, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: { id: true },
    }),
    viewer
      ? db.savedItem.findUnique({
          where: { userId_productId: { userId: viewer.userId, productId: product.id } },
          select: { id: true },
        })
      : null,
    viewer && !isOwner
      ? db.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewer.userId,
              followingId: product.seller.userId,
            },
          },
          select: { followerId: true },
        })
      : null,
  ]);
  const posts = await hydratePosts(
    postRows.map((row) => row.id),
    viewer?.userId ?? null,
  );
  const inStock = product.facts.status === "ACTIVE" && product.facts.stock > 0;
  const shippingLine = nationalShippingLine(product.facts);
  const localLine = localDeliveryLine(product.facts);
  // Sin recortes: el marco toma la proporción de la portada (entre 4:5 y cuadrado, igual que en el
  // feed) y cada foto se muestra completa dentro de él, sobre un fondo difuminado si no lo llena.
  const cover = product.media[0];
  const details = [
    { icon: Truck, title: "Envío", text: answerQuickQuestion("shipping", product.facts) },
    {
      icon: MapPin,
      title: "Recoger en persona",
      text: answerQuickQuestion("pickup", product.facts),
    },
    { icon: Wallet, title: "Pagos", text: answerQuickQuestion("payment", product.facts) },
    { icon: ShieldCheck, title: "Garantía", text: answerQuickQuestion("warranty", product.facts) },
    { icon: Undo2, title: "Devoluciones", text: answerQuickQuestion("returns", product.facts) },
    {
      icon: PackageCheck,
      title: "Autenticidad",
      // Con comprobante pedido, la declaración «original» no se repite (P14).
      text: review.detail ?? answerQuickQuestion("authenticity", product.facts),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-6">
      {moderation.hidden ? (
        <p
          role="status"
          className="mx-4 mt-4 flex items-start gap-2 rounded-3xl bg-muted p-4 text-sm md:mx-0"
        >
          <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          {isOwner
            ? "El equipo ocultó este producto: no aparece en el feed, la búsqueda ni Comprar, y nadie más puede abrirlo. Solo tú lo ves."
            : "Oculto por moderación. Solo el equipo y quien lo vende pueden verlo."}
        </p>
      ) : null}
      {isOwner && nuevo ? (
        <div className="mx-4 mt-4 flex flex-col gap-3 rounded-3xl bg-success/10 p-4 md:mx-0">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-5 text-success" />
            ¡Listo! Tu producto ya está publicado.
          </p>
          <p className="text-sm">
            Compártelo por WhatsApp o Instagram para traer a tus primeros clientes.
          </p>
          <ProductShareButton
            productId={product.id}
            slug={product.slug}
            title={product.title}
            label="Compartir mi producto"
            variant="default"
          />
        </div>
      ) : null}

      <MediaCarousel
        items={product.media.map((media, index) => ({
          ...media,
          alt: media.alt?.trim() || `${product.title}, foto ${index + 1}`,
        }))}
        label={`Fotos de ${product.title}`}
        aspect={cover ? frameAspect(cover, PRODUCT_FRAME) : PRODUCT_FRAME.min}
        fit="contain"
        preloadFirst
        // La foto de la tarjeta que se tocó viaja hasta aquí (ADR-052).
        transitionName={`producto-${product.id}`}
        className="md:mt-2 md:rounded-3xl"
      />

      <section className="flex flex-col gap-3 px-4 md:px-0">
        <p className="text-sm text-muted-foreground">
          {product.category.name} · {CONDITION_LABELS[product.condition]}
        </p>
        <h1 className="text-2xl leading-tight font-extrabold md:text-3xl">{product.title}</h1>
        <p className="font-heading text-3xl font-extrabold">
          {formatMoney(product.priceCents, product.currency)}
        </p>
        <AuthenticityNotice view={review} />
        {shippingLine ? <p className="text-sm text-muted-foreground">{shippingLine}</p> : null}
        {localLine ? <p className="text-sm text-muted-foreground">{localLine}</p> : null}
        <p
          className={
            inStock
              ? "text-sm font-semibold text-success"
              : "text-sm font-semibold text-destructive"
          }
        >
          {stockLabel(product.facts)}
        </p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          {product.facts.city}, {product.facts.state}
        </p>

        {/* Probarse la prenda va antes de comprarla (ADR-046): a la vista, debajo del precio. */}
        {moderation.hidden ? null : (
          <ProductStylistActions
            product={{
              id: product.id,
              slug: product.slug,
              title: product.title,
              priceCents: product.priceCents,
              sellerId: product.seller.id,
              categorySlug: product.category.slug,
              tags: product.tags,
            }}
            viewerUserId={viewer?.userId ?? null}
            isOwner={isOwner}
            autoOpen={probar === "1"}
          />
        )}

        {ownerNotice ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-secondary p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldQuestion className="size-4 shrink-0" aria-hidden />
              {ownerNotice.title}
            </p>
            <p>{ownerNotice.text}</p>
            <Link
              href={`/studio/productos/${product.id}/autenticidad` as Route}
              className="-my-2 inline-flex min-h-11 w-fit items-center font-semibold text-primary-text underline"
            >
              {ownerNotice.link}
            </Link>
          </div>
        ) : null}

        {isOwner ? (
          <div className="flex flex-col gap-2 rounded-2xl border p-4 text-sm">
            <p className="font-semibold">Este producto es tuyo.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link
                href={`/studio/productos/${product.id}/editar` as Route}
                className="font-semibold text-primary-text underline"
              >
                Editar producto
              </Link>
              <Link href="/studio/productos" className="font-semibold text-primary-text underline">
                Ver en el Studio
              </Link>
            </div>
          </div>
        ) : moderation.hidden ? null : (
          <BuyBox
            productId={product.id}
            maxQuantity={Math.min(product.facts.stock, 10)}
            inStock={inStock}
            unavailableLabel={product.facts.status === "PAUSED" ? "Pausado" : "Agotado"}
            sourcePostId={sourcePostId}
          />
        )}

        <div className="flex gap-2">
          <ProductShareButton
            productId={product.id}
            slug={product.slug}
            title={product.title}
            text={`${product.title} · ${formatMoney(product.priceCents, product.currency)}`}
          />
          {!isOwner ? (
            <SaveProductButton productId={product.id} initialSaved={Boolean(saved)} />
          ) : null}
          {!isOwner && !moderation.hidden ? (
            <ReportButton
              targetType="PRODUCT"
              targetId={product.id}
              isSignedIn={Boolean(viewer)}
              returnTo={`/producto/${product.slug}`}
              className="ml-auto"
            />
          ) : null}
        </div>
      </section>

      <div className="mx-4 flex items-center gap-3 rounded-3xl border bg-card p-4 md:mx-0">
        <Link
          href={(product.seller.username ? `/u/${product.seller.username}` : "/") as Route}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <UserAvatar
            name={product.seller.displayName}
            seed={product.seller.username ?? product.seller.displayName}
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-xs text-muted-foreground">Vendido por</span>
            <span className="truncate font-semibold">{product.seller.displayName}</span>
          </span>
        </Link>
        {!isOwner && product.seller.username ? (
          <span className="flex shrink-0 gap-2">
            {/* Preguntar a la tienda (ADR-047): el primer mensaje llega con el producto. */}
            <MessageButton
              username={product.seller.username}
              isSignedIn={Boolean(viewer)}
              label="Preguntar"
              variant="soft"
              text={`Hola, te escribo por «${product.title}» (${env.APP_URL}/producto/${product.slug}).`}
            />
            <FollowButton
              targetUserId={product.seller.userId}
              targetName={product.seller.displayName}
              initialFollowing={Boolean(followsSeller)}
              isSignedIn={Boolean(viewer)}
              variant="soft"
            />
          </span>
        ) : null}
      </div>

      <div className="px-4 md:px-0">
        <QuickQuestions facts={product.facts} />
      </div>

      <section className="flex flex-col gap-2 px-4 md:px-0">
        <h2 className="text-lg font-bold">Descripción</h2>
        <p className="text-[15px] leading-relaxed whitespace-pre-line">{product.description}</p>
      </section>

      <section
        aria-label="Detalles de entrega y garantía"
        className="mx-4 grid gap-3 rounded-3xl border bg-card p-4 md:mx-0"
      >
        {details.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{title}</span>
              <span className="text-sm text-muted-foreground">{text}</span>
            </div>
          </div>
        ))}
      </section>

      {posts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="px-4 text-lg font-bold md:px-0">En el feed</h2>
          <div className="flex flex-col md:gap-4">
            {/* Ya estás en el producto: se quita la tarjeta que enlazaba a esta misma página y
                queda lo que aporta (la conversación, los me gusta y los comentarios). El índice
                empieza en 1 porque estas publicaciones no son lo primero de la página: la foto
                que se precarga es la de la galería, no la de una publicación más abajo. */}
            {posts.map((post, index) => (
              <PostCard key={post.id} post={{ ...post, product: null }} index={index + 1} />
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 || sponsored.length > 0 ? (
        <section className="flex flex-col gap-3 px-4 md:px-0">
          <h2 className="text-lg font-bold">También te puede gustar</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {sponsored.map((item) => (
              <SponsoredCard key={item.id} product={item} />
            ))}
            {related
              .filter((item) => !sponsored.some((s) => s.id === item.id))
              .map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
