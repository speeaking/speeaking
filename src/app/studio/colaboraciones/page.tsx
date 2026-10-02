import { Handshake } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { siteConfig } from "@/config/site";
import { StoreCollaborationList } from "@/modules/creators/components/collaboration-list";
import { CollaborationToggle } from "@/modules/creators/components/collaboration-toggle";
import { PostMetricsList } from "@/modules/creators/components/post-metrics";
import { totalMetrics } from "@/modules/creators/metrics";
import { getAcceptsCollaborations, listStoreCollaborations } from "@/modules/creators/service";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Colaboraciones" };

/**
 * Studio → Colaboraciones (ADR-063): la tienda decide si otras personas pueden etiquetar sus
 * productos, ve qué logró cada publicación (visitas, pruebas, carritos y pedidos) y puede quitar la
 * etiqueta de cualquiera. Sin dinero de por medio: los acuerdos son entre la tienda y quien publica.
 */
export default async function StudioCollaborationsPage() {
  const viewer = await requireOnboardedViewer("/studio/colaboraciones");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;
  const [enabled, posts] = await Promise.all([
    getAcceptsCollaborations(viewer.userId),
    listStoreCollaborations(viewer.userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Colaboraciones"
        description="Deja que otras personas recomienden tus productos en sus fotos y videos, y mira qué logra cada publicación."
        className="px-0 pt-0"
      />

      <section
        aria-labelledby="colaboraciones-ajuste"
        className="flex flex-col gap-4 rounded-3xl border bg-card p-4"
      >
        <h2 id="colaboraciones-ajuste" className="font-heading text-lg font-bold">
          Tu tienda
        </h2>
        <CollaborationToggle enabled={enabled ?? false} />
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
          <li>Tú decides: puedes quitar la etiqueta de cualquier publicación.</li>
          <li>
            Las pruebas de «Ver cómo me veo» que lleguen de esas publicaciones se pagan como
            siempre: con tu saldo hasta tu tope diario, o con tus pruebas de cortesía.
          </li>
          <li>
            Si le das algo a alguien por publicar (pago, producto o comisión), la publicación debe
            decir «Colaboración». Puedes marcarla desde aquí.
          </li>
          <li>
            {siteConfig.name} todavía no cobra ni reparte comisiones: cualquier acuerdo es entre tú
            y quien publica.
          </li>
        </ul>
        <Link
          href={"/creadores" as Route}
          className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary-text underline-offset-2 hover:underline md:min-h-0"
        >
          Ver cómo lo ve quien recomienda (sección Creadores)
        </Link>
      </section>

      <section aria-labelledby="colaboraciones-lista" className="flex flex-col gap-3">
        <h2 id="colaboraciones-lista" className="font-heading text-lg font-bold">
          Publicaciones que etiquetan tus productos
        </h2>
        {posts.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="Todavía nadie etiqueta tus productos"
            description={
              enabled
                ? "Cuando alguien publique una foto o un video con uno de tus productos, aquí verás qué logró."
                : "Activa las colaboraciones para que otras personas puedan recomendar tus productos."
            }
          />
        ) : (
          <>
            <PostMetricsList
              metrics={totalMetrics(posts.map((post) => post.metrics))}
              label="Total de las publicaciones que etiquetan tus productos"
            />
            <StoreCollaborationList posts={posts} />
          </>
        )}
      </section>
    </div>
  );
}
