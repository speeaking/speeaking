import type { Metadata } from "next";
import { SellWithAi } from "@/modules/ai/components/sell-with-ai";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Vende con IA" };

export default async function SellWithAiPage() {
  await requireOnboardedViewer("/studio/vende-con-ia");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="sr-only">Vende con IA</h1>
      <SellWithAi />
    </div>
  );
}
