import { absoluteUrl } from "@/app/seo";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format";
import { availableDeliveryMethods, orderShippingCents } from "@/modules/commerce/checkout-math";
import type { PublicProductDTO } from "./dto";
import type { ProductFacts } from "./quick-answers";

/**
 * Envío a todo México con la misma regla con que cobra el checkout (sin tarifa no hay envío), o
 * `null`. Solo lo que declaró el vendedor (P4): sin días declarados no hay tiempo de entrega.
 */
function nationalShipping(facts: ProductFacts) {
  if (!availableDeliveryMethods([facts]).includes("NATIONAL_SHIPPING")) return null;
  const { deliveryMinDays: min, deliveryMaxDays: max } = facts;
  return {
    cents: orderShippingCents("NATIONAL_SHIPPING", [facts]),
    days: min && max ? { min, max } : null,
  };
}

function sameWord(a: string, b: string) {
  const key = (text: string) =>
    text.normalize("NFD").replace(/\p{M}/gu, "").trim().toLocaleLowerCase(siteConfig.locale);
  return key(a) === key(b);
}

/** «Guadalajara, Jalisco»; «CDMX» una sola vez si la ciudad y el estado se llaman igual. */
export function placeLabel(city: string, state: string) {
  return sameWord(city, state) ? city.trim() : `${city.trim()}, ${state.trim()}`;
}

export function productStructuredData(product: PublicProductDTO) {
  const url = absoluteUrl(`/producto/${encodeURIComponent(product.slug)}`);
  const condition =
    product.condition === "NEW"
      ? "NewCondition"
      : product.condition === "REFURBISHED"
        ? "RefurbishedCondition"
        : "UsedCondition";
  const available = product.facts.status === "ACTIVE" && product.facts.stock > 0;
  const availability = available ? "InStock" : "OutOfStock";
  const shipping = nationalShipping(product.facts);
  const { returnWindowDays } = product.facts;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    url,
    name: product.title,
    description: product.description,
    category: product.category.name,
    image: product.media.map((image) => absoluteUrl(image.url)),
    offers: {
      "@type": "Offer",
      url,
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: product.currency,
      itemCondition: `https://schema.org/${condition}`,
      availability: `https://schema.org/${availability}`,
      // Ciudad y estado son públicos (la ficha los muestra); la dirección nunca.
      availableAtOrFrom: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: product.facts.city,
          addressRegion: product.facts.state,
          addressCountry: siteConfig.country,
        },
      },
      ...(shipping
        ? {
            shippingDetails: {
              "@type": "OfferShippingDetails",
              shippingRate: {
                "@type": "MonetaryAmount",
                value: (shipping.cents / 100).toFixed(2),
                currency: product.currency,
              },
              shippingDestination: {
                "@type": "DefinedRegion",
                addressCountry: siteConfig.country,
              },
              ...(shipping.days
                ? {
                    deliveryTime: {
                      "@type": "ShippingDeliveryTime",
                      transitTime: {
                        "@type": "QuantitativeValue",
                        minValue: shipping.days.min,
                        maxValue: shipping.days.max,
                        unitCode: "DAY",
                      },
                    },
                  }
                : {}),
            },
          }
        : {}),
      // Lo mismo que responde «¿Acepta devoluciones?»: N días o no acepta.
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: siteConfig.country,
        ...(returnWindowDays > 0
          ? {
              returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: returnWindowDays,
            }
          : { returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted" }),
      },
      seller: {
        "@type": "Organization",
        name: product.seller.displayName,
        ...(product.seller.username
          ? { url: absoluteUrl(`/u/${encodeURIComponent(product.seller.username)}`) }
          : {}),
      },
    },
  };
}

/** «Vela personalizada · $110 · Envío a todo México»: lo que más se busca va en el título. */
export function productSeoTitle(product: PublicProductDTO) {
  const title = `${product.title} · ${formatMoney(product.priceCents, product.currency)}`;
  return nationalShipping(product.facts) ? `${title} · Envío a todo México` : title;
}

/**
 * Descripción para buscadores: primero el envío nacional y el lugar (lo que decide una compra a
 * distancia), luego la del vendedor. `pageMetadata` la recorta a 160 caracteres.
 */
export function productSeoDescription(product: PublicProductDTO) {
  const parts: string[] = [];
  const shipping = nationalShipping(product.facts);
  if (shipping) {
    const price =
      shipping.cents === 0
        ? "Envío gratis a todo México"
        : `Envío a todo México por ${formatMoney(shipping.cents, product.currency)}`;
    const { days } = shipping;
    const window = !days
      ? ""
      : days.min === days.max
        ? ` (${days.min} días)`
        : ` (${days.min} a ${days.max} días)`;
    parts.push(`${price}${window}.`);
  }
  parts.push(`Se vende desde ${placeLabel(product.facts.city, product.facts.state)}.`);
  parts.push(product.description);
  return parts.join(" ");
}

export function productBreadcrumbs(product: PublicProductDTO) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Comprar", item: absoluteUrl("/comprar") },
      {
        "@type": "ListItem",
        position: 2,
        name: product.category.name,
        item: absoluteUrl(`/comprar/${encodeURIComponent(product.category.slug)}`),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.title,
        item: absoluteUrl(`/producto/${encodeURIComponent(product.slug)}`),
      },
    ],
  };
}
