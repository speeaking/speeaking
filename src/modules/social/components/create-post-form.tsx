"use client";

import { type FormEvent, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/modules/media/components/image-uploader";
import { type CreatePostState, createPostAction } from "../actions";
import { MAX_POST_IMAGES, MAX_POST_LENGTH } from "../schemas";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring";

export function CreatePostForm({
  communities,
  products,
  defaultCommunity,
}: {
  communities: { slug: string; name: string; emoji: string }[];
  products: { id: string; title: string }[];
  defaultCommunity?: string;
}) {
  const [state, formAction, pending] = useActionState<CreatePostState, FormData>(
    createPostAction,
    {},
  );

  const [uploading, setUploading] = useState(false);
  // Una foto que aún se sube no tiene campo oculto: se publicaría sin ella y sin avisar.
  const guardUploads = (event: FormEvent<HTMLFormElement>) => {
    const stillUploading = Boolean(event.currentTarget.querySelector("[data-uploading]"));
    setUploading(stillUploading);
    if (stillUploading) event.preventDefault();
  };

  return (
    <form action={formAction} onSubmit={guardUploads} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="cuerpo" className="text-sm font-medium">
          ¿Qué quieres compartir?
        </label>
        <Textarea
          id="cuerpo"
          name="body"
          rows={5}
          maxLength={MAX_POST_LENGTH}
          placeholder="Tu día, una experiencia, una noticia, un chisme…"
          className="text-base"
          aria-describedby="cuerpo-ayuda"
          aria-invalid={state.fieldErrors?.body ? true : undefined}
        />
        <p id="cuerpo-ayuda" className="text-xs text-muted-foreground">
          Chismes sí; exhibir a alguien, no: sin datos ni fotos de otras personas sin su permiso.
        </p>
        {state.fieldErrors?.body ? (
          <p role="alert" className="text-sm text-destructive">
            {state.fieldErrors.body[0]}
          </p>
        ) : null}
      </div>

      <ImageUploader name="mediaIds" max={MAX_POST_IMAGES} />

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
          <option value="">Sin comunidad (solo en mi perfil y para quien me sigue)</option>
          {communities.map((community) => (
            <option key={community.slug} value={community.slug}>
              {community.emoji} {community.name}
            </option>
          ))}
        </select>
      </div>

      {products.length > 0 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="producto" className="text-sm font-medium">
            Etiquetar un producto tuyo (opcional)
          </label>
          <select id="producto" name="productId" defaultValue="" className={selectClass}>
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
          {uploading ? "Espera a que terminen de subir tus fotos." : state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? "Publicando…" : "Publicar"}
      </Button>
    </form>
  );
}
