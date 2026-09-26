import { Compass, Search, SearchX } from "lucide-react";
import type { Metadata, Route } from "next";
import Form from "next/form";
import { headers } from "next/headers";
import Link from "next/link";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { track } from "@/modules/analytics/track";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { communitySignal } from "@/modules/identity/community-signal";
import { countPostsOfNewCommunities } from "@/modules/identity/service";
import { getJoinedCommunityIds, getViewer } from "@/modules/identity/session";
import { parseSearchQuery, SEARCH_MAX_LENGTH } from "@/modules/search/normalize";
import { searchEverything } from "@/modules/search/queries";
import { SEARCH_LIMITS } from "@/modules/search/sql";
import { JoinButton } from "@/modules/social/components/join-button";
import { PostCard } from "@/modules/social/components/post-card";

// Los resultados de búsqueda interna no se indexan: cambian a cada rato y duplican contenido.
export const metadata: Metadata = { title: "Buscar", robots: { index: false } };

const sectionHeading = "px-4 text-lg font-extrabold md:px-0";

export default async function SearchPage({ searchParams }: PageProps<"/buscar">) {
  const { q } = await searchParams;
  const query = parseSearchQuery(q);
  const viewer = await getViewer();

  const [results, joined, newCommunityPosts] = query
    ? await Promise.all([
        searchEverything(query, viewer?.userId ?? null),
        getJoinedCommunityIds(),
        countPostsOfNewCommunities(),
      ])
    : [null, null, null];

  // Una acción en esta página («Unirme», seguir…) vuelve a pintarla en la misma petición POST
  // (revalidatePath): eso no es una búsqueda nueva y no debe contarse otra vez como intención.
  const isActionRerender = (await headers()).has("next-action");

  if (query && results && !isActionRerender) {
    // P5: las búsquedas son señales de intención; los conteos ayudan a detectar búsquedas sin
    // resultados (contenido que falta).
    track({
      type: "SEARCH",
      userId: viewer?.userId ?? null,
      query: query.text,
      surface: "DISCOVER",
      metadata: {
        scope: "global",
        communities: results.communities.length,
        products: results.products.length,
        posts: results.posts.length,
      },
    });
  }
  const found = results
    ? results.communities.length + results.products.length + results.posts.length
    : 0;

  return (
    <>
      <PageHeader
        title="Buscar"
        description={
          query
            ? `Resultados para “${query.text}”`
            : "Encuentra comunidades, publicaciones y productos."
        }
      />

      {/* En escritorio la búsqueda vive en la barra superior. */}
      <Form action="/buscar" role="search" className="relative mb-5 px-4 md:hidden">
        <Search
          className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor="busqueda" className="sr-only">
          Buscar comunidades, temas o productos
        </label>
        <Input
          key={query?.text ?? ""}
          id="busqueda"
          name="q"
          type="search"
          defaultValue={query?.text ?? ""}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Busca comunidades, temas o productos"
          autoComplete="off"
          enterKeyHint="search"
          // Se llega aquí con la lupa: el teclado ya abierto ahorra un toque.
          autoFocus={!query}
          className="h-11 rounded-full pl-9 text-base"
        />
      </Form>

      {!query || !results ? (
        <div className="px-4 md:px-0">
          <EmptyState
            icon={Search}
            title="¿Qué quieres descubrir?"
            description="Busca por nombre de comunidad, tema o producto. Por ejemplo: recetas, tenis para correr o gaming."
            action={
              <Link href="/descubrir" className={buttonVariants({ variant: "soft" })}>
                <Compass data-icon="inline-start" />
                Explorar comunidades
              </Link>
            }
          />
        </div>
      ) : found === 0 ? (
        <div className="px-4 md:px-0">
          <EmptyState
            icon={SearchX}
            title={`Sin resultados para “${query.text}”`}
            description="Revisa cómo está escrito o prueba con otra palabra. También puedes explorar las comunidades."
            action={
              <Link href="/descubrir" className={buttonVariants({ variant: "soft" })}>
                <Compass data-icon="inline-start" />
                Explorar comunidades
              </Link>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {results.communities.length > 0 ? (
            <section aria-labelledby="resultados-comunidades" className="flex flex-col gap-3">
              <h2 id="resultados-comunidades" className={sectionHeading}>
                Comunidades
              </h2>
              <ul className="mx-4 divide-y overflow-hidden rounded-3xl border bg-card md:mx-0">
                {results.communities.map((community) => (
                  <li key={community.id} className="flex items-center gap-3 p-3 pr-4">
                    <Link
                      href={`/c/${community.slug}` as Route}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl"
                    >
                      <CommunityAvatar
                        name={community.name}
                        emoji={community.emoji}
                        hue={community.hue}
                        decorative
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-heading text-base font-bold tracking-title">
                          {community.name}
                        </span>
                        <span className="line-clamp-1 text-sm text-muted-foreground">
                          {community.description}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {communitySignal({
                            memberCount: community.memberCount,
                            postCount: newCommunityPosts?.get(community.id) ?? 0,
                          })}
                        </span>
                      </span>
                    </Link>
                    {/* El botón se ve compacto (28 px); su ::after estira el área táctil a 44 px. */}
                    <span className="contents [&>*]:relative [&>*]:after:absolute [&>*]:after:-inset-2">
                      <JoinButton
                        communityId={community.id}
                        communityName={community.name}
                        communitySlug={community.slug}
                        initialJoined={joined?.has(community.id) ?? false}
                        isSignedIn={Boolean(viewer)}
                        size="sm"
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {results.products.length > 0 ? (
            <section aria-labelledby="resultados-productos" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-4 px-4 md:px-0">
                <h2 id="resultados-productos" className="text-lg font-extrabold">
                  Productos
                </h2>
                {results.products.length === SEARCH_LIMITS.products ? (
                  <Link
                    href={`/comprar?q=${encodeURIComponent(query.text)}` as Route}
                    className="text-sm font-bold text-primary-text underline-offset-4 hover:underline"
                  >
                    Ver más en Comprar
                  </Link>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:px-0">
                {results.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ) : null}

          {results.posts.length > 0 ? (
            <section aria-labelledby="resultados-publicaciones" className="flex flex-col gap-3">
              <h2 id="resultados-publicaciones" className={sectionHeading}>
                Publicaciones
              </h2>
              <div className="flex flex-col md:gap-4">
                {results.posts.map((post, index) => (
                  <PostCard key={post.id} post={post} index={index} isSignedIn={Boolean(viewer)} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
