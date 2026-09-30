"use client";

import { Camera, Check, Loader, Plus, ShoppingBag } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addToCartAction, buyNowAction } from "@/modules/commerce/actions";
import { ImageUploader } from "@/modules/media/components/image-uploader";
import { quickTryOnAction, type QuickTryOnState } from "../actions";
import type { ComplementDTO } from "../complements";
import { TRY_ON_CONSENT_TEXT, TRY_ON_DISCLAIMER, TRY_ON_RETENTION_DAYS } from "../consent";
import { describeFunding, type FundingStatus } from "../funding";
import { MAX_TRY_ON_GARMENTS } from "../limits";

export type DialogPhoto = { id: string; url: string };
export type DialogProduct = { id: string; slug: string; title: string; priceCents: number };

/**
 * «Ver cómo me veo» (ADR-046): desde la ficha de una prenda, sube tu foto (o elige una guardada),
 * un botón, y la simulación aparece aquí mismo. Después: comprar, agregarle piezas que la
 * completan o probar otra foto. Quien compra nunca paga: la prueba la pone la tienda o Estreno.
 */
export function TryOnDialog({
  product,
  photos,
  complements,
  status,
  simulated,
  returnTo,
  defaultOpen = false,
}: {
  product: DialogProduct;
  photos: DialogPhoto[];
  complements: ComplementDTO[];
  status: FundingStatus;
  simulated: boolean;
  returnTo: string;
  /** Abrir al cargar: la persona llegó desde «Ver cómo me veo» en una tarjeta (`?probar=1`). */
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [photoId, setPhotoId] = useState(photos[0]?.id ?? "");
  const [extras, setExtras] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState<QuickTryOnState, FormData>(
    quickTryOnAction,
    {},
  );
  const [buying, startBuying] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const activePhotoId = photos.some((photo) => photo.id === photoId)
    ? photoId
    : (photos[0]?.id ?? "");
  const result = state.result ?? null;
  const funded = status !== "none";

  // Una foto nueva queda guardada en Ajustes: la página se revalida y llega en `photos`.
  useEffect(() => {
    if (state.result) router.refresh();
  }, [state.result, router]);

  const toggleExtra = (id: string) =>
    setExtras((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length + 1 >= MAX_TRY_ON_GARMENTS
          ? current
          : [...current, id],
    );

  const buy = (mode: "now" | "cart") =>
    startBuying(async () => {
      const ids = [product.id, ...extras];
      for (const [index, productId] of ids.entries()) {
        const last = index === ids.length - 1;
        const outcome =
          mode === "now" && last
            ? await buyNowAction({ productId, quantity: 1, sourcePostId: null })
            : await addToCartAction({ productId, quantity: 1, sourcePostId: null });
        if (!outcome.ok) {
          toast.error(outcome.error);
          return;
        }
      }
      if (mode === "cart") {
        toast.success(ids.length === 1 ? "Agregado al carrito" : "Piezas agregadas al carrito", {
          action: { label: "Ver carrito", onClick: () => router.push("/carrito") },
        });
      }
    });

  const total =
    product.priceCents +
    complements
      .filter((item) => extras.includes(item.id))
      .reduce((sum, item) => sum + item.priceCents, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full border-foreground/25 text-base font-bold sm:w-auto sm:px-5"
          />
        }
        nativeButton
      >
        <Camera data-icon="inline-start" />
        Ver cómo me veo
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold">
            {result ? "Así podrías verte" : "Ver cómo me veo"}
          </DialogTitle>
          <DialogDescription>
            {result
              ? `${TRY_ON_DISCLAIMER} ${describeFunding(result.funding)}; solo tú la ves.`
              : funded
                ? `Con tu foto y esta prenda armamos una simulación con IA. Es gratis para ti: la pone ${
                    status === "sponsored" ? "la tienda" : "Estreno"
                  }.`
                : "Esta tienda todavía no activa «Ver cómo me veo»."}
          </DialogDescription>
        </DialogHeader>

        {!funded ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Le avisamos a la tienda que quisiste probarte {product.title}. Mientras, puedes armar
              un look con el estilista o guardar el producto.
            </p>
            <form action={formAction} className="contents">
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="photoId" value={activePhotoId} />
            </form>
            <Link href={"/estilista" as Route} className="text-sm font-semibold text-primary-text">
              Ir al estilista
            </Link>
          </div>
        ) : result ? (
          <div className="flex flex-col gap-4">
            <figure className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-muted">
              {result.image ? (
                <Image
                  src={result.image.url}
                  alt="Simulación de cómo podría verse la prenda en ti"
                  width={result.image.width}
                  height={result.image.height}
                  sizes="(max-width: 640px) 100vw, 448px"
                  priority
                  className="h-auto w-full"
                />
              ) : (
                <p className="p-6 text-sm text-muted-foreground">Se está generando…</p>
              )}
              {simulated ? (
                <figcaption className="absolute inset-x-0 bottom-0 bg-foreground/70 px-3 py-1.5 text-center text-xs text-background">
                  Ejemplo con la IA simulada: tu foto y las prendas al lado, no puestas.
                </figcaption>
              ) : null}
            </figure>

            {complements.length > 0 ? (
              <section aria-labelledby="agregale" className="flex flex-col gap-2">
                <h3 id="agregale" className="text-sm font-bold">
                  Agrégale…
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    y vuelve a verte con todo puesto
                  </span>
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {complements.map((item) => {
                    const active = extras.includes(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleExtra(item.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-left text-xs font-semibold transition-colors hover:bg-secondary",
                            active && "border-foreground bg-secondary",
                          )}
                        >
                          <span className="relative size-8 shrink-0 overflow-hidden rounded-full bg-muted">
                            {item.image ? (
                              <Image
                                src={item.image.url}
                                alt=""
                                fill
                                sizes="32px"
                                style={{ objectFit: "cover" }}
                              />
                            ) : null}
                          </span>
                          <span className="flex flex-col leading-tight">
                            <span className="max-w-36 truncate">{item.title}</span>
                            <span className="text-muted-foreground">
                              {item.slotLabel} · {formatMoney(item.priceCents, item.currency)}
                            </span>
                          </span>
                          {active ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {extras.length > 0 ? (
                  <form action={formAction} className="contents">
                    <input type="hidden" name="productId" value={product.id} />
                    {extras.map((id) => (
                      <input key={id} type="hidden" name="productId" value={id} />
                    ))}
                    <input type="hidden" name="photoId" value={activePhotoId} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <Button type="submit" variant="outline" size="sm" disabled={pending}>
                      {pending ? (
                        <>
                          <Loader data-icon="inline-start" className="animate-spin" />
                          Generando…
                        </>
                      ) : (
                        "Verme con todo puesto"
                      )}
                    </Button>
                  </form>
                ) : null}
              </section>
            ) : null}

            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="lg"
                  className="h-12 text-base"
                  disabled={buying}
                  onClick={() => buy("now")}
                >
                  Comprar {extras.length > 0 ? `todo · ${formatMoney(total)}` : "ahora"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 text-base"
                  disabled={buying}
                  onClick={() => buy("cart")}
                >
                  <ShoppingBag data-icon="inline-start" />
                  Al carrito
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cada pieza se compra a quien la vende.{" "}
                <Link href={`/probar/${result.id}` as Route} className="underline">
                  Ver en grande
                </Link>
                {" · "}
                <Link
                  href={`/probar?producto=${encodeURIComponent(product.slug)}` as Route}
                  className="underline"
                >
                  Probar con otra foto o más prendas
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <form ref={formRef} action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            {photos.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">Tu foto</p>
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
                            "relative size-20 overflow-hidden rounded-2xl border-2 bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring",
                            active ? "border-foreground" : "border-transparent",
                          )}
                        >
                          <Image
                            src={photo.url}
                            alt="Tu foto"
                            fill
                            sizes="80px"
                            style={{ objectFit: "cover" }}
                          />
                          {active ? (
                            <span className="absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-foreground text-background">
                              <Check className="size-3" strokeWidth={3} />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <input type="hidden" name="photoId" value={activePhotoId} />
                <p className="text-xs text-muted-foreground">
                  ¿Otra foto?{" "}
                  <Link
                    href={`/probar?producto=${encodeURIComponent(product.slug)}` as Route}
                    className="underline"
                  >
                    Súbela en el estudio
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">Sube tu foto</p>
                <p className="text-xs text-muted-foreground">
                  De frente, con buena luz y de cuerpo completo si es pantalón o vestido. Solo tú la
                  ves; se borra a los {TRY_ON_RETENTION_DAYS} días.
                </p>
                <ImageUploader name="mediaId" max={1} />
                <label className="flex items-start gap-2 text-xs leading-snug">
                  <input
                    type="checkbox"
                    name="consent"
                    required
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{TRY_ON_CONSENT_TEXT}</span>
                </label>
              </div>
            )}
            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" size="lg" className="h-12 text-base font-bold" disabled={pending}>
              {pending ? (
                <>
                  <Loader data-icon="inline-start" className="animate-spin" />
                  Generando tu simulación…
                </>
              ) : (
                "Ver cómo me veo"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              {simulated
                ? "En esta etapa la simulación es de ejemplo (sin modelo de imagen)."
                : "Tarda unos 20 segundos."}{" "}
              {TRY_ON_DISCLAIMER}
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
