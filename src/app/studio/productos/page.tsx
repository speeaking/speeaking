import {
  CheckCircle2,
  EyeOff,
  Package,
  Pencil,
  Plus,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ProductStatus } from "@/generated/prisma/enums";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductShareButton } from "@/modules/catalog/components/product-share-button";
import { ProductStatusToggle } from "@/modules/catalog/components/product-status-toggle";
import { STATUS_LABELS } from "@/modules/catalog/dto";
import { listSellerProducts } from "@/modules/catalog/queries";
import { toggleTargetFor } from "@/modules/catalog/status";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { isFeatureOn } from "@/modules/ai/features-store";
import { countMatchingIntents, matchingLabel } from "@/modules/stylist/matching";
import { countTryOnsByProduct } from "@/modules/tryon/service";
import { SELLER_AUTHENTICITY_LABELS, SELLER_NOT_DECLARED_LABEL } from "@/modules/trust/labels";

export const metadata: Metadata = { title: "Productos" };

const STATUS_BADGES: Record<ProductStatus, "secondary" | "outline" | "destructive"> = {
  ACTIVE: "secondary",
  PAUSED: "outline",
  SOLD_OUT: "destructive",
  DRAFT: "outline",
  ARCHIVED: "outline",
};

export default async function StudioProductsPage({ searchParams }: PageProps<"/studio/productos">) {
  const viewer = await requireOnboardedViewer("/studio/productos");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;
  const [products, { guardado }, matchingOn, tryOns] = await Promise.all([
    listSellerProducts(viewer.sellerProfileId),
    searchParams,
    isFeatureOn("buyerMatching"),
    countTryOnsByProduct(viewer.sellerProfileId),
  ]);
  // «N personas buscan algo así» (ADR-043): solo un número agregado, nunca quiénes.
  const matches = matchingOn
    ? await countMatchingIntents(products.filter((product) => product.status === "ACTIVE"))
    : new Map<string, number>();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Productos"
        className="px-0 pt-0"
        actions={
          <Link href="/studio/productos/nuevo" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            Nuevo
          </Link>
        }
      />
      {guardado ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2.5 text-sm text-secondary-foreground"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          Guardamos tus cambios.
        </p>
      ) : null}
      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aún no tienes productos"
          description="Sube una foto, pon tu precio y te ayudamos a armar la publicación."
          action={
            <Link href="/studio/sube-y-vende" className={buttonVariants()}>
              <Sparkles data-icon="inline-start" />
              Sube y vende
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {products.map((product) => {
            const toggle = toggleTargetFor(product.status);
            // Riesgo alto sin declararse original: se pide corregir la marca, no un comprobante.
            const fixBrand =
              product.authenticityStatus === "NEEDS_PROOF" && !product.declaredOriginal;
            const authenticityLabel = fixBrand
              ? SELLER_NOT_DECLARED_LABEL
              : product.authenticityStatus
                ? SELLER_AUTHENTICITY_LABELS[product.authenticityStatus]
                : null;
            return (
              <li
                key={product.id}
                className="flex flex-col gap-3 rounded-3xl border bg-card p-4 lg:flex-row lg:items-center"
              >
                <Link
                  href={`/producto/${product.slug}` as Route}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
                    {product.image ? (
                      <Image
                        src={product.image.url}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-semibold">{product.title}</span>
                    <span className="text-sm">
                      {formatMoney(product.priceCents)} ·{" "}
                      <span
                        className={cn(
                          product.economics.isLoss ? "text-destructive" : "text-success",
                          "font-semibold",
                        )}
                      >
                        {product.economics.isLoss ? "pierdes" : "ganas"}{" "}
                        {formatMoney(Math.abs(product.economics.grossMarginCents))} por pieza
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Badge variant={STATUS_BADGES[product.status]}>
                        {STATUS_LABELS[product.status]}
                      </Badge>
                      {product.hidden ? (
                        <Badge variant="outline">
                          <EyeOff data-icon="inline-start" />
                          Oculto por moderación
                        </Badge>
                      ) : null}
                      {matches.get(product.id) ? (
                        <span className="font-semibold text-success">
                          {matchingLabel(matches.get(product.id)!)}
                        </span>
                      ) : null}
                      {tryOns.get(product.id) ? (
                        <span className="font-semibold text-success">
                          {tryOns.get(product.id) === 1
                            ? "1 persona se lo probó"
                            : `${tryOns.get(product.id)} personas se lo probaron`}
                        </span>
                      ) : null}
                      {authenticityLabel ? (
                        <Badge variant="outline">
                          <ShieldQuestion data-icon="inline-start" />
                          {authenticityLabel}
                        </Badge>
                      ) : null}
                      {product.stock} en inventario · {product.saveCount} guardados
                    </span>
                  </span>
                </Link>
                {/* Acciones al alcance del pulgar: 44 px de alto en todas. */}
                <div className="flex flex-wrap gap-2 lg:shrink-0 [&_button]:h-11 [&_button]:px-4">
                  <Link
                    href={`/studio/productos/${product.id}/editar` as Route}
                    className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
                  >
                    <Pencil data-icon="inline-start" />
                    Editar<span className="sr-only"> {product.title}</span>
                  </Link>
                  {product.authenticityStatus === "NEEDS_PROOF" ? (
                    <Link
                      href={`/studio/productos/${product.id}/autenticidad` as Route}
                      className={cn(buttonVariants({ variant: "secondary" }), "h-11 px-4")}
                    >
                      <ShieldQuestion data-icon="inline-start" />
                      {fixBrand ? "Ver revisión" : "Subir comprobante"}
                      <span className="sr-only"> de {product.title}</span>
                    </Link>
                  ) : null}
                  {toggle ? (
                    <ProductStatusToggle
                      productId={product.id}
                      title={product.title}
                      target={toggle}
                    />
                  ) : null}
                  <ProductShareButton
                    productId={product.id}
                    slug={product.slug}
                    title={product.title}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
