// Mismo mensaje si el correo ya tiene cuenta o si el alta falló por otra causa: el texto no confirma
// que la cuenta exista (SEC-11; el tiempo se iguala en `actions.ts`).
const SIGN_UP_FAILED = "No pudimos crear la cuenta con ese correo. Si ya tienes cuenta, inicia sesión.";

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
  INVALID_PASSWORD: "Correo o contraseña incorrectos.",
  USER_ALREADY_EXISTS: SIGN_UP_FAILED,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: SIGN_UP_FAILED,
  FAILED_TO_CREATE_USER: SIGN_UP_FAILED,
  PASSWORD_TOO_SHORT: "La contraseña es demasiado corta.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  INVALID_EMAIL: "Escribe un correo válido.",
  EMAIL_NOT_VERIFIED: "Confirma tu correo para continuar.",
};

const GENERIC = "No pudimos completar la solicitud. Intenta de nuevo.";

/** Traduce errores de Better Auth a mensajes en español, sin detalles técnicos. */
export function authErrorMessage(error: { code?: string; status?: number } | undefined): string {
  if (error?.status === 429) {
    return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";
  }
  return (error?.code && MESSAGES[error.code]) || GENERIC;
}
