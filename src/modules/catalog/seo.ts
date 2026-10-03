import { absoluteUrl } from "@/app/seo";
import type { PublicProductDTO } from "./dto";

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
