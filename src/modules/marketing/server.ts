import "server-only";
import { env } from "@/server/env";
import { tiktokPixelId } from "./ad-pixel";

/** El pixel de TikTok configurado en este despliegue (ADR-072), o `null`. */
export function configuredTikTokPixel() {
  return tiktokPixelId({
    TIKTOK_PIXEL_ID: env.TIKTOK_PIXEL_ID,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
