import { normalizeText } from "./personal-data";

/**
 * Productos que la IA no ayuda a vender (antes de gastar una llamada). Es una lista de patrones
 * deterministas y conservadores: mitiga, no modera. La moderación de la plataforma (reportes,
 * revisión de autenticidad) sigue aplicando a lo que se publique a mano.
 */
export type PolicyViolation = "counterfeit" | "weapons" | "drugs" | "prescription" | "vapes";

function phrases(alternatives: string[]) {
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}])(?:${alternatives.join("|")})(?![\p{L}\p{N}])`,
    "iu",
  );
}

const RULES: { kind: PolicyViolation; pattern: RegExp }[] = [
  {
    kind: "counterfeit",
    pattern: phrases([
      String.raw`r[eé]plicas?`,
      String.raw`clon(?:es)?`,
      String.raw`imitaci[oó]n(?:es)?`,
      "piratas?",
      "fake",
      String.raw`(?:calidad|tipo|clase|copia)\s+(?:aaa|a1|original|espejo|premium\s+1\s*:\s*1)`,
      String.raw`copias?\s+(?:exactas?|fiel(?:es)?|id[eé]nticas?|de\s+marca)`,
      String.raw`1\s*:\s*1`,
    ]),
  },
  {
    kind: "weapons",
    pattern: phrases([
      String.raw`armas?\s+(?:de\s+fuego|blancas?\s+prohibidas?)`,
      // Pistola de silicón, de agua, de calor o de pintura sí se venden.
      String.raw`pistolas?(?!\s+(?:de\s+|para\s+)?(?:silic[oó]n|silicona|agua|calor|pintura|pintar|juguete|aire|clavos|grapas|masaje|masajes|hidrogel|gel|burbujas|soldar|lavado|riego|impacto|calafateo))`,
      String.raw`rev[oó]lver(?:es)?`,
      String.raw`(?:rifles?|escopetas?|fusil(?:es)?)(?!\s+de\s+(?:juguete|hidrogel|gel|agua|aire\s+comprimido\s+de\s+juguete))`,
      String.raw`municiones?`,
      String.raw`calibre\s+\.?\d+`,
      String.raw`cuerno\s+de\s+chivo`,
      String.raw`ar-?15`,
      "glock",
      String.raw`silenciador(?:es)?\s+para\s+(?:arma|pistola|rifle)`,
    ]),
  },
  {
    kind: "drugs",
    pattern: phrases([
      "marihuana",
      "cannabis",
      "thc",
      String.raw`coca[ií]na`,
      "metanfetaminas?",
      "fentanilo",
      String.raw`hongos\s+(?:alucin[oó]genos|m[aá]gicos)`,
      "lsd",
    ]),
  },
  {
    kind: "prescription",
    pattern: phrases([
      "clonazepam",
      "alprazolam",
      "diazepam",
      "tramadol",
      "rivotril",
      "xanax",
      String.raw`antibi[oó]ticos?`,
      // «Lentes sin receta» sí se venden: solo medicamentos.
      String.raw`medicamentos?\s+(?:controlados?|con\s+receta|de\s+patente\s+con\s+receta)`,
      String.raw`semaglutida|ozempic`,
    ]),
  },
  {
    kind: "vapes",
    pattern: phrases([
      "vapes?",
      "vaper",
      String.raw`vapeador(?:es)?`,
      String.raw`cigarros?\s+electr[oó]nicos?`,
      String.raw`cigarrillos?\s+electr[oó]nicos?`,
      String.raw`e-?cig`,
    ]),
  },
];

/**
 * Mensajes para la persona. Dicen QUÉ palabras detectamos, no qué es la persona ni su producto: los
 * patrones también atrapan frases legítimas («original, no es réplica», «CBD sin THC») y el mensaje
 * no debe sonar a acusación.
 */
export const POLICY_MESSAGES: Record<PolicyViolation, string> = {
  counterfeit:
    "Tu texto menciona réplicas, copias o «calidad AAA», y con eso la IA no puede ayudarte. Si tu producto es original o hecho por ti, publícalo a mano desde Productos.",
  weapons:
    "Tu texto menciona armas o municiones, y con eso la IA no puede ayudarte. Si es otra cosa (una herramienta, un juguete), publícalo a mano desde Productos.",
  drugs:
    "Tu texto menciona drogas o THC, y con eso la IA no puede ayudarte. Si es otra cosa, publícalo a mano desde Productos.",
  prescription:
    "Tu texto menciona medicamentos que requieren receta, y con eso la IA no puede ayudarte.",
  vapes:
    "Tu texto menciona vapeadores o cigarros electrónicos: su venta está prohibida en México y la IA no puede ayudarte.",
};

/** Primera regla que el texto rompe, o `null` si ninguna. */
export function policyViolation(...texts: string[]): PolicyViolation | null {
  const text = normalizeText(texts.join("\n"));
  return RULES.find(({ pattern }) => pattern.test(text))?.kind ?? null;
}
