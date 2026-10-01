import { APIError } from "better-auth/api";
import { accountNameSchema, isReservedEmail } from "./schemas";

/**
 * Lo que Better Auth escribe en `users` pasa por las mismas reglas que el registro (SEC-09): nombre
 * validado (largo y sin suplantar a la plataforma, SEC-18) e `image` siempre vacía (los avatares viven
 * en `Profile.avatarUrl`; así no hay dónde guardar un `javascript:`). Lo usan los `databaseHooks` de
 * `server/auth.ts`, así que aplica a cualquier camino, no solo a las Server Actions. Tampoco entra un
 * correo `.invalid`: son de las cuentas de la plataforma (editoriales y eliminadas), que se escriben
 * directo en la base, nunca por Better Auth.
 */
export function sanitizeUserWrite<T extends Record<string, unknown>>(data: T): T & { image: null } {
  if ("email" in data && typeof data.email === "string" && isReservedEmail(data.email)) {
    throw APIError.from("BAD_REQUEST", { message: "Invalid email", code: "INVALID_EMAIL" });
  }
  if (!("name" in data)) return { ...data, image: null };
  const name = accountNameSchema.safeParse(data.name);
  if (!name.success) {
    throw APIError.from("BAD_REQUEST", { message: "Invalid name", code: "INVALID_NAME" });
  }
  return { ...data, name: name.data, image: null };
}
