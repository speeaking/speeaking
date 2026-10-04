import { findTaggableProduct } from "@/modules/creators/service";
import { listCommunities } from "@/modules/identity/service";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { isPlatformAdministrator } from "@/modules/identity/platform-account";
import { videoUploadsEnabled } from "@/modules/media/video-upload";
import { VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { CreatePostForm } from "./create-post-form";

/** `?producto=<slug>`: llegar desde una ficha o desde Creadores con el producto ya elegido (ADR-063). */
export function productSlugParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" && /^[a-z0-9-]{1,120}$/.test(value) ? value : null;
}

/**
 * Escribir una publicación: las comunidades (primero las de la persona), sus productos y, si llegó
 * con uno, el producto a etiquetar. Lo usan la página /crear/publicacion y la ventana que se abre
 * encima del feed (ADR-068, `inLayer`).
 */
export async function NewPost({
  productSlug,
  inLayer = false,
  defaultMedia = "photos",
}: {
  productSlug: string | null;
  inLayer?: boolean;
  defaultMedia?: "photos" | "video";
}) {
  const viewer = await requireOnboardedViewer(
    productSlug ? `/crear/publicacion?producto=${productSlug}` : "/crear/publicacion",
  );
  const [communities, memberships, products, taggedProduct] = await Promise.all([
    listCommunities(),
    db.communityMembership.findMany({
      where: { userId: viewer.userId },
      select: { communityId: true },
    }),
    // Un producto oculto por el equipo no se ofrece: su publicación no se vería (P14).
    viewer.sellerProfileId
      ? db.product.findMany({
          where: { sellerId: viewer.sellerProfileId, status: "ACTIVE", ...VISIBLE_PRODUCT },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true },
        })
      : [],
    // Solo lo que esta persona puede etiquetar: lo suyo o lo de una tienda que acepta colaboraciones.
    productSlug ? findTaggableProduct(productSlug, viewer.userId) : null,
  ]);
  // Primero las comunidades de la persona.
  const mine = new Set(memberships.map((membership) => membership.communityId));
  const sorted = [...communities].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)));

  return (
    <CreatePostForm
      communities={sorted}
      products={products}
      defaultCommunity={sorted.find((community) => mine.has(community.id))?.slug}
      videoEnabled={videoUploadsEnabled()}
      publicAccount={isPlatformAdministrator(viewer.email, viewer.profile.role)}
      taggedProduct={taggedProduct}
      inLayer={inLayer}
      defaultMedia={defaultMedia}
    />
  );
}
