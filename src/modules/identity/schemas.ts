import { z } from "zod";
import { isCommonPassword } from "./common-passwords";
import { isPlatformImpersonation, isReservedUsername } from "./reserved-names";

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_ACCOUNT_NAME_LENGTH = 60;

/** Mensaje para nombres visibles que suplantan a la plataforma (SEC-18). */
export const RESERVED_NAME_MESSAGE = "Ese nombre está reservado. Elige otro.";

const email = z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido."));

/**
 * Nombre de la cuenta (`users.name`). Lo usan el registro y los hooks de Better Auth (`auth.ts`), así
 * que ningún camino guarda un nombre sin validar (SEC-09).
 */
export const accountNameSchema = z
  .string()
  .trim()
  .min(2, "Escribe tu nombre.")
  // `abort`: un texto demasiado largo no llega a la revisión de suplantación (costo de CPU).
  .max(MAX_ACCOUNT_NAME_LENGTH, {
    error: `Máximo ${MAX_ACCOUNT_NAME_LENGTH} caracteres.`,
    abort: true,
  })
  .refine((value) => !isPlatformImpersonation(value), RESERVED_NAME_MESSAGE);

export const signUpSchema = z
  .object({
    name: accountNameSchema,
    email,
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      .max(MAX_PASSWORD_LENGTH, { error: `Máximo ${MAX_PASSWORD_LENGTH} caracteres.`, abort: true })
      // SEC-30: lista local de contraseñas comunes (sin llamadas externas). Las cortas ya fallan arriba.
      .refine(
        (value) => value.length < MIN_PASSWORD_LENGTH || !isCommonPassword(value),
        "Esa contraseña es muy común. Usa una frase que solo tú conozcas.",
      ),
    // Casilla de un formulario HTML: llega como "on" cuando está marcada.
    acceptTerms: z
      .literal("on", { error: "Debes aceptar los términos y el aviso de privacidad." })
      .transform(() => true),
  })
  .refine(({ email, password }) => !passwordContainsEmail(password, email), {
    path: ["password"],
    message: "No uses tu correo en la contraseña.",
  });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Escribe tu contraseña.").max(MAX_PASSWORD_LENGTH),
});

/** El correo completo o su parte antes de la @ (si no es muy corta) dentro de la contraseña. */
function passwordContainsEmail(password: string, email: string) {
  const lower = password.toLowerCase();
  const local = email.split("@")[0] ?? "";
  return lower.includes(email) || (local.length >= 4 && lower.includes(local));
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .min(3, "Usa al menos 3 caracteres.")
      .max(30, { error: "Máximo 30 caracteres.", abort: true })
      .regex(
        /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/,
        "Solo letras sin acento, números, punto y guion bajo; sin empezar ni terminar en punto.",
      )
      // Rutas propias y suplantación de la plataforma (`equipo.*`, `vendeia.*`, `soporte`…, SEC-18).
      .refine((value) => !isReservedUsername(value), "Ese nombre de usuario no está disponible."),
  );
