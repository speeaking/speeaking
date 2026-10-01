import { ProductCard } from "@/modules/catalog/components/product-card";
import type { ProductCardDTO } from "@/modules/catalog/queries";

/**
 * Pestaña «Tienda» (ADR-055): lo que vende la persona, con la misma tarjeta de Comprar (precio,
 * ciudad y «Ver cómo me veo» en las prendas). El perfil es su tienda: no hay otra página.
 */
export function ProfileShop({ products, name }: { products: ProductCardDTO[]; name: string }) {
  return (
    <ul
      aria-label={`Lo que vende ${name}`}
      className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 md:grid-cols-3 md:px-0"
    >
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
