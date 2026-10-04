import type { Metadata, Route } from "next";
import Link from "next/link";
import Form from "next/form";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { NO_INDEX } from "@/app/seo";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { requireOnboardedViewer } from "@/modules/identity/session";
import {
  communityMemberPanel,
  communityMembersHref,
  type MemberTab,
} from "@/modules/communities/queries";
import { MemberManager } from "@/modules/communities/components/member-manager";
import { CommunityForm } from "@/modules/communities/components/community-form";
import { DeleteCommunityForm } from "@/modules/communities/components/delete-community-form";
import { getCommunity } from "../community";

export const metadata: Metadata = { title: "Miembros de la comunidad", robots: NO_INDEX };
export default async function CommunityMembersPage({
  params,
  searchParams,
}: PageProps<"/c/[slug]/miembros">) {
  const { slug } = await params;
  const community = await getCommunity(slug);
  if (!community) notFound();
  const viewer = await requireOnboardedViewer(`/c/${slug}/miembros`);
  const search = await searchParams;
  const tab: MemberTab =
    search.ver === "invitaciones" || search.ver === "retirados" ? search.ver : "miembros";
  const query = typeof search.q === "string" ? search.q.trim().slice(0, 80) : "";
  const parsedPage =
    typeof search.pagina === "string" && /^\d{1,3}$/.test(search.pagina)
      ? Number(search.pagina)
      : 1;
  const page = Math.max(0, Math.min(99, parsedPage - 1));
  const panel = await communityMemberPanel(community.id, viewer.userId, { tab, query, page });
  if (!panel) notFound();
  const tabs = panel.canManage
    ? (["miembros", "invitaciones", "retirados"] as const)
    : (["miembros"] as const);
  return (
    <>
      <PageHeader
        title={panel.canManage ? "Administrar comunidad" : "Miembros"}
        description={community.name}
        actions={
          <Link
            href={`/c/${slug}` as Route}
            aria-label="Volver a la comunidad"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "size-11")}
          >
            <ArrowLeft />
          </Link>
        }
      />
      <div className="flex flex-col gap-4 px-4 pb-6 md:px-0">
        {panel.canManage ? (
          <p className="text-sm text-muted-foreground">
            {panel.isOwner
              ? "Eres el propietario. Solo tú puedes nombrar administradores o transferir la propiedad."
              : "Como administrador puedes invitar y retirar miembros. El propietario gestiona los roles."}
          </p>
        ) : null}
        <nav
          aria-label="Miembros de la comunidad"
          className="scrollbar-none flex gap-2 overflow-x-auto"
        >
          {tabs.map((value) => (
            <Link
              key={value}
              href={communityMembersHref(slug, value, query) as Route}
              aria-current={tab === value ? "page" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold",
                tab === value
                  ? "border-primary bg-primary/10 text-primary-text"
                  : "bg-card text-muted-foreground",
              )}
            >
              {value === "miembros"
                ? "Miembros"
                : value === "invitaciones"
                  ? "Invitaciones"
                  : "Retirados"}
            </Link>
          ))}
        </nav>
        <Form action={`/c/${slug}/miembros`} className="flex gap-2">
          <input type="hidden" name="ver" value={tab} />
          <Input
            key={`${query}-${tab}`}
            name="q"
            defaultValue={query}
            maxLength={80}
            placeholder="Buscar por nombre o @usuario"
            aria-label="Buscar miembros"
            className="min-h-11 min-w-0 flex-1 bg-card"
          />
          <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>
            Buscar
          </button>
        </Form>
        <MemberManager
          communityId={community.id}
          viewerId={viewer.userId}
          people={panel.people}
          tab={tab}
          canManage={panel.canManage}
          isOwner={panel.isOwner}
        />
        {page > 0 || panel.hasMore ? (
          <nav aria-label="Páginas de miembros" className="flex items-center justify-between gap-3">
            {page > 0 ? (
              <Link
                href={communityMembersHref(slug, tab, query, page - 1) as Route}
                className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
              >
                <ChevronLeft />
                Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground">Página {page + 1}</span>
            {panel.hasMore && page < 99 ? (
              <Link
                href={communityMembersHref(slug, tab, query, page + 1) as Route}
                className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
              >
                Siguiente
                <ChevronRight />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
        {panel.isOwner ? (
          <details className="rounded-2xl border bg-card p-4">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">
              Editar nombre, descripción y apariencia
            </summary>
            <div className="pt-3">
              <CommunityForm initial={community} />
            </div>
          </details>
        ) : null}
        {panel.isOwner ? (
          <details className="rounded-2xl border bg-card p-4">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold text-destructive">
              Eliminar comunidad
            </summary>
            <div className="pt-3">
              <DeleteCommunityForm communityId={community.id} name={community.name} />
            </div>
          </details>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Ser miembro de una comunidad no concede acceso a las publicaciones personales de alguien
          que todavía no aceptó tu amistad.
        </p>
      </div>
    </>
  );
}
