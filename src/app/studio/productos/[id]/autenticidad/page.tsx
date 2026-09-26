import { ArrowLeft, CheckCircle2, EyeOff, Info, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { DeclareGenericButton } from "@/modules/trust/components/declare-generic-button";
import { ProofForm } from "@/modules/trust/components/proof-form";
import { getSellerAuthenticityCase } from "@/modules/trust/service";

export const metadata: Metadata = { title: "Autenticidad del producto" };

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-3xl border bg-card p-4", className)}>
      {children}
    </section>
  );
}

/**
 * Revisión de autenticidad de un producto propio (P14): por qué se pidió un comprobante, cómo
 * enviarlo (fotos privadas) o cómo dejar de declararlo original. Solo su dueño la ve.
 */
export default async function ProductAuthenticityPage({
  params,
  searchParams,
}: PageProps<"/studio/productos/[id]/autenticidad">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const viewer = await requireOnboardedViewer(`/studio/productos/${id}/autenticidad`);
  if (!viewer.sellerProfileId) notFound();
  const [found, { enviado }] = await Promise.all([
    getSellerAuthenticityCase(viewer.userId, id),
    searchParams,
  ]);
  if (!found) notFound();
  const { product, check } = found;
  const status = check?.status ?? null;
  const declaredOriginal = product.authenticity === "DECLARED_ORIGINAL";
  const editHref = `/studio/productos/${product.id}/editar` as Route;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/studio/productos"
        className="-my-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Productos
      </Link>
      <PageHeader title="Autenticidad" description={product.title} className="px-0 pt-0" />

      {enviado ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-2xl bg-success/10 px-3 py-2.5 text-sm text-success"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          Recibimos tu comprobante. El equipo lo revisa en un plazo de 24 horas hábiles.
        </p>
      ) : null}

      {product.hidden ? (
        <p className="flex items-start gap-2 rounded-2xl bg-muted px-3 py-2.5 text-sm">
          <EyeOff className="mt-0.5 size-4 shrink-0" />
          El equipo ocultó este producto: no aparece en el feed, la búsqueda ni Comprar.
        </p>
      ) : null}

      {status === "NEEDS_PROOF" && !declaredOriginal ? (
        // Riesgo alto sin declararse original: no hay comprobante que pedir (un comprobante de un
        // genérico no demuestra nada); se pide corregir cómo usa la marca.
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShieldQuestion className="size-5" />
            Revisa cómo usas la marca
          </h2>
          <p className="text-sm">
            Tu publicación usa el nombre de una marca junto con palabras que suelen describir
            imitaciones. No es una acusación: lo revisamos en toda publicación con estas señales.
            Vender imitaciones de marca no está permitido. Si no es de la marca, edita el título y
            la descripción: quita la marca o escribe «compatible con…». Si es original, edítalo y
            declara que es original; después te pediremos un comprobante.
          </p>
          {check && check.reasons.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">Qué encontramos</h3>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
                {check.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <Link
            href={editHref}
            className={cn(buttonVariants({ variant: "outline" }), "h-11 self-start px-4")}
          >
            Editar producto
          </Link>
        </Card>
      ) : status === "NEEDS_PROOF" || status === "PROOF_SUBMITTED" ? (
        <>
          <Card>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ShieldQuestion className="size-5" />
              {status === "NEEDS_PROOF" ? "Te pedimos un comprobante" : "Comprobante en revisión"}
            </h2>
            <p className="text-sm">
              Encontramos señales que a veces aparecen en imitaciones. No es una acusación: lo
              pedimos a toda publicación con estas señales para cuidar a quien compra. Tu producto
              sigue a la venta, pero mientras no revisemos un comprobante
              {declaredOriginal ? " quienes compran ven «Autenticidad sin verificar»." : "."}
            </p>
            {check && check.reasons.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-semibold">Por qué te lo pedimos</h3>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
                  {check.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="text-lg font-bold">
              {status === "NEEDS_PROOF" ? "Opción 1: sube tu comprobante" : "Tu comprobante"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Ticket o factura de compra, o fotos del empaque con el número de serie. Solo tú y el
              equipo de {siteConfig.name} las ven. Tapa lo que no haga falta (tu dirección o los
              datos de tu tarjeta).
            </p>
            <ProofForm
              productId={product.id}
              initial={status === "PROOF_SUBMITTED" ? (check?.proofs ?? []) : []}
              submitLabel={status === "PROOF_SUBMITTED" ? "Reemplazar comprobante" : undefined}
            />
          </Card>

          {declaredOriginal ? (
            <Card>
              <h2 className="text-lg font-bold">
                {status === "NEEDS_PROOF" ? "Opción 2: " : ""}¿No es de la marca original?
              </h2>
              <p className="text-sm text-muted-foreground">
                Márcalo como genérico o compatible. Se sigue vendiendo y ya no se pide comprobante.
                Si la publicación usa la marca con palabras como «réplica», también tendrás que
                corregir el título y la descripción.
              </p>
              <DeclareGenericButton productId={product.id} />
            </Card>
          ) : null}
        </>
      ) : status === "VERIFIED_BY_ADMIN" ? (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="size-5 text-success" />
            Revisamos tu comprobante
          </h2>
          <p className="text-sm">
            Quienes compran ven «Comprobante revisado por {siteConfig.name}». El comprobante vale
            para este artículo: si cambias el título, las etiquetas, la categoría o la condición, o
            si un cambio aumenta el riesgo, la leyenda se quita y lo revisamos de nuevo.
          </p>
          {check?.reviewNote ? (
            <p className="rounded-2xl bg-muted px-3 py-2.5 text-sm">
              Nota del equipo: {check.reviewNote}
            </p>
          ) : null}
        </Card>
      ) : status === "REJECTED" ? (
        <Card>
          <h2 className="text-lg font-bold">Marcado como genérico o compatible</h2>
          <p className="text-sm">
            El equipo revisó tu publicación y la dejó como «genérico o compatible»: no se muestra
            como original. Si es original, vuelve a declararlo al editarlo y te pediremos un
            comprobante.
          </p>
          {check?.reviewNote ? (
            <p className="rounded-2xl bg-muted px-3 py-2.5 text-sm">
              Nota del equipo: {check.reviewNote}
            </p>
          ) : null}
        </Card>
      ) : (
        <Card>
          <p className="flex items-start gap-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0" />
            No hay nada pendiente: tu producto se muestra con lo que declaraste.
          </p>
        </Card>
      )}
    </div>
  );
}
