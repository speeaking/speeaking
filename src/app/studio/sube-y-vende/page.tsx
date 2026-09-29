import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { SellWithAi } from "@/modules/ai/components/sell-with-ai";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: siteConfig.sellerFeatureName };

/** «Sube y vende» (ADR-041): foto + precio → publicación lista. */
export default async function SellWithAiPage() {
  await requireOnboardedViewer(siteConfig.sellerFeaturePath);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="sr-only">{siteConfig.sellerFeatureName}</h1>
      <SellWithAi />
    </div>
  );
}
