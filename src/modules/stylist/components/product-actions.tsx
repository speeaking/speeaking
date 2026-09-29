import type { Route } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isFeatureOn } from "@/modules/ai/features-store";
import { imageAvailability } from "@/server/providers/image";
import { slotForPublicProduct } from "../slots";

/**
 * En la ficha de una prenda (ADR-043): «Pruébatelo» (contorno) y «Completa mi look» (enlace).
 * Fuera de moda no pinta nada. Visitantes: crear cuenta y volver.
 */
export async function ProductStylistActions({
  slug,
  categorySlug,
  title,
  tags,
  isSignedIn,
}: {
  slug: string;
  categorySlug: string;
  title: string;
  tags: readonly string[];
  isSignedIn: boolean;
}) {
  const slot = slotForPublicProduct({ categorySlug, title, tags });
  if (!slot) return null;
  const [tryOnOn, completeOn] = await Promise.all([
    isFeatureOn("virtualTryOn"),
    isFeatureOn("completeLook"),
  ]);
  const tryOnAvailable = tryOnOn && imageAvailability() !== "unavailable";
  if (!tryOnAvailable && !completeOn) return null;
  const tryOnHref = isSignedIn
    ? (`/probar?producto=${encodeURIComponent(slug)}` as Route)
    : (`/registro?next=${encodeURIComponent(`/probar?producto=${slug}`)}` as Route);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {tryOnAvailable ? (
        <Link
          href={tryOnHref}
          className={cn(buttonVariants({ variant: "outline" }), "h-10 font-bold")}
        >
          Pruébatelo con tu foto
        </Link>
      ) : null}
      {completeOn ? (
        <Link
          href={`/estilista/completa/${slug}` as Route}
          className="inline-flex h-10 items-center text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
        >
          Completa mi look
        </Link>
      ) : null}
    </div>
  );
}
