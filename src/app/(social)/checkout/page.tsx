import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getCartLines, groupBySeller } from "@/modules/commerce/cart";
import {
  availableDeliveryMethods,
  commonPaymentMethods,
  orderShippingCents,
} from "@/modules/commerce/checkout-math";
import { checkoutCartKey } from "@/modules/commerce/checkout";
import { type CheckoutGroup, CheckoutForm } from "@/modules/commerce/components/checkout-form";
import { expireStaleCheckouts } from "@/modules/commerce/checkout";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Revisa tu pedido" };

export default async function CheckoutPage() {
  const viewer = await requireOnboardedViewer("/checkout");
  await expireStaleCheckouts(new Date(), viewer.userId);
  const lines = await getCartLines(viewer.userId);
  if (lines.length === 0 || lines.some((line) => !line.product.available)) redirect("/carrito");

  const sellerGroups = groupBySeller(lines);
  const groups: CheckoutGroup[] = sellerGroups.map((group) => ({
    sellerId: group.seller.id,
    sellerName: group.seller.displayName,
    lines: group.lines.map((line) => ({
      productId: line.product.id,
      title: line.product.title,
      quantity: line.quantity,
      totalCents: line.product.priceCents * line.quantity,
    })),
    subtotalCents: group.lines.reduce(
      (sum, line) => sum + line.product.priceCents * line.quantity,
      0,
    ),
    methods: availableDeliveryMethods(group.lines.map((line) => line.product)),
    nationalShippingCents: orderShippingCents(
      "NATIONAL_SHIPPING",
      group.lines.map((line) => line.product),
    ),
    localZones: [...new Set(group.lines.flatMap((line) => line.product.localDeliveryZones))],
  }));
  const paymentMethods = commonPaymentMethods(
    sellerGroups.map((group) => group.seller.paymentMethods),
  );
  const addresses = await db.address.findMany({
    where: { userId: viewer.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      street: true,
      exteriorNumber: true,
      neighborhood: true,
      city: true,
      isDefault: true,
    },
  });
  const blocked = groups.find((group) => group.methods.length === 0);

  return (
    <>
      <PageHeader
        title="Revisa tu pedido"
        description="Elige cómo recibirlo y cómo pagar. Un pedido por vendedor."
      />
      <div className="px-4 md:px-0">
        {blocked ? (
          <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
            Los productos de {blocked.sellerName} no comparten una forma de entrega. Cómpralos por
            separado.
          </p>
        ) : paymentMethods.length === 0 ? (
          <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
            Los vendedores de tu carrito no aceptan un mismo método de pago. Haz un pedido con cada
            uno por separado.
          </p>
        ) : (
          <CheckoutForm
            groups={groups}
            paymentMethods={paymentMethods}
            cartKey={checkoutCartKey(lines)}
            defaultRecipient={viewer.profile.displayName}
            addresses={addresses.map((address) => ({
              id: address.id,
              label: `${address.street} ${address.exteriorNumber}, ${address.neighborhood}, ${address.city}`,
              isDefault: address.isDefault,
            }))}
          />
        )}
      </div>
    </>
  );
}
