import { LockKeyhole, Search, Users, UserRoundPlus } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { pageMetadata } from "@/app/seo";
import { buttonVariants } from "@/components/ui/button";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { ContactList } from "@/modules/relationships/components/contact-list";
import { findPeople, listContacts, peopleCounts } from "@/modules/relationships/queries";
import type { PeopleTab } from "@/modules/relationships/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: "Mis personas",
  description: "Tus amigos, solicitudes y contactos en speeaking.",
  path: "/personas",
  noIndex: true,
});
const tabs: { id: PeopleTab; label: string }[] = [
  { id: "amigos", label: "Amigos" },
  { id: "solicitudes", label: "Solicitudes" },
  { id: "enviadas", label: "Enviadas" },
  { id: "seguidores", label: "Seguidores" },
  { id: "siguiendo", label: "Siguiendo" },
  { id: "compradores", label: "Compradores" },
];
const empty: Record<PeopleTab, [string, string]> = {
  amigos: [
    "Tu círculo empieza aquí",
    "Busca a alguien y envíale una solicitud. Serán amigos cuando la acepte.",
  ],
  solicitudes: [
    "No tienes solicitudes pendientes",
    "Aquí podrás aceptar o rechazar las invitaciones de otras personas.",
  ],
  enviadas: [
    "No has enviado solicitudes",
    "Puedes agregar amigos desde su perfil o buscarlos arriba.",
  ],
  seguidores: [
    "Aún no tienes seguidores",
    "Las personas que te sigan aparecerán aquí. Seguirte no les permite ver tu contenido personal.",
  ],
  siguiendo: [
    "Todavía no sigues a nadie",
    "Sigue perfiles y tiendas para estar al tanto de sus productos públicos.",
  ],
  compradores: [
    "Todavía no tienes compradores",
    "Aquí aparecerán quienes hayan realizado una compra pagada en tu tienda. Esta lista solo la ves tú.",
  ],
};

export default async function PeoplePage({ searchParams }: PageProps<"/personas">) {
  const viewer = await requireOnboardedViewer("/personas");
  const params = await searchParams;
  const tab = tabs.some((item) => item.id === params.ver) ? (params.ver as PeopleTab) : "amigos";
  const pageValue = typeof params.pagina === "string" ? Number(params.pagina) : 1;
  const page =
    Number.isSafeInteger(pageValue) && pageValue > 0 && pageValue <= 100000 ? pageValue - 1 : 0;
  const query = typeof params.q === "string" ? params.q.trim().replace(/^@/, "").slice(0, 80) : "";
  const [counts, list, found] = await Promise.all([
    peopleCounts(viewer.userId, viewer.sellerProfileId),
    listContacts(viewer.userId, viewer.sellerProfileId, tab, page),
    findPeople(viewer.userId, query),
  ]);
  const href = (index: number) =>
    `/personas?${new URLSearchParams({ ver: tab, pagina: String(index + 1) })}` as Route;
  return (
    <div className="flex flex-col gap-6 px-4 py-5 md:px-0">
      <header className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-primary-text">
          <Users className="size-4" aria-hidden="true" /> Tu círculo
        </span>
        <h1 className="font-heading text-3xl font-extrabold tracking-heading">Mis personas</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Amigos, seguidores y las personas que conectan contigo.
        </p>
      </header>
      <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4 text-sm">
        <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden="true" />
        <p>
          Tu biografía, portada, fotos, videos y publicaciones personales son{" "}
          <strong>solo para amigos aceptados</strong>. Tus publicaciones con productos son públicas.
        </p>
      </div>
      <form action="/personas" className="flex gap-2" role="search" aria-label="Buscar personas">
        <input type="hidden" name="ver" value={tab} />
        <label htmlFor="buscar-personas" className="sr-only">
          Nombre o usuario
        </label>
        <input
          id="buscar-personas"
          name="q"
          defaultValue={query}
          maxLength={80}
          placeholder="Busca por nombre o @usuario"
          className="h-11 min-w-0 flex-1 rounded-xl border bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button className={buttonVariants({ variant: "secondary" })} type="submit">
          <Search className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Buscar</span>
        </button>
      </form>
      {query ? (
        <section aria-labelledby="resultados-personas" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="resultados-personas" className="font-semibold">
              Resultados para «{query}»
            </h2>
            <Link
              href={`/personas?ver=${tab}` as Route}
              className="text-sm text-primary-text hover:underline"
            >
              Limpiar búsqueda
            </Link>
          </div>
          {found.length ? (
            <ContactList people={found} />
          ) : (
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">
              No encontramos personas con ese nombre o usuario.
            </p>
          )}
        </section>
      ) : null}
      <nav aria-label="Tus contactos" className="flex gap-1 overflow-x-auto border-b pb-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/personas?ver=${item.id}` as Route}
            aria-current={item.id === tab ? "page" : undefined}
            className={cn(
              "flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold",
              item.id === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {item.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                item.id === tab ? "bg-primary-foreground/15" : "bg-secondary",
              )}
            >
              {counts[item.id]}
            </span>
          </Link>
        ))}
      </nav>
      {list.people.length ? (
        <ContactList
          people={list.people}
          showFollow={tab === "seguidores" || tab === "siguiendo"}
        />
      ) : (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-5 py-10 text-center">
          <UserRoundPlus className="mb-1 size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-heading text-lg font-bold">
            {tab === "compradores" && !viewer.sellerProfileId
              ? "Tus futuros compradores"
              : empty[tab][0]}
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {tab === "compradores" && !viewer.sellerProfileId
              ? "Cuando abras una tienda, aquí podrás ver a tus compradores. Comprar no crea una amistad automáticamente."
              : empty[tab][1]}
          </p>
          {tab === "compradores" ? (
            <Link href="/studio" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              {viewer.sellerProfileId ? "Ver mi tienda" : "Abrir mi tienda"}
            </Link>
          ) : null}
        </section>
      )}
      {page > 0 || list.hasMore ? (
        <nav aria-label="Páginas de contactos" className="flex justify-between gap-3">
          {page > 0 ? (
            <Link href={href(page - 1)} className={buttonVariants({ variant: "outline" })}>
              Anterior
            </Link>
          ) : (
            <span />
          )}
          {list.hasMore ? (
            <Link href={href(page + 1)} className={buttonVariants({ variant: "outline" })}>
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
