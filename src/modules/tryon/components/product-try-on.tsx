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
}) {
  const slot = slotForPublicProduct({
    categorySlug: product.categorySlug,
    title: product.title,
    tags: product.tags,
  });
  if (!slot) return null;
  if (!(await isFeatureOn("virtualTryOn")) || imageAvailability() === "unavailable") return null;
  const returnTo = `/producto/${product.slug}`;

  if (!viewerUserId) {
    return (
      <Link
        href={`/registro?next=${encodeURIComponent(returnTo)}` as Route}
        className={cn(buttonVariants({ variant: "outline" }), "h-10 font-bold")}
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
    />
  );
}
