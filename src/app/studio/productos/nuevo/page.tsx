import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProductForm } from "@/modules/catalog/components/product-form";
import { listCategories } from "@/modules/catalog/queries";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { listCommunities } from "@/modules/identity/service";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { getProposalDefaults } from "@/modules/ai/proposal-defaults";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage({
  searchParams,
}: PageProps<"/studio/productos/nuevo">) {
  const viewer = await requireOnboardedViewer("/studio/productos/nuevo");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;

  const { propuesta } = await searchParams;
  const [categories, communities, seller, proposalDefaults] = await Promise.all([
    listCategories(),
    listCommunities(),
    db.sellerProfile.findUnique({
      where: { id: viewer.sellerProfileId },
      select: { city: true, state: true },
    }),
    typeof propuesta === "string" ? getProposalDefaults(propuesta, viewer.userId) : null,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Nuevo producto"
        description={
          proposalDefaults
            ? "Prellenado con tu propuesta de IA: revisa y ajusta lo que quieras."
            : undefined
        }
        className="px-0 pt-0"
      />
      <ProductForm
        categories={categories}
        communities={communities}
        defaults={{
          city: seller?.city ?? undefined,
          state: seller?.state ?? undefined,
          ...proposalDefaults,
        }}
      />
    </div>
  );
}
