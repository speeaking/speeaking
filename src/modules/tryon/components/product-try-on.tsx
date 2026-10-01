import { Camera } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isFeatureOn } from "@/modules/ai/features-store";
import { slotForPublicProduct } from "@/modules/stylist/slots";
import { imageAvailability } from "@/server/providers/image";
import { listComplementsFor, listTryOnPhotos, tryOnAvailabilityFor } from "../service";
import { TryOnDialog } from "./try-on-dialog";

/**
 * «Ver cómo me veo» en la ficha de una prenda (ADR-046). Sin sesión, el botón lleva a crear cuenta
 * y regresa aquí. Con sesión, abre el diálogo con las fotos guardadas, los complementos y quién
 * paga la prueba. Fuera de moda no pinta nada.
 */
export async function ProductTryOn({
  product,
  viewerUserId,
  isOwner,
  autoOpen = false,
  sourcePostId = null,
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
  /** Llegó desde una tarjeta con «Ver cómo me veo»: el diálogo se abre solo. */
  autoOpen?: boolean;
  /** Publicación desde la que llegó (ADR-063): la prueba y la compra se le atribuyen. */
  sourcePostId?: string | null;
}) {
  const slot = slotForPublicProduct({
    categorySlug: product.categorySlug,
    title: product.title,
    tags: product.tags,
  });
  if (!slot) return null;
  if (!(await isFeatureOn("virtualTryOn")) || imageAvailability() === "unavailable") return null;
  // Al volver de crear cuenta o de entrar, la ficha conserva de dónde venía la persona.
  const query = new URLSearchParams();
  if (autoOpen) query.set("probar", "1");
  if (sourcePostId) query.set("from", sourcePostId);
  const returnTo = `/producto/${product.slug}${query.size > 0 ? `?${query}` : ""}`;

  if (!viewerUserId) {
    return (
      <Link
        href={`/registro?next=${encodeURIComponent(returnTo)}` as Route}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "h-12 w-full border-foreground/25 text-base font-bold sm:w-auto sm:px-5",
        )}
      >
        <Camera data-icon="inline-start" />
        Ver cómo me veo
      </Link>
    );
  }

  const [photos, availability, complements] = await Promise.all([
    listTryOnPhotos(viewerUserId),
    tryOnAvailabilityFor(product.sellerId),
    listComplementsFor({ id: product.id, slot, sellerId: product.sellerId }),
  ]);
  if (!availability.available) return null;
  // Quien vende ve su propia ficha como la ve la gente, y de paso si la prueba está activa.
  const status = isOwner && availability.status === "none" ? "none" : availability.status;

  return (
    <TryOnDialog
      product={{
        id: product.id,
        slug: product.slug,
        title: product.title,
        priceCents: product.priceCents,
      }}
      photos={photos.map((photo) => ({ id: photo.id, url: photo.url }))}
      complements={complements}
      status={status}
      simulated={availability.simulated}
      returnTo={returnTo}
      sourcePostId={sourcePostId}
      defaultOpen={autoOpen}
    />
  );
}
