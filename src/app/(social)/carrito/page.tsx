import { CircleAlert, ShoppingBag } from "lucide-react";
import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import {
  groupBySeller,
  listCartRemovingHidden,
  MAX_QUANTITY_PER_ITEM,
} from "@/modules/commerce/cart";
import { availableDeliveryMethods, orderShippingCents } from "@/modules/commerce/checkout-math";
import { CartLineControls } from "@/modules/commerce/components/cart-line-controls";
import { expireStaleCheckouts } from "@/modules/commerce/checkout";
import { requireViewer } from "@/modules/identity/session";
import { RemoveContentButton } from "@/modules/identity/components/remove-content-button";
import { removedHiddenNotice } from "./notice";

export const metadata: Metadata = { title: "Carrito" };

/**
 * Abrir /carrito borra las líneas de productos que el equipo ocultó (P14) y avisa una sola vez
 * (`listCartRemovingHidden`). Un prefetch que renderizara esta página gastaría el aviso en una
 * página que la persona no vio, y aquí no se puede distinguir: Next oculta `next-router-prefetch` a
 * `headers()`. Hoy no pasa porque `loading.tsx` corta el prefetch automático de `<Link>` antes de la
 * página; no uses `prefetch={true}` ni `router.prefetch` hacia /carrito.
 */
export default async function CartPage() {
  const viewer = await requireViewer("/carrito");
  await expireStaleCheckouts(new Date(), viewer.userId);
  const { lines, removedHidden } = await listCartRemovingHidden(viewer.userId);
  // Se avisa sin decir por qué (no se revela la moderación).
  const removedNotice = removedHiddenNotice(removedHidden);
  // Envío a domicilio por vendedor con la misma regla del checkout (P2); si el vendedor no envía,
  // su entrega (local o en persona) no tiene costo.
  const groups = groupBySeller(lines).map((group) => {
    const products = group.lines.map((line) => line.product);
    const shipsHome = availableDeliveryMethods(products).includes("NATIONAL_SHIPPING");
    return {
      ...group,
      shipsHome,
      shippingCents: shipsHome ? orderShippingCents("NATIONAL_SHIPPING", products) : 0,
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0);
  const shipping = groups.reduce((sum, group) => sum + group.shippingCents, 0);
  const anyShipsHome = groups.some((group) => group.shipsHome);
  const allAvailable = lines.every((line) => line.product.available);

  return (
    <>
      <PageHeader
        title="Carrito"
        description="Un pedido por vendedor; pagas todo junto."
        actions={
          lines.length ? <RemoveContentButton kind="cart" id="all" label="Vaciar" /> : undefined
        }
      />
      {removedNotice ? (
        <p
          role="status"
          className="mx-4 mb-4 flex items-start gap-2 rounded-2xl border bg-secondary p-3 text-sm md:mx-0"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{removedNotice}</span>
        </p>
      ) : null}
      {lines.length === 0 ? (
        <div className="px-4 md:px-0">
          <EmptyState
            icon={ShoppingBag}
            title="Tu carrito está vacío"
            description="Descubre productos de tus comunidades."
            action={
              <Link href="/comprar" className={buttonVariants()}>
                Ir a comprar
              </Link>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 md:px-0">
          {groups.map((group) => (
            <section
              key={group.seller.id}
              className="flex flex-col gap-3 rounded-3xl border bg-card p-4"
            >
              <h2 className="text-sm font-semibold text-muted-foreground">
                Vende {group.seller.displayName}
              </h2>
              <ul className="flex flex-col gap-3">
                {group.lines.map((line) => (
                  <li key={line.itemId} className="flex gap-3">
                    {/* La foto repite el enlace del título: fuera del tabulador y del lector. */}
                    <Link
                      href={`/producto/${line.product.slug}` as Route}
                      tabIndex={-1}
                      aria-hidden
                      className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-muted"
                    >
                      {line.product.imageUrl ? (
                        <Image
                          src={line.product.imageUrl}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : null}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Link
                        href={`/producto/${line.product.slug}` as Route}
                        className="line-clamp-2 text-sm font-medium"
                      >
                        {line.product.title}
                      </Link>
                      <span className="font-heading font-bold">
                        {formatMoney(line.product.priceCents * line.quantity)}
                      </span>
                      {!line.product.available ? (
                        <span className="text-xs font-semibold text-destructive">
                          {line.product.forSale
                            ? "Sin piezas suficientes"
                            : "Ya no está a la venta"}
                        </span>
                      ) : null}
                      <CartLineControls
                        itemId={line.itemId}
                        quantity={line.quantity}
                        max={Math.min(line.product.stock, MAX_QUANTITY_PER_ITEM)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              {group.shipsHome ? (
                <p className="flex justify-between border-t pt-3 text-sm text-muted-foreground">
                  <span>Envío a domicilio</span>
                  <span>
                    {group.shippingCents === 0 ? "Gratis" : formatMoney(group.shippingCents)}
                  </span>
                </p>
              ) : null}
            </section>
          ))}
          <div className="flex flex-col gap-1.5 rounded-3xl bg-secondary p-4 text-sm">
            <p className="flex justify-between">
              <span>Productos</span>
              <span>{formatMoney(subtotal)}</span>
            </p>
            {anyShipsHome ? (
              <p className="flex justify-between">
                <span>Envío a domicilio</span>
                <span>{shipping === 0 ? "Gratis" : formatMoney(shipping)}</span>
              </p>
            ) : null}
            <p className="mt-1 flex justify-between gap-3 font-heading text-xl font-extrabold">
              <span>{anyShipsHome ? "Total con envío a domicilio" : "Total"}</span>
              <span>{formatMoney(subtotal + shipping)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              En el siguiente paso eliges cómo recibirlo y cómo pagar.
            </p>
          </div>
          {allAvailable ? (
            <Link
              href="/checkout"
              className={buttonVariants({ size: "lg", className: "h-12 text-base" })}
            >
              Revisar pedido
            </Link>
          ) : (
            <p className="text-sm text-destructive">
              Ajusta o quita los productos marcados para continuar.
            </p>
          )}
        </div>
      )}
    </>
  );
}
