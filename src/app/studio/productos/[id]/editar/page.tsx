import { ArrowLeft, Info } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import type { ProductStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { ProductForm } from "@/modules/catalog/components/product-form";
import { getSellerProductForEdit, listCategories } from "@/modules/catalog/queries";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Editar producto" };

const STATUS_NOTICES: Partial<Record<ProductStatus, string>> = {
  PAUSED:
    "Este producto está pausado: nadie puede comprarlo hasta que lo reactives desde Productos.",
  SOLD_OUT: "Está agotado: si agregas piezas, vuelve a estar a la venta al guardar.",
};

export default async function EditProductPage({
  params,
}: PageProps<"/studio/productos/[id]/editar">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const viewer = await requireOnboardedViewer(`/studio/productos/${id}/editar`);
  // Solo su dueño lo ve (lleva el costo privado); para cualquier otra persona no existe.
  if (!viewer.sellerProfileId) notFound();
  const [product, categories] = await Promise.all([
    getSellerProductForEdit(viewer.userId, id),
    listCategories(),
  ]);
  if (!product) notFound();
  const notice = STATUS_NOTICES[product.status];

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/studio/productos"
        className="-my-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Productos
      </Link>
      <PageHeader
        title="Editar producto"
        description={product.title}
        className="px-0 pt-0"
        actions={
          <Link
            href={`/producto/${product.slug}` as Route}
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
          >
            Ver publicación
          </Link>
        }
      />
      {notice ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl bg-muted px-3 py-2.5 text-sm text-muted-foreground"
        >
          <Info className="mt-0.5 size-4 shrink-0" />
          {notice}
        </p>
      ) : null}
      <ProductForm
        mode="edit"
        productId={product.id}
        categories={categories}
        defaults={product.defaults}
      />
    </div>
  );
}
