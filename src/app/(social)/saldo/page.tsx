import { Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Saldo", robots: { index: false } };

/**
 * El saldo es de las tiendas (ADR-046): quien compra no paga nada por probarse ropa ni por armar
 * looks. Con tienda, la página vive en el Studio; sin tienda, se explica y se ofrece activarla.
 */
export default async function WalletPage() {
  const viewer = await requireOnboardedViewer("/saldo");
  if (viewer.sellerProfileId) redirect("/studio/saldo");
  return (
    <>
      <PageHeader title="Saldo" />
      <div className="px-4 md:px-0">
        <EmptyState
          icon={Store}
          title="Para ti todo es gratis"
          description="Probarte ropa, armar looks y comprar no cuesta nada. El saldo lo usan las tiendas para pagar las pruebas y destacar sus productos."
          action={
            <Link href="/studio/sube-y-vende" className={buttonVariants({ variant: "outline" })}>
              Abrir mi tienda
            </Link>
          }
        />
      </div>
    </>
  );
}
