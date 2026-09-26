import "server-only";
import { MockAIProvider } from "./mock";
import type { AIProvider } from "./types";

let provider: AIProvider | undefined;

/**
 * Proveedor de IA activo. Hoy: `mock` (Sprint 1). Conectar un proveedor real es agregar su
 * adaptador aquí (misma interfaz) y seleccionarlo con AI_PROVIDER; ver docs/architecture.md → IA.
 */
export function getAIProvider(): AIProvider {
  provider ??= new MockAIProvider();
  return provider;
}

export type { AIProvider, AIUsage } from "./types";
