import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { TRY_ON_DISCLAIMER } from "@/modules/tryon/consent";
import { describeFunding } from "@/modules/tryon/funding";
import { getTryOnResult } from "@/modules/tryon/service";
import { listMySharedLooks } from "@/modules/tryon/shared-look";
import { ShareLookButton } from "@/modules/tryon/components/share-look-button";

export const metadata: Metadata = { title: "Tu simulación", robots: { index: false } };

export default async function TryOnResultPage({ params }: PageProps<"/probar/[id]">) {
  const viewer = await requireOnboardedViewer("/probar");
  const { id } = await params;
  const result = await getTryOnResult(viewer.userId, id);
  if (!result) notFound();
  const shares = await listMySharedLooks(viewer.userId, id);
  const total = result.products.reduce((sum, product) => sum + product.priceCents, 0);
  const again =
    `/probar?${result.products.map((product) => `producto=${product.slug}`).join("&")}` as Route;
  const expires = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
    new Date(result.expiresAt),
  );

  return (
    <>
      <PageHeader
        title="Tu simulación"
        description={result.simulated ? "Ejemplo generado con la IA simulada." : "Generada con IA."}
      />
      <div className="flex flex-col gap-6 px-4 md:px-0">
        <figure className="flex flex-col gap-2">
          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-muted">
            {result.image ? (
              <Image
                src={result.image.url}
                alt="Simulación de cómo podría verse la prenda en ti"
                width={result.image.width}
                height={result.image.height}
                sizes="(max-width: 640px) 100vw, 448px"
                priority
                className="h-auto w-full"
              />
            ) : (
              <p className="p-6 text-sm text-muted-foreground">
                {result.status === "FAILED"
                  ? "Esta simulación no se pudo generar; no se cobró."
                  : "Se está generando…"}
              </p>
            )}
          </div>
          <figcaption className="text-center text-xs text-muted-foreground">
            {TRY_ON_DISCLAIMER} · {describeFunding(result.funding)}
            {result.chargedCents > 0 ? ` (${formatMoney(result.chargedCents)})` : ""} · Privada
            hasta que decidas compartirla; se borra el {expires}.
          </figcaption>
        </figure>

        <section
          aria-labelledby="piezas"
          className="flex flex-col gap-3 rounded-3xl border bg-card p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="piezas" className="font-heading text-lg font-bold">
              Lo que traes puesto
            </h2>
            <p className="font-heading text-lg font-extrabold tabular-nums">{formatMoney(total)}</p>
          </div>
          <ul className="flex flex-col divide-y">
            {result.products.map((product) => (
              <li
                key={product.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate font-semibold">{product.title}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums">
                    {formatMoney(product.priceCents, product.currency)}
                  </span>
                  <Link
                    href={`/producto/${product.slug}` as Route}
                    className="font-semibold text-primary-text underline-offset-2 hover:underline"
                  >
                    Ver y comprar
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Cada pieza se compra a quien la vende; el precio es el vigente de su ficha.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <ShareLookButton result={result} shares={shares} />
          <Link href={again} className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
            Probar otra combinación
          </Link>
          <Link
            href={"/estilista" as Route}
            className="inline-flex h-10 items-center text-sm font-semibold text-primary-text underline-offset-2 hover:underline"
          >
            Pedir otro look al estilista
          </Link>
        </div>
      </div>
    </>
  );
}
