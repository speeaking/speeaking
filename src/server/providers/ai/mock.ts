import type { SaleProposal, SaleProposalRequest } from "@/modules/ai/sale-proposal";
import { formatMoney } from "@/lib/format";
import type { AIProvider } from "./types";

type Profile = {
  categorySlug: string | null;
  audiences: SaleProposal["targetAudiences"];
  hook: string;
  objections: SaleProposal["objections"];
};

const PROFILES: { match: RegExp; profile: Profile }[] = [
  {
    match: /aud[ií]fono|airpod|bocina|headphone|buds/i,
    profile: {
      categorySlug: "audio",
      hook: "silencio y buen sonido para tu día a día",
      audiences: [
        {
          name: "Quienes viajan en transporte público",
          why: "Buscan aislarse del ruido en el camino.",
        },
        { name: "Estudiantes y home office", why: "Necesitan concentración y llamadas claras." },
        { name: "Regalos", why: "Es un regalo deseado y fácil de acertar." },
      ],
      objections: [
        {
          objection: "¿Son originales?",
          answer:
            "Responde solo con lo que puedas comprobar (factura, empaque sellado) y menciónalo en la publicación.",
        },
        {
          objection: "¿Tienen garantía?",
          answer: "Indica claramente los días de garantía que ofreces.",
        },
        {
          objection: "Está caro",
          answer:
            "Compara tu precio con el de tienda y explica qué incluye (envío, garantía, entrega rápida).",
        },
      ],
    },
  },
  {
    match: /tenis|zapato|sneaker|calzado/i,
    profile: {
      categorySlug: "tenis",
      hook: "comodidad para todo el día",
      audiences: [
        {
          name: "Personas que empiezan a correr",
          why: "Buscan buen amortiguamiento sin gastar de más.",
        },
        { name: "Estilo urbano", why: "Quieren tenis cómodos que combinen con todo." },
      ],
      objections: [
        {
          objection: "¿Qué tallas hay?",
          answer: "Publica la tabla de tallas disponible y cómo medir el pie.",
        },
        {
          objection: "¿Y si no me queda?",
          answer: "Aclara tu política de cambios o devoluciones.",
        },
      ],
    },
  },
  {
    match: /control|consola|playstation|xbox|nintendo|gamer|teclado|mouse/i,
    profile: {
      categorySlug: "accesorios-gaming",
      hook: "más partidas, menos excusas",
      audiences: [
        { name: "Gamers casuales", why: "Buscan buen desempeño a precio justo." },
        { name: "Regalos para gamers", why: "Accesorio útil y fácil de regalar." },
      ],
      objections: [
        {
          objection: "¿Es compatible con mi consola?",
          answer: "Lista en la descripción los equipos compatibles que puedas confirmar.",
        },
        {
          objection: "¿Cuánto dura la batería?",
          answer: "Da el dato del fabricante y aclara que depende del uso.",
        },
      ],
    },
  },
  {
    match: /pastel|galleta|salsa|caf[eé]|comida|postre|pan/i,
    profile: {
      categorySlug: "comida",
      hook: "hecho con cariño, directo a tu mesa",
      audiences: [
        {
          name: "Tu colonia y alrededores",
          why: "La comida se vende mejor cerca y con entrega rápida.",
        },
        { name: "Celebraciones", why: "Cumpleaños y reuniones buscan opciones caseras." },
      ],
      objections: [
        { objection: "¿Cuánto dura?", answer: "Indica caducidad y cómo conservarlo." },
        { objection: "¿Hacen entregas?", answer: "Aclara zonas y horarios de entrega." },
      ],
    },
  },
];

const FALLBACK: Profile = {
  categorySlug: null,
  hook: "justo lo que estabas buscando",
  audiences: [
    {
      name: "Tu comunidad cercana",
      why: "Las primeras ventas suelen llegar de gente que ya te conoce.",
    },
    {
      name: "Personas buscando un regalo",
      why: "Un buen producto con buena foto se regala fácil.",
    },
  ],
  objections: [
    {
      objection: "¿Cómo sé que es confiable?",
      answer: "Muestra fotos reales, reseñas y tu política de devolución.",
    },
    { objection: "¿Cuánto tarda en llegar?", answer: "Indica tiempos de entrega exactos." },
  ],
};

/** Redondea a precio "de vitrina" terminado en 9 (p. ej. 3,324 → 3,329). */
function charmPrice(cents: number) {
  const pesos = Math.max(9, Math.round(cents / 100));
  return (Math.floor(pesos / 10) * 10 + 9) * 100;
}

/**
 * Proveedor simulado y determinista: sin costo ni red. Genera una propuesta creíble a partir de
 * los datos confirmados por el vendedor; nunca inventa datos del mercado y lo declara en los
 * supuestos.
 */
export class MockAIProvider implements AIProvider {
  readonly id = "mock";
  readonly model = "mock";
  readonly promptVersion = "sale-proposal@mock-1";

  async generateSaleProposal(request: SaleProposalRequest) {
    const { profile } = PROFILES.find(({ match }) => match.test(request.productName)) ?? {
      profile: FALLBACK,
    };
    const name = request.productName.trim();
    const price = formatMoney(request.priceCents);
    const where = request.city ? `en ${request.city}` : "a todo México";
    const marginCents = request.priceCents - request.costCents;

    const output: SaleProposal = {
      productName: name,
      headline: `${name}: ${profile.hook}`,
      description: `${name} disponible para entrega ${where}. Te lo entregamos listo para usar, con atención directa del vendedor. Precio: ${price}.`,
      valueProposition: `${name} a ${price} con trato directo y entrega ${where}: sin intermediarios y con respuesta rápida.`,
      categorySlug: profile.categorySlug,
      tags: name
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length >= 3)
        .slice(0, 6),
      targetAudiences: profile.audiences,
      contentIdeas: [
        `Video de 15 segundos: abre el empaque de ${name} y muestra los detalles.`,
        `Foto de ${name} en uso real, con luz natural.`,
        `Pregunta a tu comunidad: "¿Para qué usarías ${name}?"`,
        `Comparte la reseña de tu primer cliente (con su permiso).`,
      ],
      adIdeas: [
        `${name} a ${price}. Entrega ${where}. Quedan ${request.quantity} piezas.`,
        `¿Buscabas ${name}? Precio justo, trato directo y entrega ${where}.`,
        `${name}: ${profile.hook}. Escríbeme y apártalo hoy.`,
      ],
      videoScript: `0–3 s: muestra ${name} de cerca. 3–8 s: úsalo y di el beneficio principal (${profile.hook}). 8–12 s: precio (${price}) y entrega ${where}. 12–15 s: "Toca Comprar o escríbeme".`,
      suggestedPriceRange: {
        minCents: charmPrice(request.priceCents * 0.95),
        maxCents: charmPrice(request.priceCents * 1.03),
        rationale:
          "Rango de prueba alrededor de tu precio para experimentar. No consultamos precios del mercado en tiempo real.",
      },
      suggestedDailyBudgetCents: Math.min(Math.max(Math.round(marginCents * 0.3), 5_000), 30_000),
      budgetRationale:
        "Empieza con poco y mide durante 3 a 7 días; ajusta cuando tengas datos de ventas reales.",
      objections: profile.objections,
      ctas: ["Compra ahora", "Escríbeme para apartarlo", "Compártelo con quien lo necesita"],
      assumptions: [
        "Usamos el precio, costo y cantidad que confirmaste.",
        "No consultamos precios de la competencia en tiempo real.",
        "El presupuesto sugerido es una prueba inicial, no una garantía de ventas.",
      ],
    };
    return { output, usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
