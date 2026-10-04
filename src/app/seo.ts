import type { Metadata, MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { PROTECTED_PREFIXES } from "@/modules/identity/constants";
import type { ServerEnv } from "@/server/env-schema";

type IndexingEnv = Pick<ServerEnv, "APP_URL" | "ALLOW_INDEXING">;

export const PUBLIC_PAGES = [
  "/",
  "/descubrir",
  "/comprar",
  "/creadores",
  "/precios",
  "/seguridad",
  "/apoya",
  "/como-funciona",
  "/preguntas-frecuentes",
] as const;

// La terminación evita que /crear bloquee también /creadores. Las áreas privadas
// mantienen su autorización en el servidor: robots.txt no es una barrera de acceso.
export const CRAWL_DISALLOW = [
  "/api/",
  ...PROTECTED_PREFIXES.flatMap((path) => [`${path}$`, `${path}/`]),
  "/avisos",
  "/saldo",
  "/probar",
  "/look/",
  "/personas",
  "/buscar/foto",
] as const;

export function indexingEnabled(env: IndexingEnv): boolean {
  const host = new URL(env.APP_URL).hostname;
  return (
    env.ALLOW_INDEXING &&
    host !== "localhost" &&
    host !== "127.0.0.1" &&
    host !== "[::1]" &&
    !host.endsWith(".vercel.app") &&
    process.env.VERCEL_ENV !== "preview"
  );
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteConfig.url).href;
}

export function snippet(text: string, limit = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1).trimEnd()}…` : clean;
}

export const NO_INDEX: Metadata["robots"] = { index: false, follow: true };

/** Canonical sin parámetros y objetos completos: Next reemplaza openGraph, no lo mezcla. */
export function pageMetadata({
  title,
  description,
  path,
  image,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: { url: string; width?: number; height?: number; alt?: string };
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const images = image
    ? [{ ...image, url: absoluteUrl(image.url) }]
    : [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: `${siteConfig.name}: ${siteConfig.tagline}`,
        },
      ];
  return {
    title,
    description: snippet(description),
    alternates: { canonical: url },
    ...(noIndex ? { robots: NO_INDEX } : {}),
    openGraph: {
      title,
      description: snippet(description),
      url,
      type: "website",
      siteName: siteConfig.name,
      locale: "es_MX",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: snippet(description),
      images,
    },
  };
}

export function rootMetadata(env: IndexingEnv): Metadata {
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: "speeaking · Compra, vende y pruébate ropa con IA",
      template: `%s · ${siteConfig.name}`,
    },
    description: siteConfig.description,
    applicationName: siteConfig.name,
    appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "default" },
    alternates: { canonical: "./" },
    openGraph: { type: "website", siteName: siteConfig.name, locale: "es_MX", url: "./" },
    twitter: { card: "summary_large_image" },
    verification: { google: siteConfig.googleSiteVerification },
    robots: indexingEnabled(env)
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : NO_INDEX,
  };
}

export function robotsFile(env: IndexingEnv): MetadataRoute.Robots {
  // Permisos de búsqueda de ChatGPT independientes de GPTBot (entrenamiento).
  const rules = { userAgent: ["*", "OAI-SearchBot"], allow: "/", disallow: [...CRAWL_DISALLOW] };
  return indexingEnabled(env) ? { rules, sitemap: absoluteUrl("/sitemap-index.xml") } : { rules };
}

export function sitemapEntries(env: IndexingEnv): MetadataRoute.Sitemap {
  if (!indexingEnabled(env)) return [];
  return PUBLIC_PAGES.map((path) => ({ url: absoluteUrl(path) }));
}
