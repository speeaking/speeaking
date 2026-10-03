import { headers } from "next/headers";
import { NONCE_HEADER } from "@/lib/csp";

/** JSON público seguro incluso cuando el nombre o la descripción procede de un usuario. */
export async function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}) {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
