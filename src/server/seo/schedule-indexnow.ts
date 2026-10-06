import "server-only";
import { after } from "next/server";
import { absoluteUrl } from "@/app/seo";
import { env } from "@/server/env";
import { notifyIndexNow } from "./indexnow";

/** Después de responder, avisa por IndexNow que estas páginas (rutas propias) cambiaron. */
export function scheduleIndexNow(paths: readonly string[]) {
  after(async () => {
    await notifyIndexNow(paths.map(absoluteUrl), { env });
  });
}
