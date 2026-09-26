import { Package, Plus } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdKitView, listAdKitProducts } from "@/modules/ai/ad-kit/service";
import { AdKit } from "@/modules/ai/components/ad-kit";
import { aiAvailability } from "@/modules/ai/tasks/availability";
import type { AiAvailability } from "@/modules/ai/tasks/simulation";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Contenido" };

/**
 * Qué dice el encabezado según la IA de hoy (ADR-038): solo con un modelo de verdad dice «con ayuda
 * de IA»; con la IA simulada de un piloto, textos de ejemplo; sin IA, a mano.
 */
const DESCRIPTION: Record<AiAvailability, string> = {
  real: "Kit de anuncios: mensajes para WhatsApp, Facebook e Instagram con los datos de tu producto, creados con ayuda de IA.",
  simulated:
    "Kit de anuncios: mensajes de ejemplo para WhatsApp, Facebook e Instagram con los datos de tu producto. Piloto: la IA está simulada.",
  unavailable:
    "Kit de anuncios: por ahora escribe tus mensajes para WhatsApp, Facebook e Instagram a mano, con el precio y la liga de tu producto.",
};

/** Studio → Contenido: el kit de anuncios de cada producto (textos por canal). */
export default async function StudioContentPage({ searchParams }: PageProps<"/studio/contenido">) {
  const viewer = await requireOnboardedViewer("/studio/contenido");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;
  const [{ producto }, products, availability] = await Promise.all([
    searchParams,
    listAdKitProducts(viewer.userId),
    aiAvailability("ad_copy"),
  ]);

  const header = (
    <PageHeader title="Contenido" description={DESCRIPTION[availability]} className="px-0 pt-0" />
  );

  if (products.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState
          icon={Package}
          title="Aún no tienes productos"
          description="Publica un producto y aquí te ayudamos a anunciarlo en WhatsApp, Facebook e Instagram."
          action={
            <Link href="/studio/productos/nuevo" className={buttonVariants()}>
              <Plus data-icon="inline-start" />
              Nuevo producto
            </Link>
          }
        />
      </div>
    );
  }

  const requested = typeof producto === "string" ? producto : undefined;
  if (requested !== undefined && !z.uuid().safeParse(requested).success) notFound();
  const selectedId =
    requested ?? products.find((product) => product.unavailable === null)?.id ?? products[0]!.id;
  // Autorización en el servicio: un producto ajeno (o inexistente) es un 404.
  const view = await getAdKitView(viewer.userId, selectedId);
  if (!view) notFound();

  return (
    <div className="flex flex-col gap-4">
      {header}
      <nav aria-label="Elige un producto" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex gap-2 pb-1">
          {products.map((product) => {
            const selected = product.id === view.product.id;
            return (
              <li key={product.id} className="shrink-0">
                <Link
                  href={`/studio/contenido?producto=${product.id}` as Route}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex max-w-60 flex-col rounded-2xl border px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    selected &&
                      "border-foreground bg-foreground text-background hover:bg-foreground",
                  )}
                >
                  <span className="truncate font-semibold">{product.title}</span>
                  <span
                    className={cn("text-xs", selected ? "opacity-80" : "text-muted-foreground")}
                  >
                    {product.unavailable ?? product.priceLabel}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <AdKit key={view.product.id} initial={view} availability={availability} />
    </div>
  );
}
