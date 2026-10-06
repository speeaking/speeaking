import { absoluteUrl, PUBLIC_PAGES } from "@/app/seo";
import { siteConfig } from "@/config/site";

/**
 * `llms.txt` (formato de llmstxt.org): qué es speeaking y sus páginas públicas, para asistentes de IA
 * que buscan en la web. Solo datos reales: las páginas públicas del sitemap, las categorías con
 * productos y las comunidades. Mientras los pagos sean simulados, lo dice.
 */

/** Lo que dice cada página pública (resumen de su propia descripción). */
const PAGE_SUMMARIES: Record<(typeof PUBLIC_PAGES)[number], { title: string; summary: string }> = {
  "/": { title: "Inicio", summary: siteConfig.description },
  "/descubrir": {
    title: "Descubrir comunidades",
    summary: "Comunidades por tema para compartir intereses y descubrir publicaciones y productos.",
  },
  "/comprar": {
    title: "Comprar",
    summary:
      "Productos de vendedores de México, con precio, envío y devoluciones que declara cada tienda.",
  },
  "/creadores": {
    title: "Creadores",
    summary: "Cómo recomendar productos de las tiendas en tus fotos y videos.",
  },
  "/precios": {
    title: "Precios",
    summary: "Gratis para quien compra; quien vende paga solo por lo que le trae ventas.",
  },
  "/seguridad": {
    title: "Seguridad y privacidad",
    summary: "Qué datos se piden, cómo se guardan y qué puedes borrar.",
  },
  "/apoya": {
    title: "Apoya el proyecto",
    summary: "Proyecto independiente hecho en México: cuánto cuesta mantenerlo y de dónde sale.",
  },
  "/como-funciona": {
    title: "Cómo funciona",
    summary:
      "Descubrir productos de vendedores, probarte prendas con una foto y conversar antes de comprar.",
  },
  "/preguntas-frecuentes": {
    title: "Preguntas frecuentes",
    summary: "Comprar, vender, probarte prendas, colaborar con tiendas y recuperar tu cuenta.",
  },
};

/** Una sola línea y sin corchetes: un texto de usuario no puede abrir secciones ni enlaces. */
function inline(text: string) {
  return text.replace(/\s+/g, " ").replace(/\[/g, "(").replace(/\]/g, ")").trim();
}

function link(name: string, url: string, summary?: string | null) {
  const description = summary ? inline(summary) : "";
  return `- [${inline(name)}](${url})${description ? `: ${description}` : ""}`;
}

export function llmsText({
  categories,
  communities,
  simulatedPayments,
}: {
  categories: readonly { slug: string; name: string }[];
  communities: readonly { slug: string; name: string; description: string | null }[];
  simulatedPayments: boolean;
}) {
  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> Red social de México para descubrir contenido y productos de gente real, probarte prendas con una foto y comprar a vendedores de todo el país.`,
    "",
    `${siteConfig.name} está en español de México y los precios son en pesos (MXN). Cada tienda declara su precio, envío, entrega y devoluciones; la plataforma no inventa ni verifica esos datos.`,
  ];
  if (simulatedPayments) {
    lines.push(
      `Etapa de prueba: los pagos dentro de ${siteConfig.name} aún son simulados; no se cobra nada.`,
    );
  }
  lines.push(
    "",
    "## Páginas",
    "",
    ...PUBLIC_PAGES.map((path) =>
      link(PAGE_SUMMARIES[path].title, absoluteUrl(path), PAGE_SUMMARIES[path].summary),
    ),
  );
  if (categories.length > 0) {
    lines.push(
      "",
      "## Categorías con productos",
      "",
      ...categories.map((category) =>
        link(category.name, absoluteUrl(`/comprar/${encodeURIComponent(category.slug)}`)),
      ),
    );
  }
  if (communities.length > 0) {
    lines.push(
      "",
      "## Comunidades",
      "",
      ...communities.map((community) =>
        link(
          community.name,
          absoluteUrl(`/c/${encodeURIComponent(community.slug)}`),
          community.description,
        ),
      ),
    );
  }
  return `${lines.join("\n")}\n`;
}
