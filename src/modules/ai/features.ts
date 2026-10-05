import { z } from "zod";

/**
 * Banderas por función de IA (ADR-043): las 20 funciones del plan «Ecosistema de IA» más las que
 * ya existían, en una lista cerrada. Cada una se enciende o apaga desde /admin/ia sin desplegar y
 * queda en la bitácora de decisiones. Las «planeadas» no tienen código: siempre están apagadas.
 *
 * Sin `server-only`: lo leen componentes (etiquetas) y pruebas. La lectura del ajuste vive en
 * `features-store.ts`.
 */
export const AI_FEATURES_KEY = "ai.features";

export const AI_FEATURE_KEYS = [
  // Ya construidas antes del plan.
  "sellerListing",
  "adKit",
  "authenticitySignal",
  "platformAnalyst",
  // Fase 2: el diferenciador principal.
  "shoppingIntent",
  "createLook",
  "completeLook",
  "virtualTryOn",
  "buyerMatching",
  // Fase 3: vendedor.
  "sellerContent",
  "videoGenerator",
  "sellerAgent",
  // Fase 4: experiencia de compra (y de lectura).
  "postContext",
  "imageSearch",
  "editorialDesk",
  "voiceAssistant",
  "buyerAssistant",
  "giftFinder",
  "shoppingAssistant",
  "personalizedFeed",
  // Fase 5: inteligencia del marketplace.
  "negotiation",
  "trends",
  "sellerInsights",
  "fraudDetection",
  "spaceVisualizer",
  "vehicleVisualizer",
] as const;

export type AiFeatureKey = (typeof AI_FEATURE_KEYS)[number];

export type AiFeaturePhase = 1 | 2 | 3 | 4 | 5;

export type AiFeatureDefinition = {
  key: AiFeatureKey;
  label: string;
  description: string;
  phase: AiFeaturePhase;
  /** `built`: existe en el código y se puede encender; `planned`: reservada, siempre apagada. */
  status: "built" | "planned";
  defaultEnabled: boolean;
};

const built = (
  key: AiFeatureKey,
  label: string,
  description: string,
  phase: AiFeaturePhase,
  defaultEnabled = true,
): AiFeatureDefinition => ({ key, label, description, phase, status: "built", defaultEnabled });

const planned = (
  key: AiFeatureKey,
  label: string,
  description: string,
  phase: AiFeaturePhase,
): AiFeatureDefinition => ({
  key,
  label,
  description,
  phase,
  status: "planned",
  defaultEnabled: false,
});

