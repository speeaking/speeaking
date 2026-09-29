import { Camera } from "lucide-react";
import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { formatMoney } from "@/lib/format";
import { isFeatureOn } from "@/modules/ai/features-store";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { getSellableProductBySlug } from "@/modules/stylist/queries";
import { getLook } from "@/modules/stylist/service";
import { classifySlot, SLOT_LABELS } from "@/modules/stylist/slots";
import { type StudioProduct, TryOnStudio } from "@/modules/tryon/components/try-on-studio";
import { MAX_TRY_ON_GARMENTS } from "@/modules/tryon/limits";
import { listTryOnPhotos, listTryOnResults, tryOnAllowance } from "@/modules/tryon/service";
import { db } from "@/server/db";
import { imageAvailability } from "@/server/providers/image";

export const metadata: Metadata = { title: "Pruébatelo", robots: { index: false } };

export default async function TryOnPage({ searchParams }: PageProps<"/probar">) {
  const viewer = await requireOnboardedViewer("/probar");
  const { producto, look } = await searchParams;
  const on = await isFeatureOn("virtualTryOn");
  const availability = imageAvailability();

  if (!on || availability === "unavailable") {
    return (
      <>
        <PageHeader title="Pruébatelo" />
        <div className="px-4 md:px-0">
          <EmptyState
            icon={Camera}
            title="Pruébatelo no está disponible por ahora"
            description="Mientras tanto, arma tu look con el estilista y compra cada pieza a quien la vende."
          />
        </div>
      </>
    );
  }

  // Prendas que llegan por la URL: de un look guardado o por slug de producto (hasta 4).
  const slugs = (Array.isArray(producto) ? producto : producto ? [producto] : []).slice(
    0,
    MAX_TRY_ON_GARMENTS,
  );
  let products: StudioProduct[] = [];
  let sponsored = false;
  if (typeof look === "string") {
    const saved = await getLook(look, viewer.userId);
    products =
      saved?.items.slice(0, MAX_TRY_ON_GARMENTS).map((item) => ({
        id: item.product.id,
        slug: item.product.slug,
        title: item.product.title,
        priceCents: item.product.priceCents,
        currency: item.product.currency,
        slotLabel: item.slotLabel,
        image: item.product.image,
      })) ?? [];
  } else if (slugs.length > 0) {
    const rows = await Promise.all(slugs.map((slug) => getSellableProductBySlug(slug)));
    for (const row of rows) {
      if (!row) continue;
      const slot = classifySlot({
        categorySlug: row.categorySlug,
        parentSlug: row.parentSlug,
        title: row.title,
        tags: row.tags,
      });
      if (!slot) continue;
      products.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        priceCents: row.priceCents,
        currency: row.currency,
        slotLabel: SLOT_LABELS[slot],
        image: row.image,
      });
    }
  }
  if (products[0]) {
    const seller = await db.product.findUnique({
      where: { id: products[0].id },
      select: { seller: { select: { sponsorsTryOn: true, userId: true } } },
    });
    sponsored = Boolean(seller?.seller.sponsorsTryOn) && seller?.seller.userId !== viewer.userId;
  }

  const [photos, allowance, recent] = await Promise.all([
    listTryOnPhotos(viewer.userId),
    tryOnAllowance(viewer.userId),
    listTryOnResults(viewer.userId),
  ]);

  return (
    <>
      <PageHeader
        title="Pruébatelo"
        description="Sube tu foto y mira cómo podría verse una prenda o un look completo en ti. Es una simulación con IA, no una garantía."
      />
      <div className="flex flex-col gap-6 px-4 md:px-0">
        <TryOnStudio
          photos={photos.map((photo) => ({
            id: photo.id,
            url: photo.url,
            createdAt: photo.createdAt,
          }))}
          products={products}
          allowance={{
            freeLeft: allowance.freeLeft,
            freeLimit: allowance.freeLimit,
            priceCents: allowance.priceCents,
            balanceCents: allowance.balanceCents,
            level: allowance.pricing.level,
            levels: allowance.pricing.levels,
            nextLevelAt: allowance.pricing.nextLevelAt,
            nextPriceCents: allowance.pricing.nextPriceCents,
          }}
          simulated={availability !== "real"}
          sponsored={sponsored}
        />

        {recent.length > 0 ? (
          <section aria-labelledby="mis-pruebas" className="flex flex-col gap-3">
            <h2 id="mis-pruebas" className="font-heading text-lg font-bold">
              Tus simulaciones recientes
            </h2>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {recent.map((result) => (
                <li key={result.id}>
                  <Link
                    href={`/probar/${result.id}` as Route}
                    className="group flex flex-col gap-1"
                    aria-label={`Simulación con ${result.products.map((p) => p.title).join(", ")}`}
                  >
                    <span className="relative aspect-4/5 overflow-hidden rounded-2xl bg-muted">
                      {result.image ? (
                        <Image
                          src={result.image.url}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 33vw, 120px"
                          style={{ objectFit: "cover" }}
                        />
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {result.products.length === 1
                        ? result.products[0]!.title
                        : `${result.products.length} prendas · ${formatMoney(result.products.reduce((sum, p) => sum + p.priceCents, 0))}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
