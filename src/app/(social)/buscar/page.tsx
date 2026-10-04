import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Compass,
  Search,
  SearchX,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Form from "next/form";
import { headers } from "next/headers";
import Link from "next/link";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { track } from "@/modules/analytics/track";
import { ProductCard } from "@/modules/catalog/components/product-card";
import { communitySignal } from "@/modules/identity/community-signal";
import { countPostsOfNewCommunities } from "@/modules/identity/service";
import { getJoinedCommunityIds, getViewer } from "@/modules/identity/session";
import { ContactList } from "@/modules/relationships/components/contact-list";
import { parseSearchQuery, SEARCH_MAX_LENGTH } from "@/modules/search/normalize";
import { searchEverything } from "@/modules/search/queries";
import {
  parseSearchPage,
  parseSearchScope,
  SEARCH_MAX_PAGES,
  SEARCH_SCOPES,
  searchHref,
  type SearchScope,
} from "@/modules/search/scopes";
import { JoinButton } from "@/modules/social/components/join-button";
import { PostCard } from "@/modules/social/components/post-card";
import { checkSocialLimit } from "@/modules/social/limits";

export const metadata: Metadata = {
  title: "Buscar personas y contenido",
  robots: { index: false },
};

function SectionHeading({
  id,
  title,
  scope,
  query,
  more,
}: {
  id: string;
  title: string;
  scope: SearchScope;
  query: string;
  more: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 md:px-0">
      <h2 id={id} className="text-lg font-extrabold">
        {title}
      </h2>
      {more ? (
        <Link
          href={searchHref(query, scope)}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-primary-text hover:underline"
        >
          Ver más
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/buscar">) {
  const { q, tipo, pagina } = await searchParams;
  const query = parseSearchQuery(q);
  const scope = parseSearchScope(tipo);
  const page = scope === "todo" ? 0 : parseSearchPage(pagina);
  const label = SEARCH_SCOPES.find((item) => item.value === scope)!.label;
  const viewer = await getViewer();
  const isActionRerender = (await headers()).has("next-action");
  const limited = query
    ? await checkSocialLimit("search", viewer?.userId ?? null)
    : { ok: true as const };
  const results =
    query && limited.ok
      ? await searchEverything(query, viewer?.userId ?? null, { scope, page })
      : null;
  const [joined, newCommunityPosts] = results?.communities.length
    ? await Promise.all([getJoinedCommunityIds(), countPostsOfNewCommunities()])
    : ([new Set<string>(), new Map<string, number>()] as const);

  if (query && results && !isActionRerender) {
    track({
      type: "SEARCH",
      userId: viewer?.userId ?? null,
      surface: "DISCOVER",
      // Solo las búsquedas comerciales aportan texto al historial de intención de compra.
      query:
        scope === "productos" || (scope === "todo" && results.products.length > 0)
          ? query.text
          : undefined,
      metadata: {
        scope,
        people: results.people.length,
        communities: results.communities.length,
        products: results.products.length,
        posts: results.posts.length,
        videos: results.videos.length,
      },
    });
  }
  const found = results
    ? results.people.length +
      results.communities.length +
      results.products.length +
      results.posts.length +
      results.videos.length
    : 0;
  const more = scope !== "todo" && Boolean(results?.hasMore[scope]) && page < SEARCH_MAX_PAGES - 1;

  return (
    <div className="flex flex-col pb-8">
      <PageHeader
        title="Buscar"
        description={
          query
            ? `Resultados para “${query.text}”`
            : "Personas, comunidades y todo lo que se comparte en speeaking."
        }
        actions={
          <Link
            href="/buscar/foto"
            aria-label="Buscar productos con una foto"
            className={buttonVariants({
              variant: "outline",
              size: "icon-lg",
              className: "size-11",
            })}
          >
            <Camera />
          </Link>
        }
      />
      <div className="mb-3 flex items-center gap-2 px-4 md:hidden">
        <Link
          href="/"
          aria-label="Volver al inicio"
          className={buttonVariants({
            variant: "ghost",
            size: "icon-lg",
            className: "size-11 shrink-0",
          })}
        >
          <ArrowLeft />
        </Link>
        <Form
          action="/buscar"
          role="search"
          aria-label="Buscar en speeaking"
          className="relative flex min-w-0 flex-1 items-center"
        >
          <Search
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="busqueda" className="sr-only">
            Buscar personas, comunidades, publicaciones, videos o productos
          </label>
          <Input
            key={`${scope}:${query?.text ?? ""}`}
            id="busqueda"
            name="q"
            type="search"
            defaultValue={query?.text ?? ""}
            maxLength={SEARCH_MAX_LENGTH}
            placeholder="Nombre, @usuario o un tema"
            autoComplete="off"
            enterKeyHint="search"
            autoFocus={!query}
            className="h-11 rounded-full pl-9 text-base"
          />
          <input type="hidden" name="tipo" value={scope} />
        </Form>
      </div>
      <nav
        aria-label="Buscar en"
        className="sticky top-[117px] z-20 mb-5 scrollbar-none flex gap-2 overflow-x-auto border-b bg-background/95 px-4 pt-1 pb-3 backdrop-blur-lg md:top-16 md:px-0"
      >
        {SEARCH_SCOPES.map((item) => (
          <Link
            key={item.value}
            href={searchHref(query?.text ?? "", item.value)}
            aria-current={scope === item.value ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
              scope === item.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {!limited.ok ? (
        <p role="alert" className="mx-4 rounded-2xl border bg-card p-4 text-sm md:mx-0">
          {limited.error}
        </p>
      ) : !query || !results ? (
        <div className="px-4 md:px-0">
          <EmptyState
            icon={Search}
            title={scope === "todo" ? "¿A quién o qué buscas?" : `Buscar en ${label.toLowerCase()}`}
            description={
              scope === "personas"
                ? "Escribe el nombre o @usuario de la persona que quieres encontrar."
                : "Escribe un nombre o tema y elige una categoría. También puedes encontrar a alguien por su @usuario."
            }
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
            description={
              scope === "todo"
                ? "Revisa cómo está escrito o prueba con otra palabra. Para personas, puedes usar su nombre o @usuario."
                : `No encontramos coincidencias en ${label.toLowerCase()}${page ? " en esta página" : ""}. Prueba otra categoría o cambia la búsqueda.`
            }
            action={
              scope !== "todo" ? (
                <Link
                  href={searchHref(query.text, "todo")}
                  className={buttonVariants({ variant: "soft" })}
                >
                  Buscar en todo
                </Link>
              ) : (
                <Link href="/descubrir" className={buttonVariants({ variant: "soft" })}>
                  <Compass data-icon="inline-start" />
                  Explorar comunidades
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {results.people.length > 0 ? (
            <section aria-labelledby="resultados-personas" className="flex flex-col gap-3">
              <SectionHeading
                id="resultados-personas"
                title="Personas"
                scope="personas"
                query={query.text}
                more={scope === "todo" && Boolean(results.hasMore.personas)}
              />
              <div className="px-4 md:px-0">
                <ContactList people={results.people} showFollow isSignedIn={Boolean(viewer)} />
              </div>
            </section>
          ) : null}
          {results.communities.length > 0 ? (
            <section aria-labelledby="resultados-comunidades" className="flex flex-col gap-3">
              <SectionHeading
                id="resultados-comunidades"
                title="Comunidades"
                scope="comunidades"
                query={query.text}
                more={scope === "todo" && Boolean(results.hasMore.comunidades)}
              />
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
                            postCount: newCommunityPosts.get(community.id) ?? 0,
                          })}
                        </span>
                      </span>
                    </Link>
                    <span className="contents [&>*]:relative [&>*]:after:absolute [&>*]:after:-inset-2">
                      <JoinButton
                        communityId={community.id}
                        communityName={community.name}
                        communitySlug={community.slug}
                        initialJoined={joined.has(community.id)}
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
              <SectionHeading
                id="resultados-productos"
                title="Productos"
                scope="productos"
                query={query.text}
                more={scope === "todo" && Boolean(results.hasMore.productos)}
              />
              <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:px-0">
                {results.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ) : null}
          {results.posts.length > 0 ? (
            <section aria-labelledby="resultados-publicaciones" className="flex flex-col gap-3">
              <SectionHeading
                id="resultados-publicaciones"
                title="Publicaciones"
                scope="publicaciones"
                query={query.text}
                more={scope === "todo" && Boolean(results.hasMore.publicaciones)}
              />
              <div className="flex flex-col md:gap-4">
                {results.posts.map((post, index) => (
                  <PostCard key={post.id} post={post} index={index} isSignedIn={Boolean(viewer)} />
                ))}
              </div>
            </section>
          ) : null}
          {results.videos.length > 0 ? (
            <section aria-labelledby="resultados-videos" className="flex flex-col gap-3">
              <SectionHeading
                id="resultados-videos"
                title="Videos"
                scope="videos"
                query={query.text}
                more={false}
              />
              <div className="flex flex-col gap-4">
                {results.videos.map((post, index) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    index={index}
                    reel
                    isSignedIn={Boolean(viewer)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
      {query && results && scope !== "todo" && (page > 0 || more) ? (
        <nav
          aria-label="Páginas de resultados"
          className="mt-6 flex items-center justify-between gap-3 px-4 md:px-0"
        >
          <span>
            {page > 0 ? (
              <Link
                href={searchHref(query.text, scope, page - 1)}
                className={buttonVariants({ variant: "outline", className: "min-h-11" })}
              >
                <ChevronLeft />
                Anterior
              </Link>
            ) : null}
          </span>
          <span className="text-sm text-muted-foreground">Página {page + 1}</span>
          <span>
            {more ? (
              <Link
                href={searchHref(query.text, scope, page + 1)}
                className={buttonVariants({ variant: "outline", className: "min-h-11" })}
              >
                Siguiente
                <ChevronRight />
              </Link>
            ) : null}
          </span>
        </nav>
      ) : null}
    </div>
  );
}
