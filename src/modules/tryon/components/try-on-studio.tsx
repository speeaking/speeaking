"use client";

import { Check } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MediaDTO } from "@/modules/catalog/dto";
import { generateTryOnAction, type TryOnFormState } from "../actions";
import { TRY_ON_DISCLAIMER } from "../consent";
import type { FundingStatus } from "../funding";
import { MAX_TRY_ON_GARMENTS } from "../limits";
import { PhotoRegisterForm } from "./photo-register-form";

export type StudioPhoto = { id: string; url: string; createdAt: string };
export type StudioProduct = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  slotLabel: string;
  image: MediaDTO | null;
};

/**
 * Estudio de Pruébatelo: 1) tu foto, 2) qué te pruebas (hasta 4 prendas), 3) generar. Una sola
 * acción principal. Dice antes quién paga la prueba: la tienda de la prenda principal o speeaking;
 * quien compra, nunca (ADR-046).
 */
export function TryOnStudio({
  photos,
  products,
  status,
  simulated,
}: {
  photos: StudioPhoto[];
  products: StudioProduct[];
  /** Quién pagaría la prueba sobre la prenda principal (`none`: la tienda no la tiene activa). */
  status: FundingStatus;
  /** El proveedor de imágenes es el simulador: el resultado será un ejemplo. */
  simulated: boolean;
}) {
  const [photoId, setPhotoId] = useState(photos[0]?.id ?? "");
  // La foto elegida se deriva de las props: al subir una (la página se revalida y llegan fotos
  // nuevas) o al borrarla, el estado local no se queda con un id vacío o viejo.
  const activePhotoId = photos.some((photo) => photo.id === photoId)
    ? photoId
    : (photos[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>(() =>
    products.slice(0, MAX_TRY_ON_GARMENTS).map((product) => product.id),
  );
  const [state, formAction, pending] = useActionState<TryOnFormState, FormData>(
    generateTryOnAction,
    {},
  );
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= MAX_TRY_ON_GARMENTS
          ? current
          : [...current, id],
    );
  const canGenerate = activePhotoId !== "" && selected.length > 0 && status !== "none";
  const funding =
    status === "sponsored"
      ? "Esta prueba es cortesía de la tienda: para ti es gratis."
      : status === "trial"
        ? `Esta prueba es cortesía de ${siteConfig.name}: para ti es gratis.`
        : "La tienda de la prenda principal todavía no activa «Ver cómo me veo». Le avisamos que quisiste probártela.";

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="paso-foto"
        className="flex flex-col gap-3 rounded-3xl border bg-card p-4"
      >
        <h2 id="paso-foto" className="font-heading text-lg font-bold">
          1. Tu foto
        </h2>
        {photos.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Tus fotos">
            {photos.map((photo) => {
              const active = photo.id === activePhotoId;
              return (
                <li key={photo.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPhotoId(photo.id)}
                    className={cn(
                      "relative size-24 overflow-hidden rounded-2xl border-2 bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring",
                      active ? "border-foreground" : "border-transparent",
                    )}
                  >
                    <Image
                      src={photo.url}
                      alt="Tu foto"
                      fill
                      sizes="96px"
                      style={{ objectFit: "cover" }}
                    />
                    {active ? (
                      <span className="absolute right-1 bottom-1 grid size-6 place-items-center rounded-full bg-foreground text-background">
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <PhotoRegisterForm compact={photos.length > 0} />
      </section>

      <section
        aria-labelledby="paso-prendas"
        className="flex flex-col gap-3 rounded-3xl border bg-card p-4"
      >
        <h2 id="paso-prendas" className="font-heading text-lg font-bold">
          2. Qué te pruebas{" "}
          <span className="text-sm font-normal text-muted-foreground">
            (hasta {MAX_TRY_ON_GARMENTS} prendas)
          </span>
        </h2>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Abre un producto de ropa, calzado o accesorios y toca «Ver cómo me veo», o arma un look
            con{" "}
            <Link
              href="/estilista"
              className="font-semibold text-primary-text underline-offset-2 hover:underline"
            >
              tu estilista
            </Link>
            .
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Prendas">
            {products.map((product) => {
              const active = selected.includes(product.id);
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(product.id)}
                    className={cn(
                      "flex w-full flex-col gap-1.5 rounded-2xl border-2 p-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring",
                      active ? "border-foreground" : "border-transparent hover:bg-secondary",
                    )}
                  >
                    <span className="relative aspect-4/5 w-full overflow-hidden rounded-xl bg-muted">
                      {product.image ? (
                        <Image
                          src={product.image.url}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 50vw, 160px"
                          style={{ objectFit: "cover" }}
                        />
                      ) : null}
                    </span>
                    <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                      {product.slotLabel}
                    </span>
                    <span className="line-clamp-2 text-sm leading-snug font-semibold">
                      {product.title}
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                      {formatMoney(product.priceCents, product.currency)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form action={formAction} className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
        <h2 className="font-heading text-lg font-bold">3. Genera tu simulación</h2>
        <input type="hidden" name="photoId" value={activePhotoId} />
        {selected.map((id) => (
          <input key={id} type="hidden" name="productId" value={id} />
        ))}
        <p className="text-sm text-ink-2">{funding}</p>
        {simulated ? (
          <p className="rounded-2xl bg-secondary px-3 py-2 text-xs text-ink-2">
            En esta etapa la simulación es de ejemplo (sin modelo de imagen): verás tu foto con las
            prendas al lado, no puestas.
          </p>
        ) : null}
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="lg"
            className="h-11 px-5 font-bold"
            disabled={!canGenerate || pending}
          >
            {pending ? "Generando…" : "Ver cómo me veo"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {TRY_ON_DISCLAIMER}{" "}
          <Link href={"/precios" as Route} className="underline-offset-2 hover:underline">
            Quién paga las pruebas
          </Link>
        </p>
      </form>
    </div>
  );
}
