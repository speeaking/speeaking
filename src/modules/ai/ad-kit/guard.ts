import { formatMoney } from "@/lib/format";
import {
  ALL_CLAIMS,
  type ClaimKind,
  createCleaner,
  type GuardFinding,
  moneyAmountsCents,
  percentsIn,
  type TextRules,
} from "../output-guard";
import { normalizeText } from "../personal-data";
import { AD_COPY_LIMITS, type AdCopy } from "../tasks/ad-copy";
import {
  type AdKitProduct,
  allowedCentsFor,
  allowedClaimsFor,
  allowedDaysFor,
  PRICE_TOKEN,
} from "./facts";

export type GuardedAdCopy = { copy: AdCopy; removed: number; findings: GuardFinding[] };

/** Raíces de etiqueta (sin espacios ni acentos) que son afirmaciones, urgencia o contacto. */
const HASHTAG_RULES: { pattern: RegExp; claim?: ClaimKind }[] = [
  { pattern: /original|autentic|genuin/u, claim: "authenticity" },
  { pattern: /garantia/u, claim: "warranty" },
  { pattern: /envios?gratis|gratisenvio/u, claim: "free_shipping" },
  { pattern: /envio|enviamos|paqueteria/u, claim: "national_shipping" },
  { pattern: /adomicilio|entregalocal/u, claim: "local_delivery" },
  { pattern: /devolucion|reembolso/u, claim: "returns" },
  // Nunca respaldadas por un dato: promociones, financiamiento, urgencia, sellado o factura.
  {
    pattern:
      /descuento|oferta|promo|rebaja|remate|msi|sinintereses|2x1|3x2|ultimas|agota|urgente|solohoy|hoymismo|limitad|factura|sellad|certificad|clabe|whats|wame|telefono|cel\d/u,
  },
];

const MAX_HASHTAG_LENGTH = 30;

function hashtagWord(raw: string) {
  return normalizeText(raw)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, "");
}

/** Etiquetas limpias: sin #, sin repetir, sin afirmaciones que el producto no respalda. */
function cleanHashtags(tags: string[], allowed: ReadonlySet<ClaimKind>) {
  const kept: string[] = [];
  let removed = 0;
  for (const raw of tags) {
    const word = hashtagWord(raw);
    const blocked =
      word.length < 2 ||
      word.length > MAX_HASHTAG_LENGTH ||
      /\d{8,}/u.test(word) ||
      HASHTAG_RULES.some(
        ({ pattern, claim }) => pattern.test(word) && !(claim && allowed.has(claim)),
      );
    if (blocked) removed++;
    else if (!kept.includes(word)) kept.push(word);
  }
  return { hashtags: kept.slice(0, AD_COPY_LIMITS.hashtags), removed };
}

/** El precio escrito tal cual se vuelve `[PRECIO]`, para mostrar siempre el precio vigente. */
function tokenizePrice(text: string, priceCents: number) {
  return text.replace(
    /\$\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?|\b(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\s?(?:pesos|mxn)\b/giu,
    (match) => (moneyAmountsCents(match)[0] === priceCents ? PRICE_TOKEN : match),
  );
}

function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).trimEnd()}…`;
}

/**
 * Guardián del kit de anuncios (SEC-28 aplicado a los textos que se comparten afuera): quita frases
 * con contacto o pago, urgencia, afirmaciones que los datos del producto no respaldan (P4) y cifras
 * distintas del precio, el envío o los días confirmados (P2). Si un texto se queda vacío, usa uno
 * determinista con el nombre y el precio.
 */
export function guardAdCopy(copy: AdCopy, product: AdKitProduct): GuardedAdCopy {
  const allowedClaims = allowedClaimsFor(product);
  const rules: TextRules = {
    productName: product.title,
    allowedCents: allowedCentsFor(product),
    // Nunca «quedan N piezas»: el inventario cambia y el anuncio no.
    quantity: null,
    claimKinds: ALL_CLAIMS,
    allowedClaims,
    allowedDays: allowedDaysFor(product),
    // «100 % algodón» en la descripción del vendedor se puede repetir; un «ahorra 30 %», no.
    allowedPercents: percentsIn(product.title, product.description, product.tags.join(" ")),
  };
  const cleaner = createCleaner();
  const name = product.title;
  const price = (text: string) => tokenizePrice(text, product.priceCents);
  const tags = cleanHashtags(copy.instagram.hashtags, allowedClaims);

  const guarded: AdCopy = {
    whatsapp: clip(
      price(
        cleaner.text(
          copy.whatsapp,
          `¡Hola! Tengo ${name} a ${PRICE_TOKEN}. Si te interesa, respóndeme por aquí.`,
          rules,
          10,
        ),
      ),
      AD_COPY_LIMITS.whatsapp,
    ),
    facebook: clip(
      price(
        cleaner.text(
          copy.facebook,
          `${name} a ${PRICE_TOKEN}. Pregúntame lo que quieras.`,
          rules,
          10,
        ),
      ),
      AD_COPY_LIMITS.facebook,
    ),
    instagram: {
      caption: clip(
        price(cleaner.text(copy.instagram.caption, `${name} a ${PRICE_TOKEN}.`, rules, 10)),
        AD_COPY_LIMITS.instagram,
      ),
      hashtags: tags.hashtags,
    },
    headline: clip(
      price(
        cleaner.text(
          copy.headline,
          `${name} a ${PRICE_TOKEN}`.length <= AD_COPY_LIMITS.headline
            ? `${name} a ${PRICE_TOKEN}`
            : name,
          rules,
          3,
        ),
      ),
      AD_COPY_LIMITS.headline,
    ),
  };
  const result = cleaner.result();
  const findings = new Set(result.findings);
  if (tags.removed > 0) findings.add("claim");
  return {
    copy: guarded,
    removed: result.removed + tags.removed,
    findings: [...findings],
  };
}

/** Precio con formato de la moneda del producto (lo que reemplaza a `[PRECIO]`). */
export function priceLabel(product: Pick<AdKitProduct, "priceCents" | "currency">) {
  return formatMoney(product.priceCents, product.currency);
}
