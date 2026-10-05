import { ArrowLeft, ArrowRight, Search, ShieldCheck, UsersRound } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/brand/user-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCount } from "@/lib/format";
import { UserManagement } from "@/modules/admin/components/user-management";
import { getAdminViewer, requireAdmin } from "@/modules/admin/guard";
import { adminUserFiltersSchema, type AdminUserFilters } from "@/modules/admin/user-schemas";
import { getAdminUserDirectory } from "@/modules/admin/user-service";

export async function generateMetadata(): Promise<Metadata> {
  return (await getAdminViewer())
    ? { title: "Usuarios", robots: { index: false, follow: false, nocache: true } }
    : {};
}

const dates = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeZone: "America/Mexico_City",
});
const selectClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const STATUS_LABEL = { active: "Activa", blocked: "Bloqueada", deleted: "Eliminada" } as const;

function pageHref(filters: AdminUserFilters, page: number): Route {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.status !== "all") query.set("status", filters.status);
  if (filters.type !== "all") query.set("type", filters.type);
  query.set("page", String(page));
  return `/admin/usuarios?${query}` as Route;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const first = (key: string) => (Array.isArray(query[key]) ? query[key][0] : query[key]);
  const filters = adminUserFiltersSchema.parse({
    q: first("q") ?? "",
    status: first("status"),
    type: first("type"),
    page: first("page"),
  });
  const directory = await getAdminUserDirectory(admin.userId, filters);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuarios"
        description="Encuentra una cuenta y administra su acceso a speeaking."
        className="px-0"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Cuentas registradas", directory.counts.total],
          ["Activas", directory.counts.active],
          ["Bloqueadas", directory.counts.blocked],
          ["Registros anonimizados", directory.counts.deleted],
        ].map(([label, count]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-semibold tabular-nums">
              {Number(count).toLocaleString("es-MX")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <form
        method="get"
        action="/admin/usuarios"
        className="grid gap-3 rounded-card border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_11rem_auto] lg:items-end"
      >
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <label htmlFor="admin-users-q" className="text-sm font-medium">
            Buscar usuario
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
            <Input
              id="admin-users-q"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Nombre, @usuario o correo"
              maxLength={100}
              className="h-11 pl-9"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-users-status" className="text-sm font-medium">
            Estado
          </label>
          <select
            id="admin-users-status"
            name="status"
            defaultValue={filters.status}
            className={selectClass}
          >
            <option value="all">Todos</option>
            <option value="active">Activas</option>
            <option value="blocked">Bloqueadas</option>
            <option value="deleted">Eliminadas</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-users-type" className="text-sm font-medium">
            Tipo de cuenta
          </label>
          <select
            id="admin-users-type"
            name="type"
            defaultValue={filters.type}
            className={selectClass}
          >
            <option value="all">Todas</option>
            <option value="people">Personas</option>
            <option value="sellers">Vendedores</option>
            <option value="admins">Administradores</option>
            <option value="editorial">Editoriales</option>
          </select>
        </div>
        <Button type="submit" className="h-11 px-5">
          Buscar
        </Button>
      </form>
      <section aria-labelledby="users-list-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="users-list-title" className="flex items-center gap-2 text-lg font-semibold">
            <UsersRound className="size-5" />
            {formatCount(directory.total, "cuenta encontrada", "cuentas encontradas")}
          </h2>
          <Link
            href="/admin/usuarios"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Limpiar filtros
          </Link>
        </div>
        {directory.users.length === 0 ? (
          <p className="rounded-card border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay cuentas que coincidan. Prueba con otro nombre o cambia los filtros.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-card border bg-card">
            {directory.users.map((user) => (
              <li key={user.id} className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <UserAvatar
                      name={user.displayName}
                      seed={user.id}
                      src={user.avatarUrl}
                      className="size-11"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold break-words">{user.displayName}</h3>
                        <Badge variant={user.status === "blocked" ? "destructive" : "outline"}>
                          {STATUS_LABEL[user.status]}
                        </Badge>
                        {user.role === "ADMIN" ? (
                          <Badge variant="secondary">
                            <ShieldCheck />
                            Admin
                          </Badge>
                        ) : null}
                        {user.isEditorial ? <Badge variant="secondary">Editorial</Badge> : null}
                        {user.isSeller ? <Badge variant="secondary">Vendedor</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm break-all text-muted-foreground">
                        {user.username ? `@${user.username} · ` : ""}
                        {user.email}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Alta: {dates.format(new Date(user.createdAt))}
                        {!user.onboarded && user.status !== "deleted" ? " · Perfil pendiente" : ""}
                        {user.emailVerified ? " · Correo verificado" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">
                    {user.username ? (
                      <Link
                        href={`/u/${user.username}` as Route}
                        className="inline-flex min-h-11 items-center px-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                      >
                        Ver perfil
                      </Link>
                    ) : null}
                    <UserManagement user={user} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatCount(user.posts, "publicación", "publicaciones")}</span>
                  <span>{formatCount(user.purchases, "compra", "compras")}</span>
                  {user.isSeller ? (
                    <>
                      <span>{formatCount(user.products, "producto", "productos")}</span>
                      <span>{formatCount(user.sales, "venta", "ventas")}</span>
                    </>
                  ) : null}
                </div>
                {user.blockedReason ? (
                  <p className="rounded-lg bg-destructive/5 px-3 py-2 text-sm break-words whitespace-pre-wrap">
                    <span className="font-medium">Motivo del bloqueo: </span>
                    {user.blockedReason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {directory.pages > 1 ? (
          <nav aria-label="Páginas de usuarios" className="flex items-center justify-between gap-3">
            <div>
              {directory.page > 1 ? (
                <Link
                  href={pageHref(filters, directory.page - 1)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3 text-sm"
                >
                  <ArrowLeft className="size-4" />
                  Anterior
                </Link>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              Página {directory.page} de {directory.pages}
            </span>
            <div>
              {directory.page < directory.pages ? (
                <Link
                  href={pageHref(filters, directory.page + 1)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3 text-sm"
                >
                  Siguiente
                  <ArrowRight className="size-4" />
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>
      <section aria-labelledby="users-history-title" className="flex flex-col gap-3">
        <h2 id="users-history-title" className="text-lg font-semibold">
          Acciones recientes
        </h2>
        {directory.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aquí aparecerán los bloqueos, desbloqueos y eliminaciones que realice el equipo.
          </p>
        ) : (
          <ul className="divide-y rounded-card border bg-card">
            {directory.history.map((entry) => (
              <li key={entry.id} className="p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-medium">{entry.title}</p>
                  <time dateTime={entry.createdAt} className="text-xs text-muted-foreground">
                    {dates.format(new Date(entry.createdAt))}
                  </time>
                </div>
                <p className="mt-1 text-xs break-words text-muted-foreground">
                  Por {entry.actorName}
                  {entry.targetUserId ? ` · Cuenta ${entry.targetUserId}` : ""}
                </p>
                {entry.reason ? (
                  <p className="mt-2 text-sm break-words whitespace-pre-wrap text-muted-foreground">
                    {entry.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
