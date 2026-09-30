import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { siteConfig } from "@/config/site";
import { AUTH_COOKIE_PREFIX } from "@/modules/identity/constants";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/modules/identity/schemas";
import { sanitizeUserWrite } from "@/modules/identity/user-write";
import { authIpAddressOptions } from "./client-ip";
import { db } from "./db";
import { env } from "./env";

const DAY = 60 * 60 * 24;
// Estricto en producción; holgado en desarrollo y pruebas (la suite E2E corre en paralelo desde
// la misma IP).
const strict = env.NODE_ENV === "production";

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  // Entrar con Google (ADR-049): solo con credenciales; el callback lo abre el router HTTP.
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            // Google ya verificó el correo: la cuenta nace verificada. Si el correo ya existe con
            // contraseña, no se enlaza solo (SEC: evita tomar una cuenta con un correo ajeno).
          },
        }
      : {},
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    autoSignIn: true,
    // Verificación de correo: se activa al conectar el EmailProvider real (ver docs/roadmap.md).
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 30 * DAY,
    updateAge: DAY,
  },
  databaseHooks: {
    user: {
      // Nombre validado e `image` vacía en cualquier camino (SEC-09, ver `user-write.ts`).
      create: { before: async (user) => ({ data: sanitizeUserWrite(user) }) },
      update: { before: async (user) => ({ data: sanitizeUserWrite(user) }) },
    },
  },
  // Segunda barrera por si algún día se abre el router HTTP (hoy responde 404 a todo, ver
  // app/api/auth/[...all]/route.ts): estas rutas se saltan el consentimiento, los límites propios o
  // la validación de las Server Actions, o manejan cuentas y sesiones sin interfaz propia. Solo afecta
  // al router; `auth.api.*` sigue funcionando. Al abrir una en `ALLOWED_PATHS`, quítala de aquí.
  disabledPaths: [
    "/sign-up/email",
    "/sign-in/email",
    "/update-user",
    "/change-email",
    "/change-password",
    "/delete-user",
    "/request-password-reset",
    "/reset-password",
    "/list-sessions",
    "/revoke-session",
    "/revoke-sessions",
    "/revoke-other-sessions",
    "/update-session",
    "/link-social",
    "/unlink-account",
    "/list-accounts",
  ],
  // Solo cubre el router HTTP `/api/auth/*`, hoy cerrado (ver app/api/auth/[...all]/route.ts). Los
  // límites del registro y el inicio de sesión reales viven en `modules/identity/auth-limits.ts`.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: strict ? 5 : 100 },
      "/sign-up/email": { window: 60, max: strict ? 3 : 100 },
    },
  },
  advanced: {
    cookiePrefix: AUTH_COOKIE_PREFIX,
    // SEC-21: cookies Secure siempre que el sitio vaya por https (en producción es obligatorio,
    // ver env-schema).
    useSecureCookies: env.APP_URL.startsWith("https://"),
    // Los IDs los genera la base de datos (UUIDv7, ver prisma/schema.prisma).
    database: { generateId: false },
    // IP de la sesión y del limitador HTTP: solo la que resuelve `client-ip.ts` con los proxies de
    // confianza (SEC-07). Quien llama a `auth.api.*` pasa `withClientIpHeader(headers)`.
    ipAddress: authIpAddressOptions,
  },
  // Debe ir al final: permite que las Server Actions escriban las cookies de sesión.
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
