import { Camera, Clapperboard, Handshake, ShoppingBag } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { listCollaborationProducts } from "@/modules/catalog/queries";
import { CreatorPostList } from "@/modules/creators/components/collaboration-list";
import { PostMetricsList } from "@/modules/creators/components/post-metrics";
import { totalMetrics } from "@/modules/creators/metrics";
import { listCreatorPosts } from "@/modules/creators/service";
import { getViewer } from "@/modules/identity/session";

export const metadata: Metadata = {
  title: "Creadores",
  description:
    "Recomienda productos de las tiendas de Estreno en tus fotos y videos: quien te ve se los prueba y los compra.",
};

const STEPS = [
  {
    icon: ShoppingBag,
    title: "Elige un producto",
    text: "De una tienda que acepta colaboraciones. Abajo están los que puedes recomendar hoy.",
  },
  {
    icon: Clapperboard,
    title: "Publica tu foto o video",
    text: "Con el producto etiquetado: tu publicación lleva el precio y la liga a la tienda.",
  },
  {
    icon: Camera,
    title: "Quien te ve se lo prueba y lo compra",
    text: "Con «Ver cómo me veo» se lo prueba con su foto. Tú ves las visitas, las pruebas y los pedidos.",
  },
] as const;

const sectionHeading = "font-heading text-lg font-bold";

/**
 * Sección de creadores (ADR-063): cómo recomendar productos de tiendas, lo que lograron las
 * publicaciones propias y los productos que se pueden etiquetar hoy. Pública: quien no tiene cuenta
 * ve cómo funciona y el catálogo.
 */
export default async function CreatorsPage() {
  const viewer = await getViewer();
  const signedIn = viewer?.profile?.onboarded === true;
  const [posts, products] = await Promise.all([
    signedIn ? listCreatorPosts(viewer.userId) : [],
    listCollaborationProducts({ excludeUserId: viewer?.userId ?? null }),
  ]);

  return (
    <>
      <PageHeader
        title="Creadores"
        description="Recomienda productos de las tiendas de Estreno en tus fotos y videos."
      />
      <div className="flex flex-col gap-8 px-4 pb-8 md:px-0">
        <section aria-labelledby="creadores-como" className="flex flex-col gap-3">
          <h2 id="creadores-como" className={sectionHeading}>
            Cómo funciona
          </h2>
          <ol className="flex flex-col gap-3">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="flex items-start gap-3 rounded-3xl border bg-card p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-secondary text-ink-2">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">
                    {index + 1}. {title}
                  </span>
                  <span className="text-sm text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="flex items-start gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm">
            <Handshake aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Estreno todavía no paga ni cobra comisiones: si acuerdas algo con una tienda, es entre
              ustedes. Si recibes algo por publicar (pago, producto o comisión), márcalo como
              colaboración: la ley pide que la publicidad se identifique.
            </span>
          </p>
        </section>

        {signedIn ? (
          <section aria-labelledby="creadores-mias" className="flex flex-col gap-3">
            <h2 id="creadores-mias" className={sectionHeading}>
              Tus publicaciones con producto
            </h2>
            {posts.length === 0 ? (
              <EmptyState
                icon={Clapperboard}
                title="Aún no recomiendas ningún producto"
                description="Elige uno de abajo y publica una foto o un video. Aquí verás cuánta gente lo visitó, se lo probó y lo pidió."
              />
            ) : (
              <>
                <PostMetricsList
                  metrics={totalMetrics(posts.map((post) => post.metrics))}
                  label="Total de tus publicaciones con producto"
                />
                <CreatorPostList posts={posts} />
              </>
            )}
          </section>
        ) : (
          <p className="flex flex-wrap items-center gap-3 rounded-3xl border bg-card p-4 text-sm">
            <span className="min-w-0 flex-1">
              Crea tu cuenta para recomendar productos y ver qué logran tus publicaciones.
            </span>
            <Link href={"/registro" as Route} className={buttonVariants()}>
              Crear cuenta
            </Link>
          </p>
        )}

        <section aria-labelledby="creadores-productos" className="flex flex-col gap-3">
          <h2 id="creadores-productos" className={sectionHeading}>
            Productos para recomendar
          </h2>
          {products.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Todavía ninguna tienda acepta colaboraciones"
              description="Cuando una tienda las active, aquí aparecerán sus productos para que los recomiendes."
              action={
                viewer?.sellerProfileId ? (
                  <Link
                    href={"/studio/colaboraciones" as Route}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Activarlas en mi tienda
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3">
              {products.map((product) => (
                <li key={product.id} className="flex flex-col gap-2">
                  <ProductCard product={product} />
                  <Link
                    href={`/crear/publicacion?producto=${product.slug}` as Route}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Crear contenido
                    <span className="sr-only"> con {product.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
