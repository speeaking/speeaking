import type { MetadataRoute } from "next";
import { APP_ICON_VERSION, APP_LAUNCH_BACKGROUND } from "@/config/app-brand";
import { siteConfig } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    lang: siteConfig.locale,
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    background_color: APP_LAUNCH_BACKGROUND,
    theme_color: APP_LAUNCH_BACKGROUND,
    icons: [
      {
        src: `/icons/icon-192.png?v=${APP_ICON_VERSION}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-512.png?v=${APP_ICON_VERSION}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icons/icon-maskable-512.png?v=${APP_ICON_VERSION}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
