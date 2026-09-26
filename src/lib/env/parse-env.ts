import { type z } from "zod";

export class EnvValidationError extends Error {
  override name = "EnvValidationError";
}

/**
 * Valida variables de entorno contra un esquema de Zod y devuelve los valores tipados.
 *
 * El error lista solo los NOMBRES de las variables inválidas y el motivo, nunca sus valores,
 * para no filtrar secretos en logs.
 */
export function parseEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined>,
): z.output<TSchema> {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }

  const problems = result.error.issues.map((issue) => {
    const variable = issue.path.map(String).join(".") || "(raíz)";
    return `- ${variable}: ${issue.message}`;
  });

  throw new EnvValidationError(`Variables de entorno inválidas:\n${problems.join("\n")}`);
}
