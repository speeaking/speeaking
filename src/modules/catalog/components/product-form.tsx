"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, startTransition, useActionState, useState } from "react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/modules/media/components/image-uploader";
import { createProductAction, type ProductFormState, updateProductAction } from "../actions";
import { CONDITION_LABELS } from "../dto";
import type { ProductFormDefaults } from "../form-defaults";
import { MAX_PRODUCT_IMAGES, MIN_WARRANTY_DAYS } from "../schemas";
import { MarginPreview } from "./margin-preview";

export type { ProductFormDefaults };

type Category = { id: string; name: string; parentId: string | null };

const RETURN_WINDOW_OPTIONS = [7, 15, 30];

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-3xl border bg-card p-4 md:p-5">
      <legend className="sr-only">{title}</legend>
      <div className="flex flex-col gap-0.5">
        <h2 className="font-heading text-lg font-bold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p role="alert" className="text-sm text-destructive">
      {errors[0]}
    </p>
  ) : null;
}

type ProductFormProps = { categories: Category[]; defaults?: ProductFormDefaults } & (
  | { mode?: "create"; communities: { slug: string; name: string; emoji: string }[] }
  /** Editar un producto propio: sin publicación en el feed y con el costo privado prellenado. */
  | { mode: "edit"; productId: string }
);

