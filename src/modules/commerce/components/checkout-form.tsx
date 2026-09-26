"use client";

import { Lock } from "lucide-react";
import { useActionState, useState } from "react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import type { DeliveryMethod, PaymentMethod } from "@/generated/prisma/enums";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { placeOrderAction, type PlaceOrderState } from "../actions";
import { DELIVERY_LABELS } from "../labels";

export type CheckoutGroup = {
  sellerId: string;
  sellerName: string;
  lines: { productId: string; title: string; quantity: number; totalCents: number }[];
  subtotalCents: number;
  methods: DeliveryMethod[];
  nationalShippingCents: number;
  localZones: string[];
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  CASH_ON_DELIVERY: "Pago contra entrega",
  OXXO: "OXXO",
};

const radioCard =
  "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm has-checked:border-foreground has-checked:bg-secondary has-focus-visible:ring-3 has-focus-visible:ring-ring";

/**
 * Radio propio: el nativo se ve como un disco gris relleno en modo oscuro. El borde sin marcar
 * usa `muted-foreground` (contraste ≥ 3:1; `border-input` casi no se ve) y en alto contraste de
 * Windows vuelve el nativo, porque ahí se pierden los fondos y no se vería el punto.
 */
const radioInput =
  "size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-muted-foreground bg-clip-content p-[3px] transition-colors outline-none checked:border-primary checked:bg-primary focus-visible:ring-3 focus-visible:ring-ring forced-colors:appearance-auto";

