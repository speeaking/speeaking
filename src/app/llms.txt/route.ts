import { indexingEnabled } from "@/app/seo";
import { env } from "@/server/env";
import { SIMULATED_PAYMENT_PROVIDER } from "@/server/providers/payments/policy";
import { llmsText } from "@/server/seo/llms";
import { llmsData } from "@/server/seo/sitemaps";

// Como robots.txt y los sitemaps: lee ALLOW_INDEXING y los datos vigentes en cada petición.
export const dynamic = "force-dynamic";

/** `llms.txt`: speeaking para asistentes de IA (ver `server/seo/llms.ts`). */
export async function GET() {
  if (!indexingEnabled(env)) return new Response(null, { status: 404 });
  const text = llmsText({
    ...(await llmsData()),
    simulatedPayments: env.PAYMENT_PROVIDER === SIMULATED_PAYMENT_PROVIDER,
  });
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
