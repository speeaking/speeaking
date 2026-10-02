import { formatMoney } from "@/lib/format";
import { listingTitle, type SaleProposal, type SaleProposalRequest } from "../sale-proposal";

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

/** Categoría que elegiría el simulador para un nombre de producto (`null` si ninguna). */
export function mockCategoryFor(productName: string) {
  return (PROFILES.find(({ match }) => match.test(productName))?.profile ?? FALLBACK).categorySlug;
}

/**
 * Propuesta simulada y determinista: sin costo ni red. Se arma con los datos confirmados por el
 * vendedor, nunca inventa datos del mercado y lo declara en los supuestos. No lleva cifras de rango
 * ni presupuesto: esas las pone el código (P2). Sigue las reglas del prompt: en lo que ve quien
 * compra no dice cuántas piezas hay (junto al precio se leería como el precio del lote), no promete
 * entregas y la descripción habla del producto, no en primera persona del vendedor.
 */
export function mockSaleProposal(request: SaleProposalRequest) {
  const { profile } = PROFILES.find(({ match }) => match.test(request.productName)) ?? {
    profile: FALLBACK,
  };
  const name = listingTitle(request.productName);
  const price = formatMoney(request.priceCents);

  return {
    productName: name,
    headline: `${name}: ${profile.hook}`,
    description: `${name}: ${profile.hook}. Revisa las fotos y pregunta cualquier detalle antes de comprar; quien lo vende te responde directo. Precio: ${price}.`,
    valueProposition: `${name} a ${price}, con trato directo con quien lo vende y sin intermediarios.`,
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
      `${name} a ${price}. Pídelo aquí.`,
      `¿Buscabas ${name}? Precio justo y trato directo. Haz tu pedido aquí.`,
      `${name}: ${profile.hook}. Pídelo aquí.`,
    ],
    videoScript: `0–3 s: muestra ${name} de cerca. 3–8 s: úsalo y di el beneficio principal (${profile.hook}). 8–12 s: di el precio (${price}). 12–15 s: "Toca Comprar o escríbeme".`,
    suggestedPriceRange: {
      rationale:
        "Rango de prueba alrededor de tu precio para experimentar. No consultamos precios del mercado en tiempo real.",
    },
    budgetRationale:
      "Empieza con poco y mide durante la primera semana; ajusta cuando tengas datos de ventas reales.",
    objections: profile.objections,
    ctas: ["Compra ahora", "Escríbeme para apartarlo", "Compártelo con quien lo necesita"],
    assumptions: [
      "Usamos el precio, costo y cantidad que confirmaste.",
      "No consultamos precios de la competencia en tiempo real.",
      "El presupuesto sugerido es una prueba inicial, no una garantía de ventas.",
    ],
  };
}
