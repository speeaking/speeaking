"use client";

import { Camera, ImageUp, Loader, ShieldCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SIMULATED_OUTPUT_LABEL } from "@/modules/ai/tasks/simulation";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { searchByPhotoAction } from "../photo-actions";
import { MAX_PHOTO_BYTES, PHOTO_SEND_DIMENSION } from "../photo-rules";
import type { PhotoSearchResult } from "../photo-search-service";

const FAILURES: Record<string, string> = {
  busy: "Hay muchas fotos en este momento. Intenta en unos segundos.",
  unavailable: "La búsqueda por foto no está disponible por ahora. Busca con palabras.",
  limited: "Ya hiciste muchas búsquedas por foto. Intenta más tarde.",
  failed: "No pudimos revisar la foto. Intenta de nuevo.",
  nothing: "No vimos ropa ni objetos que buscar en esa foto. Prueba con otra.",
  needs_auth: "Entra a tu cuenta para buscar por foto.",
};

/**
 * Reduce la foto en el navegador antes de mandarla (menos datos móviles y menos espera). Si el
 * navegador no puede (formato que no decodifica), se manda tal cual y el servidor decide.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, PHOTO_SEND_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Buscar por foto (ADR-061): eliges una foto (de la galería o la cámara), vemos qué ropa u objetos
 * hay y te mostramos parecidos de verdad en Estreno. La foto no se guarda y nunca se reconoce a
 * nadie: eso se dice antes de elegirla.
 */
export function PhotoSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<
    PhotoSearchResult | { ok: false; reason: "needs_auth" } | null
  >(null);
  const [selected, setSelected] = useState(0);
  const [pending, startTransition] = useTransition();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setSelected(0);
    startTransition(async () => {
      const photo = await shrink(file);
      // Más pesada no pasaría (Next corta en 1 MB): se dice aquí en vez de mandarla.
      if (photo.size > MAX_PHOTO_BYTES) {
        setResult({
          ok: false,
          reason: "invalid_image",
          message: "La foto pesa demasiado. Prueba con otra.",
        });
        return;
      }
      const body = new FormData();
      body.append("photo", photo, "foto.jpg");
      try {
        setResult(await searchByPhotoAction(body));
      } catch {
        setResult({ ok: false, reason: "failed" });
      }
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const current = result?.ok ? result.results[selected] : null;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 rounded-3xl border bg-card p-5 text-center">
        {preview ? (
          // Vista previa local (blob:), nunca se sube como tal.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Tu foto" className="max-h-64 w-auto rounded-2xl object-contain" />
        ) : (
          <span className="grid size-16 place-items-center rounded-full bg-secondary">
            <Camera aria-hidden="true" className="size-7" />
          </span>
        )}
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg font-bold">
            {preview ? "¿Otra foto?" : "Sube la foto de algo que te gustó"}
          </p>
          <p className="text-sm text-muted-foreground">
            Un outfit, unos tenis, una lámpara: buscamos parecidos en las tiendas de Estreno.
          </p>
        </div>
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={pending}>
          {pending ? (
            <Loader data-icon="inline-start" className="animate-spin" />
          ) : (
            <ImageUp data-icon="inline-start" />
          )}
          {pending ? "Mirando tu foto…" : preview ? "Elegir otra foto" : "Elegir foto"}
        </Button>
        <label htmlFor="foto-busqueda" className="sr-only">
          Elegir foto para buscar
        </label>
        <input
          ref={inputRef}
          id="foto-busqueda"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => onFile(event.target.files?.[0])}
        />
        <p className="flex items-start gap-1.5 text-left text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-px size-4 shrink-0" />
          Tu foto no se guarda: solo la usamos para describir la ropa y los objetos. Nunca
          reconocemos a las personas.
        </p>
      </div>

      {result && !result.ok ? (
        <p role="status" className="rounded-2xl bg-secondary px-4 py-3 text-sm">
          {result.reason === "invalid_image" && result.message
            ? result.message
            : FAILURES[result.reason]}
          {result.reason === "needs_auth" ? (
            <>
              {" "}
              <Link
                href={"/entrar?next=%2Fbuscar%2Ffoto" as Route}
                className="font-semibold underline"
              >
                Entrar
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {result?.ok ? (
        <section aria-labelledby="foto-resultados" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="foto-resultados" className="font-heading text-lg font-bold">
              Esto vimos en tu foto
            </h2>
            {result.simulated ? (
              <p className="text-xs text-muted-foreground">{SIMULATED_OUTPUT_LABEL}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Descrito con IA; los productos son reales y los busca la plataforma.
              </p>
            )}
          </div>
          <div role="group" aria-label="Cosas en tu foto" className="flex flex-wrap gap-2">
            {result.results.map((item, index) => (
              <button
                key={item.query}
                type="button"
                aria-pressed={index === selected}
                onClick={() => setSelected(index)}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                  index === selected
                    ? "border-foreground bg-foreground text-background"
                    : "bg-card hover:bg-secondary",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {current && current.products.length > 0 ? (
            <ul
              aria-label={`Parecidos a: ${current.label}`}
              className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3"
            >
              {current.products.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          ) : current ? (
            <p className="rounded-2xl bg-secondary px-4 py-3 text-sm">
              Todavía no hay nada parecido a «{current.label}» en las tiendas de Estreno. Prueba con
              otra cosa de tu foto o con otra foto.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
