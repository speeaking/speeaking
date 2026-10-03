import type { Metadata, Route } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { CONTENT_TABS, listOwnContent } from "@/modules/identity/content-queries";
import { RemoveContentButton } from "@/modules/identity/components/remove-content-button";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mi contenido" };

export default async function MyContentPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string | string[]; antes?: string | string[] }>;
}) {
  const viewer = await requireOnboardedViewer("/ajustes/contenido");
  const { tipo, antes } = await searchParams;
  const tab = CONTENT_TABS.find((item) => item.key === tipo)?.key ?? "publicaciones";
  const cursor = z.uuid().safeParse(antes);
  const { items, next } = await listOwnContent(
    viewer.userId,
    tab,
    cursor.success ? cursor.data : undefined,
  );
  return (
    <div className="flex flex-col gap-4 pb-8">
      <PageHeader
        title="Mi contenido"
        description="Administra tus publicaciones, comentarios, productos y compras."
      />
      <div className="px-4 md:px-0">
        <nav aria-label="Tipo de contenido" className="flex gap-2 overflow-x-auto pb-3">
          {CONTENT_TABS.map((item) => (
            <Link
              key={item.key}
              href={`/ajustes/contenido?tipo=${item.key}` as Route}
              aria-current={item.key === tab ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: item.key === tab ? "secondary" : "ghost" }),
                "shrink-0",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-3">
          {items.length ? (
            items.map((item) => (
              <article
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  {item.href ? (
                    <Link href={item.href} className="line-clamp-2 font-medium hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    <p className="line-clamp-2 font-medium">{item.title}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <RemoveContentButton
                  kind={item.kind}
                  id={item.id}
                  label={item.kind === "purchase" ? "Quitar del historial" : "Eliminar"}
                  description={item.description}
                />
              </article>
            ))
          ) : (
            <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
              No tienes {tab} que mostrar.
            </p>
          )}
          {next ? (
            <Link
              href={`/ajustes/contenido?tipo=${tab}&antes=${next}` as Route}
              className={buttonVariants({ variant: "outline" })}
            >
              Ver anteriores
            </Link>
          ) : null}
        </div>
        <section className="mt-6 flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <h2 className="font-heading text-lg font-semibold">Más controles de tu cuenta</h2>
          <div className="flex flex-wrap gap-2">
            <RemoveContentButton kind="saved" id="all" label="Vaciar guardados" />
            <RemoveContentButton kind="cart" id="all" label="Vaciar carrito" />
            <RemoveContentButton kind="notifications" id="all" label="Borrar avisos" />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-primary-text">
            <Link href="/mensajes">Mensajes</Link>
            <Link href="/ajustes">Búsquedas, gustos y fotos de prueba</Link>
            <Link href="/perfil/editar">Editar mi perfil</Link>
            <Link href="/ajustes#borrar-cuenta">Eliminar mi cuenta</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
