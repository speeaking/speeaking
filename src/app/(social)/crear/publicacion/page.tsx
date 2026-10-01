import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { findTaggableProduct } from "@/modules/creators/service";
import { listCommunities } from "@/modules/identity/service";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { videoUploadsEnabled } from "@/modules/media/video-upload";
import { CreatePostForm } from "@/modules/social/components/create-post-form";
import { VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Nueva publicación" };

export default async function NewPostPage({ searchParams }: PageProps<"/crear/publicacion">) {
  // `?producto=<slug>`: llegar desde una ficha o desde Creadores con el producto ya elegido (ADR-063).
  const { producto } = await searchParams;
  const slug =
    typeof producto === "string" && /^[a-z0-9-]{1,120}$/.test(producto) ? producto : null;
  const viewer = await requireOnboardedViewer(
    slug ? `/crear/publicacion?producto=${slug}` : "/crear/publicacion",
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
    slug ? findTaggableProduct(slug, viewer.userId) : null,
  ]);
  // Primero las comunidades de la persona.
  const mine = new Set(memberships.map((membership) => membership.communityId));
  const sorted = [...communities].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)));

  return (
    <>
      <PageHeader title="Nueva publicación" />
      <div className="px-4 md:px-0">
        <CreatePostForm
          communities={sorted}
          products={products}
          defaultCommunity={sorted.find((community) => mine.has(community.id))?.slug}
          videoEnabled={videoUploadsEnabled()}
          taggedProduct={taggedProduct}
        />
      </div>
    </>
  );
}
