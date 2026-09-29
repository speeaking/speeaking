import { Shirt } from "lucide-react";
import type { Metadata, Route } from "next";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/states/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { isFeatureOn } from "@/modules/ai/features-store";
import { parsePesosToCents } from "@/modules/catalog/pricing";
import { getViewer } from "@/modules/identity/session";
import { LookCard } from "@/modules/stylist/components/look-card";
import { completeLook, StylistError } from "@/modules/stylist/service";
import { imageAvailability } from "@/server/providers/image";

export const metadata: Metadata = { title: "Completa mi look" };

export default async function CompleteLookPage({
  params,
  searchParams,
}: PageProps<"/estilista/completa/[slug]">) {
  const { slug } = await params;
  const { max } = await searchParams;
  const budgetMaxCents = typeof max === "string" ? parsePesosToCents(max) : null;
  const viewer = await getViewer();
  const userId = viewer?.userId ?? null;
  if (!(await isFeatureOn("completeLook"))) notFound();
  const tryOnAvailable =
    (await isFeatureOn("virtualTryOn")) && imageAvailability() !== "unavailable";

  let result;
  try {
    result = await completeLook({ userId, productSlug: slug, budgetMaxCents });
  } catch (error) {
    if (error instanceof StylistError && error.code === "PRODUCT_NOT_FOUND") notFound();
    if (error instanceof StylistError) {
      return (
        <>
          <PageHeader title="Completa mi look" />
          <div className="px-4 md:px-0">
            <EmptyState
              icon={Shirt}
              title="Este producto no es una prenda"
              description="«Completa mi look» funciona con ropa, calzado, bolsas y accesorios."
              action={
                <Link
                  href={`/producto/${slug}` as Route}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Volver al producto
                </Link>
              }
            />
          </div>
        </>
      );
    }
    throw error;
  }
  const { anchor } = result;
  const returnTo = `/estilista/completa/${slug}${budgetMaxCents ? `?max=${budgetMaxCents / 100}` : ""}`;

  return (
    <>
      <PageHeader
        title="Completa mi look"
        description="Partimos de este producto y buscamos lo que combina, con productos reales de otros vendedores."
      />
      <div className="flex flex-col gap-6 px-4 md:px-0">
        <section className="flex items-center gap-4 rounded-3xl border bg-card p-4">
          <span className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
            {anchor.product.image ? (
              <Image
                src={anchor.product.image.url}
                alt=""
                fill
                sizes="80px"
                style={{ objectFit: "cover" }}
              />
            ) : null}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {anchor.slotLabel} · fijo en todos los looks
            </p>
            <Link
              href={`/producto/${anchor.product.slug}` as Route}
              className="font-semibold hover:underline"
            >
              {anchor.product.title}
            </Link>
            <p className="text-sm text-muted-foreground">
              {formatMoney(anchor.product.priceCents, anchor.product.currency)} ·{" "}
              {anchor.product.sellerName}
            </p>
          </div>
          <Form action={`/estilista/completa/${slug}`} className="flex shrink-0 items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Máximo (MXN)
              <Input
                name="max"
                inputMode="numeric"
                defaultValue={budgetMaxCents ? String(budgetMaxCents / 100) : ""}
                placeholder="2,000"
                className="h-10 w-28"
              />
            </label>
            <Button type="submit" variant="outline" className="h-10">
              Aplicar
            </Button>
          </Form>
        </section>

        {result.looks.length > 0 ? (
          <div className="flex flex-col gap-4">
            {result.looks.map((look, index) => (
              <LookCard
                key={look.id ?? `${index}`}
                look={look}
                isSignedIn={Boolean(userId)}
                tryOnAvailable={tryOnAvailable}
                returnTo={returnTo}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Shirt}
            title="Aún no hay con qué completarlo"
            description="Faltan prendas de otros huecos (arriba, abajo o calzado) dentro de ese presupuesto."
          />
        )}
      </div>
    </>
  );
}
