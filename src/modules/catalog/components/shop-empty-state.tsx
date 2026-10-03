import { Compass, ShoppingBag } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Sobre el lienzo gris, en blanco: si no, en claro se leía como texto suelto.
const actionClass = cn(
  buttonVariants({ variant: "outline" }),
  "h-11 bg-card px-4 text-[15px] md:h-10",
);

/**
 * Comprar sin productos. El texto depende de lo que haya activo: sin búsqueda ni categoría no se
 * habla de «otra palabra» (nadie buscó nada); con categoría se ofrece verlas todas.
 */
export function ShopEmptyState({
  query,
  categorySlug,
  categoryName,
  allCategoriesHref,
}: {
  /** Texto buscado ya normalizado; vacío sin búsqueda. */
  query: string;
  /** Categoría del filtro, aunque no exista (`?categoria=` a mano). */
  categorySlug?: string;
  categoryName?: string;
  /** La misma búsqueda sin la categoría. */
  allCategoriesHref: Route;
}) {
  const inCategory = categoryName ? ` en ${categoryName}` : "";
  const exploreCommunities = (
    <Link href="/descubrir" className={actionClass}>
      <Compass data-icon="inline-start" />
      Explorar comunidades
    </Link>
  );
  const allCategories = (
    <Link href={allCategoriesHref} className={actionClass}>
      {query ? "Buscar en todas las categorías" : "Ver todas las categorías"}
    </Link>
  );

  if (query) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title={`Sin resultados para “${query}”${inCategory}`}
        description={
          categorySlug
            ? "Prueba en todas las categorías o con otra palabra."
            : "Prueba con otra palabra o explora las comunidades."
        }
        action={categorySlug ? allCategories : exploreCommunities}
      />
    );
  }
  if (categorySlug) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title={`Todavía no hay productos en ${categoryName ?? "esta categoría"}`}
        description="Prueba en todas las categorías."
        action={allCategories}
      />
    );
  }
  return (
    <EmptyState
      icon={ShoppingBag}
      title="Todavía no hay productos"
      description="Cuando alguien publique algo a la venta, aparecerá aquí. Mientras tanto, explora las comunidades."
      action={exploreCommunities}
    />
  );
}
