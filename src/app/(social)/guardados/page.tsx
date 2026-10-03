import { Bookmark, Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { requireViewer } from "@/modules/identity/session";
import { RemoveContentButton } from "@/modules/identity/components/remove-content-button";
import { productCardsByIds } from "@/modules/search/queries";
import { PostCard } from "@/modules/social/components/post-card";
import { hydratePosts } from "@/modules/social/post-queries";
import { listSavedItemIds, SAVED_PRODUCT_STATUSES } from "@/modules/social/saved-queries";

export const metadata: Metadata = { title: "Guardados", robots: { index: false } };

// Se ve de 34 px; el `after` estira el área táctil a 44 px sin cambiar el diseño.
const chip =
  "relative shrink-0 rounded-full border bg-card px-3.5 py-1.5 text-sm font-semibold transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0 hover:bg-secondary";

export default async function SavedPage() {
  const viewer = await requireViewer("/guardados");
  // Solo los guardados de la sesión: el ID sale del servidor, nunca de la URL.
  const { postIds, productIds } = await listSavedItemIds(viewer.userId);
  const [posts, products] = await Promise.all([
    hydratePosts(postIds, viewer.userId),
    productCardsByIds(productIds, SAVED_PRODUCT_STATUSES),
  ]);

  if (posts.length === 0 && products.length === 0) {
    return (
      <>
        <PageHeader title="Guardados" />
        <div className="px-4 md:px-0">
          <EmptyState
            icon={Bookmark}
            title="Aún no guardas nada"
            description="Toca el marcador en una publicación o en un producto y aquí lo encontrarás después."
            action={
              <Link href="/descubrir" className={buttonVariants({ variant: "soft" })}>
                <Compass data-icon="inline-start" />
                Explorar comunidades
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Guardados"
        description="Lo que guardaste, lo más reciente primero."
        actions={
          <RemoveContentButton
            kind="saved"
            id="all"
            label="Vaciar"
            description="Se quitarán todos los elementos de tus guardados. Las publicaciones y productos originales seguirán disponibles."
          />
        }
      />
      {posts.length > 0 && products.length > 0 ? (
        <nav aria-label="Secciones de guardados" className="mb-5 flex gap-2 px-4 md:px-0">
          <a href="#publicaciones" className={chip}>
            Publicaciones
          </a>
          <a href="#productos" className={chip}>
            Productos
          </a>
        </nav>
      ) : null}

      <div className="flex flex-col gap-8">
        {posts.length > 0 ? (
          <section
            id="publicaciones"
            aria-labelledby="guardados-publicaciones"
            className="flex scroll-mt-20 flex-col gap-3"
          >
            <h2 id="guardados-publicaciones" className="px-4 text-lg font-extrabold md:px-0">
              Publicaciones
            </h2>
            <div className="flex flex-col md:gap-4">
              {posts.map((post, index) => (
                <PostCard key={post.id} post={post} index={index} isSignedIn />
              ))}
            </div>
          </section>
        ) : null}

        {products.length > 0 ? (
          <section
            id="productos"
            aria-labelledby="guardados-productos"
            className="flex scroll-mt-20 flex-col gap-3"
          >
            <h2 id="guardados-productos" className="px-4 text-lg font-extrabold md:px-0">
              Productos
            </h2>
            <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:px-0">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
