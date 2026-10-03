// Mismo mensaje si el correo ya tiene cuenta o si el alta falló por otra causa: el texto no confirma
// que la cuenta exista (SEC-11; el tiempo se iguala en `actions.ts`).
const SIGN_UP_FAILED =
  "No pudimos crear la cuenta con ese correo. Si ya tienes cuenta, inicia sesión.";

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

const GOOGLE_SESSION_ERRORS = new Set([
  "state_not_found",
  "state_mismatch",
  "state_invalid",
  "state_security_mismatch",
  "state_expired",
]);

/** El proveedor puede añadir `error` a una URL que ya lo tenía: también admite intentos antiguos. */
export function googleAuthError(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : [value];
  const code = values.findLast((entry) => entry && entry !== "google") ?? values.at(-1);
  if (!code) return undefined;

  const recoverAccount = code === "account_not_linked";
  let message = "No pudimos entrar con Google. Intenta de nuevo o entra con tu correo.";
  if (recoverAccount) {
    message =
      "Tu cuenta se creó con correo y contraseña. Para conectar Google, verifica tu correo mediante «Recuperar mi cuenta» y después vuelve a entrar con Google.";
  } else if (code === "access_denied") {
    message = "Se canceló el acceso con Google. Puedes intentarlo otra vez.";
  } else if (GOOGLE_SESSION_ERRORS.has(code)) {
    message = "Este intento de acceso caducó. Pulsa «Continuar con Google» para iniciar uno nuevo.";
  }
  return { message, recoverAccount };
}
