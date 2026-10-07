import { type AiCategory, prohibitedForAi } from "@/modules/trust/content-policy";

/**
 * Productos que la IA no ayuda a vender (antes de gastar una llamada). Los patrones viven en
 * `trust/content-policy.ts`, los mismos que detienen una publicación hecha a mano: mitigan, no
 * moderan. La moderación de la plataforma (reportes, revisión de autenticidad) sigue aplicando.
 */
export type PolicyViolation = AiCategory;

/**
 * Mensajes para la persona. Dicen QUÉ palabras detectamos, no qué es la persona ni su producto: los
 * patrones también atrapan frases legítimas («original, no es réplica», «CBD sin THC») y el mensaje
 * no debe sonar a acusación. Publicar a mano solo es salida para las réplicas: armas y drogas
 * también se detienen ahí, así que para esas el consejo es cambiar las palabras.
 */
export const POLICY_MESSAGES: Record<PolicyViolation, string> = {
  counterfeit:
    "Tu texto menciona réplicas, copias o «calidad AAA», y con eso la IA no puede ayudarte. Si tu producto es original o hecho por ti, publícalo a mano desde Productos.",
  weapons:
    "Tu texto menciona armas o municiones, y con eso la IA no puede ayudarte. Si es otra cosa (una herramienta, un juguete), cambia esas palabras.",
  drugs:
    "Tu texto menciona drogas o THC, y con eso la IA no puede ayudarte. Si es otra cosa, cambia esas palabras.",
  prescription:
    "Tu texto menciona medicamentos que requieren receta, y con eso la IA no puede ayudarte.",
  vapes:
    "Tu texto menciona vapeadores o cigarros electrónicos: su venta está prohibida en México y la IA no puede ayudarte.",
};

/** Primera regla que el texto rompe, o `null` si ninguna. */
export function policyViolation(...texts: string[]): PolicyViolation | null {
  return prohibitedForAi(...texts);
}
