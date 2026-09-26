import { z } from "zod";

/** Palabras clave que el modo estricto de varios proveedores no acepta; Zod las valida después. */
const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "default",
]);

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (typeof node !== "object" || node === null) return node;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    result[key] = key === "properties" ? sanitizeProperties(value) : sanitize(value);
  }
  if (result.type === "object" && typeof result.properties === "object" && result.properties) {
    // Estricto: todas las llaves obligatorias y ninguna extra.
    result.required = Object.keys(result.properties);
    result.additionalProperties = false;
  }
  return result;
}

function sanitizeProperties(properties: unknown) {
  if (typeof properties !== "object" || properties === null) return properties;
  return Object.fromEntries(
    Object.entries(properties).map(([name, schema]) => [name, sanitize(schema)]),
  );
}

/**
 * JSON Schema para `response_format: { type: "json_schema", strict: true }` a partir del esquema de
 * Zod de la tarea. Se quitan las restricciones de longitud y patrón (no todos los proveedores las
 * soportan en modo estricto): el prompt las pide y Zod las exige al recibir la respuesta.
 */
export function strictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return sanitize(z.toJSONSchema(schema, { io: "output", unrepresentable: "any" })) as Record<
    string,
    unknown
  >;
}