/** Catálogo, en el orden en que se muestra. */
export const AI_FEATURES: readonly AiFeatureDefinition[] = [
  built("sellerListing", "Sube y vende", "Propuesta de publicación a partir de foto y precio.", 1),
  built("adKit", "Kit de anuncios", "Textos para WhatsApp, Facebook e Instagram.", 1),
  built(
    "authenticitySignal",
    "Señal de autenticidad",
    "Lectura del texto en la revisión de riesgo de imitación (además se activa con trust.aiSignal).",
    1,
  ),
  built("platformAnalyst", "Analista diario", "Narrativa del motor de automejora.", 1),
  built("shoppingIntent", "¿Qué necesitas?", "Interpreta una necesidad en lenguaje natural.", 2),
  built("createLook", "Crea mi look", "Arma looks completos con productos reales.", 2),
  built("completeLook", "Completa mi look", "Sugiere lo que combina con un producto.", 2),
  built("virtualTryOn", "Pruébatelo", "Simulación con la foto de la persona.", 2),
  built(
    "buyerMatching",
    "Coincidencias comprador–producto",
    "Cuenta cuántas personas buscan algo como cada producto.",
    2,
  ),
  planned("sellerContent", "Contenido para vendedores", "Imágenes y banners publicitarios.", 3),
  planned("videoGenerator", "Video promocional", "Videos cortos con control de costo.", 3),
  planned("sellerAgent", "Agente comercial del vendedor", "Responde con datos P4.", 3),
  built(
    "postContext",
    "Contexto",
    "Resumen neutral de publicaciones largas, una vez por publicación y guardado para todos.",
    4,
  ),
  built(
    "imageSearch",
    "Búsqueda por foto",
    "Describe la ropa y los objetos de una foto (nunca a las personas) y busca parecidos reales. La foto no se guarda.",
    4,
  ),
  built(
    "editorialDesk",
    "Redacción diaria",
    "Borradores para las cuentas editoriales de cada comunidad. Nada se publica sin que el equipo lo apruebe.",
    4,
  ),
  built(
    "voiceAssistant",
    "Spyke",
    "Interpreta órdenes para leer y preparar el envío de una publicación a un amigo. El envío requiere confirmación.",
    4,
  ),
  planned("buyerAssistant", "Comprador IA", "Compara productos reales sin inventar.", 4),
  planned("giftFinder", "Regalos", "Recomendaciones de regalo con presupuesto.", 4),
  planned(
    "shoppingAssistant",
    "Asistente general",
    "«¿Qué necesitas?» para cualquier categoría.",
    4,
  ),
  planned("personalizedFeed", "Feed personalizado", "Señales de interés más allá de los likes.", 4),
  planned("negotiation", "Negociación", "Solo dentro de límites del vendedor.", 5),
  planned("trends", "Tendencias", "Agregados de búsqueda y demanda.", 5),
  planned("sellerInsights", "Insights del vendedor", "Datos observados vs. estimaciones.", 5),
  planned("fraudDetection", "Antifraude", "Señales para revisión humana.", 5),
  planned("spaceVisualizer", "Pruébalo en mi espacio", "Muebles y decoración en tu foto.", 5),
  planned("vehicleVisualizer", "Visualizador de autos", "Color, rines y accesorios.", 5),
];

const definitions = new Map(AI_FEATURES.map((feature) => [feature.key, feature]));

export function aiFeatureDefinition(key: AiFeatureKey): AiFeatureDefinition {
  return definitions.get(key)!;
}

export const aiFeaturesSchema = z
  .object({
    version: z.literal(1),
    enabled: z.partialRecord(z.enum(AI_FEATURE_KEYS), z.boolean()),
  })
  .strict();

export type AiFeaturesSetting = z.infer<typeof aiFeaturesSchema>;

export const DEFAULT_AI_FEATURES: AiFeaturesSetting = { version: 1, enabled: {} };

/** Lectura tolerante del valor guardado (o el predeterminado si falta o no es válido). */
export function parseAiFeatures(value: unknown): AiFeaturesSetting {
  const parsed = aiFeaturesSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_AI_FEATURES;
}

/** ¿Está encendida? Una función planeada nunca lo está, diga lo que diga el ajuste. */
export function isAiFeatureEnabled(setting: AiFeaturesSetting, key: AiFeatureKey): boolean {
  const definition = aiFeatureDefinition(key);
  if (definition.status !== "built") return false;
  return setting.enabled[key] ?? definition.defaultEnabled;
}

/** Valor nuevo del ajuste al encender o apagar una función. */
export function withAiFeature(
  setting: AiFeaturesSetting,
  key: AiFeatureKey,
  enabled: boolean,
): AiFeaturesSetting {
  const definition = aiFeatureDefinition(key);
  const next = { ...setting.enabled };
  if (enabled === definition.defaultEnabled) delete next[key];
  else next[key] = enabled;
  return { version: 1, enabled: next };
}

/** Qué funciones cambian entre dos valores del ajuste (para la bitácora). */
export function aiFeatureChanges(
  before: AiFeaturesSetting,
  after: AiFeaturesSetting,
): { key: AiFeatureKey; enabled: boolean }[] {
  return AI_FEATURE_KEYS.flatMap((key) => {
    const was = isAiFeatureEnabled(before, key);
    const now = isAiFeatureEnabled(after, key);
    return was === now ? [] : [{ key, enabled: now }];
  });
}
