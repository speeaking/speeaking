"use client";

import { Store } from "lucide-react";
import { useActionState } from "react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { activateSellerAction, type SellerFormState } from "../seller-actions";

const PAYMENT_OPTIONS = [
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CASH_ON_DELIVERY", label: "Pago contra entrega" },
  { value: "OXXO", label: "OXXO" },
] as const;

/** Activa el perfil de vendedor en un paso (P6). */
export function SellerActivation({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<SellerFormState, FormData>(
    activateSellerAction,
    {},
  );

  return (
    <section className="mx-auto flex max-w-lg flex-col gap-5 rounded-3xl border bg-card p-5">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <Store className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold">Activa tu tienda</h1>
        <p className="text-sm text-muted-foreground">
          Un solo paso y listo: con esto la IA ya puede ayudarte a vender.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          label="Nombre de tu tienda"
          name="displayName"
          defaultValue={defaultName}
          errors={state.fieldErrors?.displayName}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Ciudad"
            name="city"
            autoComplete="address-level2"
            errors={state.fieldErrors?.city}
          />
          <TextField
            label="Estado"
            name="state"
            autoComplete="address-level1"
            errors={state.fieldErrors?.state}
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">¿Cómo aceptas pagos?</legend>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm has-checked:border-foreground"
              >
                <input
                  type="checkbox"
                  name="paymentMethods"
                  value={option.value}
                  defaultChecked={option.value !== "OXXO"}
                  className="size-4 accent-primary"
                />
                {option.label}
              </label>
            ))}
          </div>
          {state.fieldErrors?.paymentMethods ? (
            <p role="alert" className="text-sm text-destructive">
              {state.fieldErrors.paymentMethods[0]}
            </p>
          ) : null}
        </fieldset>
        <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
          {pending ? "Activando…" : "Activar mi tienda"}
        </Button>
      </form>
    </section>
  );
}