export function CheckoutForm({
  groups,
  paymentMethods,
  addresses,
  cartKey,
  defaultRecipient,
}: {
  groups: CheckoutGroup[];
  paymentMethods: PaymentMethod[];
  addresses: { id: string; label: string; isDefault: boolean }[];
  /** Huella del carrito revisado: si cambia antes de confirmar, el servidor no cobra. */
  cartKey: string;
  defaultRecipient?: string;
}) {
  const [state, formAction, pending] = useActionState<PlaceOrderState, FormData>(
    placeOrderAction,
    {},
  );
  // Radios no controlados: si hay un error, React reinicia el formulario y cada radio vuelve a su
  // `defaultChecked`, que refleja lo que la persona eligió (no a la primera opción).
  const [delivery, setDelivery] = useState<Record<string, DeliveryMethod>>({});
  const deliveryFor = (group: CheckoutGroup) => delivery[group.sellerId] ?? group.methods[0];
  const [addressChoice, setAddressChoice] = useState(
    addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? "nueva",
  );
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const paymentChoice = values.paymentMethod ?? paymentMethods[0];

  const shippingCents = groups.reduce(
    (sum, group) =>
      sum + (deliveryFor(group) === "NATIONAL_SHIPPING" ? group.nationalShippingCents : 0),
    0,
  );
  const subtotalCents = groups.reduce((sum, group) => sum + group.subtotalCents, 0);
  const needsAddress = groups.some((group) => deliveryFor(group) !== "PICKUP");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="cartKey" value={cartKey} />
      {groups.map((group) => (
        <fieldset
          key={group.sellerId}
          className="flex flex-col gap-3 rounded-3xl border bg-card p-4"
        >
          <legend className="sr-only">Entrega de {group.sellerName}</legend>
          <p className="text-sm font-semibold text-muted-foreground">Vende {group.sellerName}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {group.lines.map((line) => (
              <li key={line.productId} className="flex justify-between gap-3">
                <span className="line-clamp-1">
                  {line.quantity} × {line.title}
                </span>
                <span className="shrink-0 font-medium">{formatMoney(line.totalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            {group.methods.map((method) => (
              <label key={method} className={radioCard}>
                <input
                  type="radio"
                  name={`delivery:${group.sellerId}`}
                  value={method}
                  defaultChecked={deliveryFor(group) === method}
                  onChange={() =>
                    setDelivery((current) => ({ ...current, [group.sellerId]: method }))
                  }
                  className={radioInput}
                />
                <span className="flex flex-1 flex-col">
                  <span className="font-medium">{DELIVERY_LABELS[method]}</span>
                  {method === "LOCAL_DELIVERY" ? (
                    // Las zonas son texto libre del vendedor: no se validan contra la dirección
                    // (SEC-23), así que se avisa que fuera de ellas el vendedor puede cancelar.
                    <span className="text-xs text-muted-foreground">
                      Zonas: {group.localZones.join(", ")}. Fuera de ellas, el vendedor puede
                      cancelar tu pedido.
                    </span>
                  ) : method === "PICKUP" ? (
                    <span className="text-xs text-muted-foreground">
                      El punto se acuerda con el vendedor
                    </span>
                  ) : null}
                </span>
                <span className="text-sm font-semibold">
                  {method === "NATIONAL_SHIPPING"
                    ? group.nationalShippingCents === 0
                      ? "Gratis"
                      : formatMoney(group.nationalShippingCents)
                    : "Sin costo"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset
        className={cn(
          "flex flex-col gap-3 rounded-3xl border bg-card p-4",
          !needsAddress && "hidden",
        )}
      >
        <legend className="sr-only">Dirección de entrega</legend>
        <p className="font-heading text-lg font-bold">Dirección de entrega</p>
        {addresses.length === 0 ? (
          <input type="hidden" name="addressId" value="nueva" />
        ) : (
          <>
            {addresses.map((address) => (
              <label key={address.id} className={radioCard}>
                <input
                  type="radio"
                  name="addressId"
                  value={address.id}
                  defaultChecked={addressChoice === address.id}
                  onChange={() => setAddressChoice(address.id)}
                  className={radioInput}
                />
                {address.label}
              </label>
            ))}
            <label className={radioCard}>
              <input
                type="radio"
                name="addressId"
                value="nueva"
                defaultChecked={addressChoice === "nueva"}
                onChange={() => setAddressChoice("nueva")}
                className={radioInput}
              />
              Nueva dirección
            </label>
          </>
        )}
        <div className={cn("grid grid-cols-2 gap-3", addressChoice !== "nueva" && "hidden")}>
          <div className="col-span-2">
            <TextField
              label="Quién recibe"
              name="recipientName"
              autoComplete="name"
              defaultValue={values.recipientName ?? defaultRecipient}
              errors={errors.recipientName}
            />
          </div>
          <div className="col-span-2">
            <TextField
              label="Teléfono"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              defaultValue={values.phone}
              errors={errors.phone}
            />
          </div>
          <div className="col-span-2">
            <TextField
              label="Calle"
              name="street"
              autoComplete="address-line1"
              defaultValue={values.street}
              errors={errors.street}
            />
          </div>
          <TextField
            label="Número exterior"
            name="exteriorNumber"
            defaultValue={values.exteriorNumber}
            errors={errors.exteriorNumber}
          />
          <TextField
            label="Interior (opcional)"
            name="interiorNumber"
            defaultValue={values.interiorNumber}
          />
          <div className="col-span-2">
            <TextField
              label="Colonia"
              name="neighborhood"
              autoComplete="address-level3"
              defaultValue={values.neighborhood}
              errors={errors.neighborhood}
            />
          </div>
          <TextField
            label="Municipio o alcaldía"
            name="city"
            autoComplete="address-level2"
            defaultValue={values.city}
            errors={errors.city}
          />
          <TextField
            label="Estado"
            name="state"
            autoComplete="address-level1"
            defaultValue={values.state}
            errors={errors.state}
          />
          <TextField
            label="Código postal"
            name="postalCode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            defaultValue={values.postalCode}
            errors={errors.postalCode}
          />
          <TextField
            label="Referencias (opcional)"
            name="references"
            defaultValue={values.references}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
        <legend className="sr-only">Método de pago</legend>
        <p className="font-heading text-lg font-bold">¿Cómo quieres pagar?</p>
        {paymentMethods.map((method) => (
          <label key={method} className={radioCard}>
            <input
              type="radio"
              name="paymentMethod"
              value={method}
              defaultChecked={paymentChoice === method}
              className={radioInput}
            />
            {PAYMENT_LABELS[method]}{" "}
            <span className="text-xs text-muted-foreground">(simulado)</span>
          </label>
        ))}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          Nunca guardamos datos de tarjeta: el pago lo procesa el proveedor.
        </p>
      </fieldset>

      <div className="flex flex-col gap-1.5 rounded-3xl bg-secondary p-4 text-sm">
        <div className="flex justify-between">
          <span>Productos</span>
          <span>{formatMoney(subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span>Envío</span>
          <span>{shippingCents === 0 ? "Sin costo" : formatMoney(shippingCents)}</span>
        </div>
        <div className="mt-1 flex justify-between font-heading text-xl font-extrabold">
          <span>Total</span>
          <span>{formatMoney(subtotalCents + shippingCents)}</span>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? "Reservando tus productos…" : "Continuar al pago"}
      </Button>
    </form>
  );
}
