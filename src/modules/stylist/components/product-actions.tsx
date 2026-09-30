import type { Route } from "next";
import Link from "next/link";
import { isFeatureOn } from "@/modules/ai/features-store";
import { ProductTryOn } from "@/modules/tryon/components/product-try-on";
import { slotForPublicProduct } from "../slots";

/**
 * En la ficha de una prenda (ADR-043, ADR-046): «Ver cómo me veo» (diálogo) y «Completa mi look»
 * (enlace). Fuera de moda no pinta nada.
 */
export async function ProductStylistActions({
  product,
  viewerUserId,
  isOwner,
  autoOpen = false,
}: {
  product: {
    id: string;
    slug: string;
    title: string;
    priceCents: number;
    sellerId: string;
    categorySlug: string;
    tags: readonly string[];
  };
  viewerUserId: string | null;
  isOwner: boolean;
  autoOpen?: boolean;
}) {
  const slot = slotForPublicProduct({
    categorySlug: product.categorySlug,
    title: product.title,
    tags: product.tags,
  });
  if (!slot) return null;
  const completeOn = await isFeatureOn("completeLook");
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-secondary p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <ProductTryOn
        product={product}
        viewerUserId={viewerUserId}
        isOwner={isOwner}
        autoOpen={autoOpen}
      />
      {completeOn ? (
        <Link
          href={`/estilista/completa/${product.slug}` as Route}
          className="inline-flex h-10 items-center text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
        >
          Completa mi look
        </Link>
      ) : null}
      <span className="text-xs text-muted-foreground sm:ml-auto">
        Gratis, con tu foto. Solo tú ves el resultado.
      </span>
    </div>
  );
}
