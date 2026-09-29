import { Shirt } from "lucide-react";
import type { Metadata, Route } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { isFeatureOn } from "@/modules/ai/features-store";
import { getViewer } from "@/modules/identity/session";
import { LookCard } from "@/modules/stylist/components/look-card";
import { NeedForm } from "@/modules/stylist/components/need-form";
import { NEED_TEXT_MAX } from "@/modules/stylist/need";
import {
  createLooks,
  listMyLooks,
  type LooksResult,
  saveNeedAsIntent,
} from "@/modules/stylist/service";
import { imageAvailability } from "@/server/providers/image";

export const metadata: Metadata = {
  title: "Tu estilista",
  description:
    "Dinos qué necesitas y te armamos looks con productos reales para que te los pruebes.",
};

const SOURCE_NOTE: Record<LooksResult["source"], string> = {
  ai: "Interpretado con ayuda de IA; los looks los arma el código con productos reales.",
  simulated:
    "Interpretado con reglas (IA simulada); los looks los arma el código con productos reales.",
  rules: "Interpretado con reglas; los looks los arma el código con productos reales.",
};

export default async function StylistPage({ searchParams }: PageProps<"/estilista">) {
  const { necesidad } = await searchParams;
  const text = typeof necesidad === "string" ? necesidad.trim().slice(0, NEED_TEXT_MAX) : "";
  const viewer = await getViewer();
  const userId = viewer?.userId ?? null;
  const [createLookOn, tryOnOn] = await Promise.all([
    isFeatureOn("createLook"),
    isFeatureOn("virtualTryOn"),
  ]);
  const tryOnAvailable = tryOnOn && imageAvailability() !== "unavailable";
  // Un prefetch no es una petición de la persona: no se arman ni guardan looks.
  const prefetch = (await headers()).has("next-router-prefetch");

  let result: LooksResult | null = null;
  if (text.length >= 3 && createLookOn && !prefetch) {
    result = await createLooks({ userId, text });
    if (userId) await saveNeedAsIntent(userId, text, result.need);
  }
  const myLooks = userId ? await listMyLooks(userId, 6) : [];
  const returnTo = text ? `/estilista?necesidad=${encodeURIComponent(text)}` : "/estilista";

  return (
    <>
      <PageHeader
        title="Tu estilista"
        description="Dinos la ocasión, tu estilo y cuánto quieres gastar. Te armamos looks completos con productos reales de la plataforma y te los pruebas con tu foto."
      />
      <div className="flex flex-col gap-6 px-4 md:px-0">
        {createLookOn ? (
          <NeedForm defaultValue={text} />
        ) : (
          <p className="rounded-2xl bg-secondary px-4 py-3 text-sm">
            El estilista no está disponible por ahora.
          </p>
        )}

        {result ? (
          <section aria-labelledby="looks-titulo" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="looks-titulo" className="font-heading text-lg font-bold">
                {result.summary ? `Entendí: ${result.summary}` : "Esto es lo que encontramos"}
              </h2>
              <p className="text-xs text-muted-foreground">{SOURCE_NOTE[result.source]}</p>
              {result.need.budgetMaxCents !== null ? (
                <p className="text-xs text-muted-foreground">
                  Presupuesto para todo el look: hasta {formatMoney(result.need.budgetMaxCents)}.
                </p>
              ) : null}
            </div>
            {result.looks.length > 0 ? (
              <div className="flex flex-col gap-4">
                {result.looks.map((look, index) => (
                  <LookCard
                    key={look.id ?? `${index}`}
                    look={look}
                    isSignedIn={Boolean(userId)}
                    tryOnAvailable={tryOnAvailable}
                    returnTo={returnTo}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Shirt}
                title={
                  result.candidates === 0
                    ? "Todavía no hay ropa publicada para armar looks"
                    : "No encontramos un look completo con ese presupuesto"
                }
                description={
                  result.candidates === 0
                    ? "En cuanto los vendedores publiquen prendas, aquí verás combinaciones. Mientras, explora Comprar."
                    : "Prueba con un presupuesto mayor o describe otra cosa: necesitamos al menos una prenda de arriba, una de abajo y calzado (o un vestido y calzado)."
                }
                action={
                  <Link
                    href={"/comprar?categoria=moda" as Route}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Ver moda en Comprar
                  </Link>
                }
              />
            )}
          </section>
        ) : null}

        {myLooks.length > 0 ? (
          <section aria-labelledby="mis-looks" className="flex flex-col gap-2">
            <h2 id="mis-looks" className="font-heading text-lg font-bold">
              Tus looks recientes
            </h2>
            <ul className="flex flex-col divide-y rounded-3xl border bg-card">
              {myLooks.map((look) => (
                <li key={look.id}>
                  <Link
                    href={`/probar?look=${look.id}` as Route}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-secondary"
                  >
                    <span className="min-w-0 truncate font-semibold">{look.title}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {look.items === 1 ? "1 pieza" : `${look.items} piezas`} ·{" "}
                      {formatMoney(look.totalCents, look.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
