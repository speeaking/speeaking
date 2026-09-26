import {
  CheckCircle2,
  MapPin,
  PackageCheck,
  ShieldCheck,
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
import { ProductCard } from "@/modules/catalog/components/product-card";
import { ProductShareButton } from "@/modules/catalog/components/product-share-button";
import { QuickQuestions } from "@/modules/catalog/components/quick-questions";
import { SaveProductButton } from "@/modules/catalog/components/save-product-button";
import { CONDITION_LABELS } from "@/modules/catalog/dto";
import { getPublicProduct, listRelatedProducts } from "@/modules/catalog/queries";
import {
  answerQuickQuestion,
  localDeliveryLine,
  nationalShippingLine,
  stockLabel,
} from "@/modules/catalog/quick-answers";
import { BuyBox } from "@/modules/commerce/components/buy-box";
import { getViewer } from "@/modules/identity/session";
import { FollowButton } from "@/modules/social/components/follow-button";
import { PostCard } from "@/modules/social/components/post-card";
import { hydratePosts } from "@/modules/social/post-queries";
import { db } from "@/server/db";

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

export default async function ProductPage({ params, searchParams }: PageProps<"/producto/[slug]">) {
  const { slug } = await params;
  const { from, ref, nuevo } = await searchParams;
  const result = await getPublicProduct(slug);
  if (!result) notFound();
  const { product, categoryId } = result;

  const viewer = await getViewer();
  const isOwner = viewer?.userId === product.seller.userId;
  const sourcePostId = typeof from === "string" && z.uuid().safeParse(from).success ? from : null;
  track({
    type: "PRODUCT_VIEW",
    userId: viewer?.userId ?? null,
    entityType: "PRODUCT",
    entityId: product.id,
    sourcePostId,
    surface: ref === "compartir" ? "SHARE_LINK" : sourcePostId ? "FEED" : "PRODUCT_PAGE",
  });

  const [related, postRows, saved, followsSeller] = await Promise.all([
    listRelatedProducts(categoryId, product.id),
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
      text: answerQuickQuestion("authenticity", product.facts),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-6">
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
        ) : (
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
          <FollowButton
            targetUserId={product.seller.userId}
            targetName={product.seller.displayName}
            initialFollowing={Boolean(followsSeller)}
            isSignedIn={Boolean(viewer)}
            // «Comprar ahora» es la acción principal de la página: seguir va en rosa suave.
            variant="soft"
            className="shrink-0"
          />
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

      {related.length > 0 ? (
        <section className="flex flex-col gap-3 px-4 md:px-0">
          <h2 className="text-lg font-bold">También te puede gustar</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
