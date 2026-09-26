import type { AdCopy } from "../tasks/ad-copy";
import { type AdKitProduct, factLines, PRICE_TOKEN } from "./facts";
import { priceLabel } from "./guard";

export const AD_KIT_CHANNELS = ["whatsapp", "facebook", "instagram", "headline"] as const;
export type AdKitChannel = (typeof AD_KIT_CHANNELS)[number];

/** Una variante lista para copiar. DTO para el navegador: solo textos y ligas públicas. */
export type AdKitVariant = {
  channel: AdKitChannel;
  title: string;
  /** Texto completo para copiar (con precio vigente, datos del producto y liga, según el canal). */
  text: string;
  /** Solo Instagram. */
  hashtags: string[];
  /** Liga del producto con atribución (`ref=compartir`, `canal`). */
  shareUrl: string;
};

const TITLES: Record<AdKitChannel, string> = {
  whatsapp: "Mensaje de WhatsApp",
  facebook: "Publicación de Facebook",
  instagram: "Pie de foto de Instagram",
  headline: "Titular corto",
};

/** Liga pública del producto con atribución por canal (P1, P5). */
export function productShareUrl(appUrl: string, slug: string, channel: AdKitChannel) {
  const url = new URL(`/producto/${encodeURIComponent(slug)}`, appUrl);
  url.searchParams.set("ref", "compartir");
  url.searchParams.set("canal", channel);
  return url.toString();
}

/**
 * Arma las 4 variantes a partir de los textos guardados (ya revisados por el guardián) y los datos
 * VIGENTES del producto: el precio sustituye a `[PRECIO]`, las frases de datos las pone el código
 * (P4) y la liga lleva la atribución del canal. Así un kit guardado nunca muestra un precio viejo.
 */
export function composeAdKit(copy: AdCopy, product: AdKitProduct, appUrl: string): AdKitVariant[] {
  const price = priceLabel(product);
  const fill = (text: string) => text.split(PRICE_TOKEN).join(price).trim();
  const facts = factLines(product).join(" · ");
  const url = (channel: AdKitChannel) => productShareUrl(appUrl, product.slug, channel);
  const hashtags = copy.instagram.hashtags.map((tag) => `#${tag}`);

  const variants: Record<AdKitChannel, string> = {
    whatsapp: [fill(copy.whatsapp), facts, url("whatsapp")].filter(Boolean).join("\n\n"),
    facebook: [fill(copy.facebook), facts, url("facebook")].filter(Boolean).join("\n\n"),
    // Instagram no abre ligas en el pie de foto: la liga se copia aparte (para el perfil).
    instagram: [fill(copy.instagram.caption), facts, hashtags.join(" ")]
      .filter(Boolean)
      .join("\n\n"),
    headline: fill(copy.headline),
  };

  return AD_KIT_CHANNELS.map((channel) => ({
    channel,
    title: TITLES[channel],
    text: variants[channel],
    hashtags: channel === "instagram" ? hashtags : [],
    shareUrl: url(channel),
  }));
}
