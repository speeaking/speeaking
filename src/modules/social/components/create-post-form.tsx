"use client";

import { Clapperboard, ImagePlus, LockKeyhole, Globe } from "lucide-react";
import Image from "next/image";
import { type FormEvent, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { COLLABORATION_DISCLOSURE, COLLABORATION_HINT } from "@/modules/creators/rules";
import type { TaggedProductDTO } from "@/modules/creators/service";
import { ImageUploader } from "@/modules/media/components/image-uploader";
import { VideoPicker } from "@/modules/media/components/video-picker";
import { type CreatePostState, createPostAction } from "../actions";
import { MAX_POST_IMAGES, MAX_POST_LENGTH } from "../schemas";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring";

const modeClass =
  "flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function CreatePostForm({
  communities,
  products,
  defaultCommunity,
  videoEnabled = false,
  publicAccount = false,
  taggedProduct = null,
  inLayer = false,
  defaultMedia = "photos",
}: {
  communities: { slug: string; name: string; emoji: string }[];
  products: { id: string; title: string }[];
  defaultCommunity?: string;
  /** Se pueden subir videos cortos (ADR-062). */
  videoEnabled?: boolean;
  /** El servidor identifica a la cuenta administradora que publica avisos públicos. */
  publicAccount?: boolean;
  /** Producto que se quiere etiquetar (`?producto=`): propio o de una tienda que acepta colaboraciones. */
  taggedProduct?: TaggedProductDTO | null;
  /** En la ventana encima del feed (ADR-068): al publicar, cerrar regresa al feed, no al formulario. */
  inLayer?: boolean;
  /** El acceso «Video» del feed abre directamente su selector. */
  defaultMedia?: "photos" | "video";
}) {
  // El producto de otra tienda (ADR-063) va en su propia tarjeta, con la declaración de acuerdo; se
  // puede quitar antes de publicar.
  const [tagged, setTagged] = useState(taggedProduct !== null && !taggedProduct.own);
  const [ownProduct, setOwnProduct] = useState(
    taggedProduct?.own && products.some((product) => product.id === taggedProduct.id)
      ? taggedProduct.id
      : "",
  );
  const publicProduct = tagged || Boolean(ownProduct);
  const publicPost = publicAccount || publicProduct;
  // Fotos o un video, no los dos. Lo de la otra pestaña no se pierde al cambiar: queda en un
  // `fieldset` desactivado (sus campos no se envían) y vuelve al regresar.
  const [mode, setMode] = useState<"photos" | "video">(videoEnabled ? defaultMedia : "photos");
  // Controlado: React no borra un texto largo si la acción devuelve un error.
  const [body, setBody] = useState("");
  const bodyLength = body.trim().length;
  const bodyTooLong = bodyLength > MAX_POST_LENGTH;
  const [state, formAction, pending] = useActionState<CreatePostState, FormData>(
    createPostAction,
    {},
  );

  const [uploading, setUploading] = useState(false);
  // Una foto que aún se sube no tiene campo oculto: se publicaría sin ella y sin avisar.
  const guardUploads = (event: FormEvent<HTMLFormElement>) => {
    const stillUploading = Boolean(
      event.currentTarget.querySelector("fieldset:not(:disabled) [data-uploading]"),
    );
    setUploading(stillUploading);
    if (stillUploading || bodyTooLong) event.preventDefault();
  };

  return (
    <form action={formAction} onSubmit={guardUploads} className="flex flex-col gap-4">
      {inLayer ? <input type="hidden" name="enCapa" value="1" /> : null}
      <p
        className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground"
        aria-live="polite"
      >
        {publicPost ? (
          <Globe className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
        )}
        {publicAccount
          ? "Público: las publicaciones de la cuenta administradora, incluidas sus fotos o video, son visibles para todos."
          : publicProduct
            ? "Público: al etiquetar un producto, cualquier persona puede ver esta publicación y sus fotos o video."
            : "Solo amigos: tus fotos, videos y esta publicación personal serán visibles únicamente para amigos aceptados."}
      </p>
      <div role="group" aria-label="Añadir a tu publicación" className="flex gap-2">
        {(
          [
            { value: "photos", label: "Fotos", Icon: ImagePlus },
            { value: "video", label: "Video", Icon: Clapperboard },
          ] as const
        ).map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            disabled={value === "video" && !videoEnabled}
            onClick={() => {
              setMode(value);
              setUploading(false);
            }}
            className={cn(
              modeClass,
              mode === value
                ? "border-foreground bg-foreground text-background"
                : "bg-card hover:bg-secondary",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </button>
        ))}
      </div>
      {!videoEnabled ? (
        <p className="text-xs text-muted-foreground">La subida de videos aún no está disponible.</p>
      ) : null}
      <div className="flex flex-col gap-2">
        <label htmlFor="cuerpo" className="text-sm font-medium">
          ¿Qué quieres compartir?
        </label>
        <Textarea
          id="cuerpo"
          name="body"
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Tu día, una experiencia, una noticia, un chisme…"
          className="max-h-72 min-h-28 overflow-y-auto text-base"
          aria-describedby="cuerpo-ayuda"
          aria-invalid={bodyTooLong || state.fieldErrors?.body ? true : undefined}
        />
        <p id="cuerpo-ayuda" className="text-xs text-muted-foreground">
          Menciona a alguien con @usuario. Recibirá un aviso si puede ver tu publicación. Sin datos
          ni fotos de otras personas sin su permiso.
        </p>
        {bodyLength >= MAX_POST_LENGTH * 0.9 ? (
          <p className={cn("text-xs", bodyTooLong ? "text-destructive" : "text-muted-foreground")}>
            {bodyLength.toLocaleString("es-MX")} / 60,000 caracteres
          </p>
        ) : null}
        {bodyTooLong || state.fieldErrors?.body ? (
          <p role="alert" className="text-sm text-destructive">
            {bodyTooLong
              ? "Tu publicación puede tener hasta 60,000 caracteres. El texto que pegaste sigue aquí para que puedas ajustarlo."
              : state.fieldErrors?.body?.[0]}
          </p>
        ) : null}
      </div>

      <fieldset disabled={mode !== "photos"} hidden={mode !== "photos"} className="min-w-0">
        <legend className="sr-only">Fotos</legend>
        <ImageUploader name="mediaIds" max={MAX_POST_IMAGES} />
      </fieldset>
      {videoEnabled ? (
        <fieldset disabled={mode !== "video"} hidden={mode !== "video"} className="min-w-0">
          <legend className="sr-only">Video</legend>
          <VideoPicker name="videoId" />
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="comunidad" className="text-sm font-medium">
          Comunidad
        </label>
        <select
          id="comunidad"
          name="communitySlug"
          defaultValue={defaultCommunity ?? ""}
          className={selectClass}
        >
          <option value="">Sin comunidad</option>
          {communities.map((community) => (
            <option key={community.slug} value={community.slug}>
              {community.emoji} {community.name}
            </option>
          ))}
        </select>
      </div>

      {taggedProduct && tagged ? (
        <fieldset className="flex min-w-0 flex-col gap-3 rounded-2xl border p-3.5">
          <legend className="sr-only">Producto etiquetado</legend>
          <div className="flex items-center gap-3">
            {taggedProduct.image ? (
              <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                <Image
                  src={taggedProduct.image.url}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-muted-foreground">Producto etiquetado</span>
              <span className="truncate font-semibold">{taggedProduct.title}</span>
              <span className="truncate text-sm text-muted-foreground">
                {formatMoney(taggedProduct.priceCents, taggedProduct.currency)} · Vendido por{" "}
                {taggedProduct.storeName}
              </span>
            </div>
            <Button type="button" variant="ghost" onClick={() => setTagged(false)}>
              Quitar<span className="sr-only"> el producto etiquetado</span>
            </Button>
          </div>
          <input type="hidden" name="productId" value={taggedProduct.id} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="collaboration" className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-semibold">{COLLABORATION_DISCLOSURE}.</span>{" "}
              <span className="text-muted-foreground">{COLLABORATION_HINT}</span>
            </span>
          </label>
        </fieldset>
      ) : products.length > 0 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="producto" className="text-sm font-medium">
            Etiquetar un producto tuyo (opcional)
          </label>
          <select
            id="producto"
            name="productId"
            value={ownProduct}
            onChange={(event) => setOwnProduct(event.target.value)}
            className={selectClass}
          >
            <option value="">Ninguno</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {uploading || state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {uploading ? "Espera a que termine de subir lo que agregaste." : state.error}
        </p>
      ) : null}

      <div
        className={
          inLayer
            ? "sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:-mx-6 sm:px-6"
            : undefined
        }
      >
        <Button
          type="submit"
          size="lg"
          className="h-11 w-full text-base"
          disabled={pending || bodyTooLong}
        >
          {pending ? "Publicando…" : "Publicar"}
        </Button>
      </div>
    </form>
  );
}
