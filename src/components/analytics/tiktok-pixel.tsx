"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { loadTikTokPixel, trackTikTokPage } from "@/lib/tiktok-pixel";

/**
 * Carga el pixel de TikTok y registra una vista de página por ruta. Lo monta el layout raíz solo
 * cuando `TIKTOK_PIXEL_ID` está configurado.
 */
export function TikTokPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    loadTikTokPixel(pixelId);
    trackTikTokPage();
  }, [pixelId, pathname]);

  return null;
}