export function ProductForm(props: ProductFormProps) {
  const { categories, defaults = {} } = props;
  const editing = props.mode === "edit";
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    editing ? updateProductAction : createProductAction,
    {},
  );
  const errors = state.fieldErrors ?? {};
  const [price, setPrice] = useState(defaults.price ?? "");
  const [cost, setCost] = useState(defaults.cost ?? "");
  const [national, setNational] = useState(defaults.nationalShippingAvailable ?? true);
  // Por omisión «Sin garantía»: una garantía ofrecida es de al menos 90 días (LFPC art. 77).
  const [warranty, setWarranty] = useState<string>(defaults.warrantyType ?? "NONE");
  const warrantyDays =
    defaults.warrantyType && defaults.warrantyType !== "NONE"
      ? (defaults.warrantyDays ?? "")
      : String(MIN_WARRANTY_DAYS);
  const [publish, setPublish] = useState(true);
  const [uploading, setUploading] = useState(false);

  const parents = categories.filter((category) => !category.parentId);
  const returnWindow = defaults.returnWindowDays ?? "7";
  // Un plazo guardado que no está en la lista se conserva como opción (si no, se perdería al guardar).
  const returnWindowOptions = [...new Set([...RETURN_WINDOW_OPTIONS, Number(returnWindow)])]
    .filter((days) => days > 0)
    .sort((a, b) => a - b);

  // Se envía desde aquí y no con la acción del formulario: React reinicia los campos no controlados
  // al terminar una acción, y un error de validación borraría lo que la persona ya había cambiado.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Una foto que aún se sube no tiene campo oculto: se guardaría sin ella y sin avisar.
    const stillUploading = Boolean(event.currentTarget.querySelector("[data-uploading]"));
    setUploading(stillUploading);
    if (stillUploading) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };
  const formError = uploading ? "Espera a que terminen de subir tus fotos." : state.error;

  return (
    <form action={formAction} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {defaults.proposalId ? (
        <input type="hidden" name="proposalId" value={defaults.proposalId} />
      ) : null}
      {props.mode === "edit" ? (
        <>
          <input type="hidden" name="productId" value={props.productId} />
          {/* Inventario que se mostró: si no cambia, no se pisan las ventas hechas mientras tanto.
              Si cambió mientras se editaba, el servidor manda el vigente y se compara contra ese. */}
          <input type="hidden" name="stockShown" value={state.stockShown ?? defaults.stock ?? ""} />
        </>
      ) : null}
      <Section
        title="Fotos"
        description="La primera es la portada: ordénalas con las flechas. Usa luz natural y fondo liso."
      >
        <ImageUploader name="mediaIds" max={MAX_PRODUCT_IMAGES} initial={defaults.initialMedia} />
        <FieldError errors={errors.mediaIds} />
      </Section>

      <Section title="Lo básico">
        <TextField
          label="Nombre del producto"
          name="title"
          defaultValue={defaults.title}
          errors={errors.title}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="descripcion" className="text-sm font-medium">
            Descripción
          </label>
          <Textarea
            id="descripcion"
            name="description"
            rows={5}
            defaultValue={defaults.description}
            className="text-base"
            aria-invalid={errors.description ? true : undefined}
          />
          <FieldError errors={errors.description} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="categoria" className="text-sm font-medium">
              Categoría
            </label>
            <select
              id="categoria"
              name="categoryId"
              defaultValue={defaults.categoryId ?? ""}
              className={selectClass}
              aria-invalid={errors.categoryId ? true : undefined}
            >
              <option value="" disabled>
                Elige una categoría
              </option>
              {parents.map((parent) => {
                const children = categories.filter((category) => category.parentId === parent.id);
                return children.length ? (
                  <optgroup key={parent.id} label={parent.name}>
                    <option value={parent.id}>{parent.name} (general)</option>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option key={parent.id} value={parent.id}>
                    {parent.name}
                  </option>
                );
              })}
            </select>
            <FieldError errors={errors.categoryId} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="condicion" className="text-sm font-medium">
              Condición
            </label>
            <select
              id="condicion"
              name="condition"
              defaultValue={defaults.condition ?? "NEW"}
              className={selectClass}
            >
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <TextField
          label="Etiquetas"
          name="tags"
          defaultValue={defaults.tags}
          placeholder="audífonos, inalámbricos, apple"
          description="Separadas por comas. Ayudan a que te encuentren."
          errors={errors.tags}
        />
      </Section>

      <Section title="Precio e inventario" description="El costo es privado: solo tú lo ves.">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Precio (MXN)"
            name="price"
            inputMode="decimal"
            placeholder="3,499"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            errors={errors.price}
          />
          <TextField
            label="Tu costo (MXN)"
            name="cost"
            inputMode="decimal"
            placeholder="2,400"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            errors={errors.cost}
          />
        </div>
        <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          Nunca mostramos tu costo a compradores.
        </p>
        <MarginPreview price={price} cost={cost} />
        <TextField
          label="Piezas disponibles"
          name="stock"
          inputMode="numeric"
          defaultValue={defaults.stock ?? "1"}
          description={
            editing
              ? "Las que aún puedes vender: las compras en curso ya están descontadas."
              : undefined
          }
          errors={errors.stock}
        />
      </Section>

      <Section
        title="Entrega"
        description="Datos exactos: con ellos respondemos al instante '¿haces envíos?' sin inventar nada."
      >
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Ciudad" name="city" defaultValue={defaults.city} errors={errors.city} />
          <TextField
            label="Estado"
            name="state"
            defaultValue={defaults.state}
            errors={errors.state}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="pickupAvailable"
            defaultChecked={defaults.pickupAvailable ?? true}
            className="size-4 accent-primary"
          />
          Se puede recoger en persona (el punto exacto se acuerda por mensaje)
        </label>
        <TextField
          label="Zonas donde entregas en persona (opcional)"
          name="localDeliveryZones"
          defaultValue={defaults.localDeliveryZones}
          placeholder="Coyoacán, Benito Juárez"
          description="Separadas por comas."
          errors={errors.localDeliveryZones}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="nationalShippingAvailable"
            checked={national}
            onChange={(event) => setNational(event.target.checked)}
            className="size-4 accent-primary"
          />
          Envío a todo México
        </label>
        <div className={cn("grid grid-cols-3 gap-3", !national && "hidden")}>
          <TextField
            label="Costo de envío"
            name="shippingPrice"
            inputMode="decimal"
            defaultValue={defaults.shippingPrice}
            placeholder="99 (0 = gratis)"
            errors={errors.shippingPrice}
          />
          <TextField
            label="Llega en (mín. días)"
            name="deliveryMinDays"
            inputMode="numeric"
            defaultValue={defaults.deliveryMinDays ?? "2"}
          />
          <TextField
            label="Máx. días"
            name="deliveryMaxDays"
            inputMode="numeric"
            defaultValue={defaults.deliveryMaxDays ?? "5"}
            errors={errors.deliveryMaxDays}
          />
        </div>
      </Section>

      <Section title="Garantía y confianza">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="garantia" className="text-sm font-medium">
              Garantía
            </label>
            <select
              id="garantia"
              name="warrantyType"
              value={warranty}
              onChange={(event) => setWarranty(event.target.value)}
              className={selectClass}
            >
              <option value="NONE">Sin garantía</option>
              <option value="SELLER">La doy yo (vendedor)</option>
              <option value="MANUFACTURER">Del fabricante</option>
            </select>
          </div>
          <div className={cn(warranty === "NONE" && "invisible")}>
            <TextField
              label="Días de garantía"
              name="warrantyDays"
              inputMode="numeric"
              defaultValue={warrantyDays}
              description={`Mínimo ${MIN_WARRANTY_DAYS} días, como pide la ley.`}
              errors={errors.warrantyDays}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="devoluciones" className="text-sm font-medium">
              Devoluciones
            </label>
            <select
              id="devoluciones"
              name="returnWindowDays"
              defaultValue={returnWindow}
              className={selectClass}
            >
              <option value="0">No acepto devoluciones</option>
              {returnWindowOptions.map((days) => (
                <option key={days} value={days}>
                  {days} días
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="autenticidad" className="text-sm font-medium">
              ¿Es de marca original?
            </label>
            <select
              id="autenticidad"
              name="authenticity"
              defaultValue={defaults.authenticity ?? "NOT_APPLICABLE"}
              className={selectClass}
            >
              <option value="NOT_APPLICABLE">No aplica (sin marca)</option>
              <option value="DECLARED_ORIGINAL">Sí, declaro que es original</option>
              <option value="GENERIC">Es genérico o compatible</option>
            </select>
          </div>
        </div>
      </Section>

      {props.mode === "edit" ? null : (
        <Section
          title="Publicar en el feed"
          description="Tu producto aparece como contenido en tus comunidades."
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="publishToFeed"
              checked={publish}
              onChange={(event) => setPublish(event.target.checked)}
              className="size-4 accent-primary"
            />
            Publicar también en el feed
          </label>
          <div className={cn("flex flex-col gap-4", !publish && "hidden")}>
            <div className="flex flex-col gap-2">
              <label htmlFor="comunidad-producto" className="text-sm font-medium">
                Comunidad
              </label>
              <select
                id="comunidad-producto"
                name="communitySlug"
                defaultValue=""
                className={selectClass}
              >
                <option value="">Sin comunidad</option>
                {props.communities.map((community) => (
                  <option key={community.slug} value={community.slug}>
                    {community.emoji} {community.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="texto-post" className="text-sm font-medium">
                Texto de la publicación (opcional)
              </label>
              <Textarea
                id="texto-post"
                name="postBody"
                rows={3}
                maxLength={2000}
                defaultValue={defaults.postBody}
                placeholder="Cuenta por qué vale la pena…"
                className="text-base"
              />
            </div>
          </div>
        </Section>
      )}

      {/* Sin marcar en cada alta y edición (LFDA art. 27 y derecho a la propia imagen). */}
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm leading-snug">
          <input
            type="checkbox"
            name="rightsAttestation"
            required
            className="mt-0.5 size-4 shrink-0 accent-primary"
            aria-invalid={errors.rightsAttestation ? true : undefined}
          />
          <span>
            Las fotos, videos y textos son míos o tengo permiso para usarlos (y de las personas que
            aparecen)
          </span>
        </label>
        <FieldError errors={errors.rightsAttestation} />
      </div>

      {formError ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
          {/* Bloqueo por las reglas (ADR-076): la lista completa está en los Términos. */}
          {!uploading && state.helpLink ? (
            <>
              {" "}
              <Link
                href={state.helpLink.href}
                className="font-semibold underline underline-offset-2"
              >
                {state.helpLink.label}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {editing
          ? pending
            ? "Guardando…"
            : "Guardar cambios"
          : pending
            ? "Publicando…"
            : "Publicar producto"}
      </Button>
    </form>
  );
}
