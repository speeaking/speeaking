"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarginPreview } from "@/modules/catalog/components/margin-preview";
import { ImageUploader } from "@/modules/media/components/image-uploader";
import { generateProposalAction, type ProposalState } from "../actions";
import { parseSellerText } from "../sale-proposal";
import { ProposalView } from "./proposal-view";

const EXAMPLES = [
  "Tengo 50 AirPods Pro 2. Me costaron $2,400 y quiero venderlos a $3,499.",
  "Vendo 20 pasteles de tres leches, me cuesta $180 hacer cada uno y los vendo a $450.",
  "Tengo 6 tenis Nike para correr, costo $900 y precio $1,499.",
];

const pesos = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toLocaleString("es-MX");

export function SellWithAi() {
  const [state, formAction, pending] = useActionState<ProposalState, FormData>(
    generateProposalAction,
    {},
  );
  const [dismissed, setDismissed] = useState<ProposalState | null>(null);
  const [text, setText] = useState("");
  const [fields, setFields] = useState({ productName: "", quantity: "", cost: "", price: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const errors = state.fieldErrors ?? {};

  // Al llegar la propuesta, mostrarla desde su inicio (el botón quedaba al final de la página).
  useEffect(() => {
    if (state.result) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.result]);

  /** Rellena los datos detectados en el texto, sin pisar lo que la persona ya corrigió. */
  const onText = (value: string) => {
    setText(value);
    const parsed = parseSellerText(value);
    setFields((current) => ({
      productName: touched.productName ? current.productName : parsed.productName,
      quantity: touched.quantity
        ? current.quantity
        : (parsed.quantity?.toString() ?? current.quantity),
      cost: touched.cost ? current.cost : pesos(parsed.costCents) || current.cost,
      price: touched.price ? current.price : pesos(parsed.priceCents) || current.price,
    }));
  };
  const edit = (key: keyof typeof fields, value: string) => {
    setTouched((current) => ({ ...current, [key]: true }));
    setFields((current) => ({ ...current, [key]: value }));
  };

  if (state.result && state !== dismissed) {
    return <ProposalView result={state.result} onReset={() => setDismissed(state)} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="dark flex flex-col gap-3 rounded-3xl border bg-card p-5 text-foreground">
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-ai px-2.5 py-1 text-xs font-bold text-ai-foreground">
          <Sparkles className="size-3.5" />
          Vende con IA
        </span>
        <label htmlFor="que-vendes" className="font-heading text-3xl leading-tight font-extrabold">
          ¿Qué quieres vender hoy?
        </label>
        <Textarea
          id="que-vendes"
          name="text"
          rows={3}
          maxLength={1000}
          value={text}
          onChange={(event) => onText(event.target.value)}
          placeholder="Cuéntalo como se lo dirías a un amigo: qué es, cuántos tienes, cuánto te costó y a cuánto lo quieres vender."
          className="text-base"
          aria-invalid={errors.text ? true : undefined}
          // El error (si lo hay) se anuncia junto con el aviso de privacidad.
          aria-describedby={
            errors.text ? "que-vendes-privacidad que-vendes-error" : "que-vendes-privacidad"
          }
        />
        {/* SEC-29: el texto se guarda (sin contactos ni cuentas) y lo procesa el proveedor de IA. */}
        <p id="que-vendes-privacidad" className="text-xs text-ink-2">
          Habla solo del producto: no incluyas teléfonos, correos, direcciones ni datos bancarios.
        </p>
        {errors.text ? (
          <p id="que-vendes-error" className="text-sm text-destructive">
            {errors.text[0]}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onText(example)}
              className="rounded-full border border-line-strong px-3 py-1 text-left text-xs text-ink-2 hover:bg-accent"
            >
              {example.slice(0, 38)}…
            </button>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-3xl border bg-card p-4 md:p-5">
        <div>
          <h2 className="font-heading text-lg font-bold">Confirma tus datos</h2>
          <p className="text-sm text-muted-foreground">
            Los detectamos de tu texto. La IA usa exactamente estos números; nunca los inventa.
          </p>
        </div>
        <TextField
          label="Producto"
          name="productName"
          value={fields.productName}
          onChange={(event) => edit("productName", event.target.value)}
          errors={errors.productName}
        />
        <div className="grid grid-cols-3 gap-3">
          <TextField
            label="Piezas"
            name="quantity"
            inputMode="numeric"
            value={fields.quantity}
            onChange={(event) => edit("quantity", event.target.value)}
            errors={errors.quantity}
          />
          <TextField
            label="Costo c/u"
            name="cost"
            inputMode="decimal"
            value={fields.cost}
            onChange={(event) => edit("cost", event.target.value)}
            errors={errors.cost}
          />
          <TextField
            label="Precio c/u"
            name="price"
            inputMode="decimal"
            value={fields.price}
            onChange={(event) => edit("price", event.target.value)}
            errors={errors.price}
          />
        </div>
        <MarginPreview price={fields.price} cost={fields.cost} />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Foto (opcional)</p>
          <ImageUploader name="mediaId" max={1} />
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        <Sparkles data-icon="inline-start" />
        {pending ? "La IA está armando tu propuesta…" : "Crear mi propuesta"}
      </Button>
    </form>
  );
}
