import { z } from "zod";
import {
  PAYMENT_PROVIDERS,
  SIMULATED_PAYMENT_PROVIDER,
  simulatedPaymentsAllowed,
} from "./providers/payments/policy";

/**
 * Proveedores de IA configurables con `AI_PROVIDER` (ADR-033 #6 y #9). `openai_compatible` es un
 * modelo abierto pagado por uso en un servidor EXTERNO con API compatible con OpenAI (OpenRouter,
 * DeepInfra, Together o un servidor con GPU rentado que corra vLLM): nada se instala en la PC.
 */
export const AI_PROVIDERS = ["mock", "openai_compatible"] as const;
export type AIProviderId = (typeof AI_PROVIDERS)[number];

/** Id de la IA simulada (plantillas deterministas, sin red ni costo). */
export const SIMULATED_AI_PROVIDER = "mock" satisfies AIProviderId;

/**
 * ¿Se puede usar la IA simulada? Solo con `AI_PROVIDER=mock` y, en producción, únicamente si
 * `ALLOW_SIMULATED_AI=true`: un piloto cerrado donde los vendedores reciben textos de plantilla es
 * una decisión explícita, nunca un olvido de configuración (espejo de `simulatedPaymentsAllowed`).
 */
export function simulatedAIAllowed(config: {
  NODE_ENV: "development" | "test" | "production";
  AI_PROVIDER: AIProviderId;
  ALLOW_SIMULATED_AI: boolean;
}) {
  return (
    config.AI_PROVIDER === SIMULATED_AI_PROVIDER &&
    (config.NODE_ENV !== "production" || config.ALLOW_SIMULATED_AI)
  );
}

/** Id de modelo del proveedor: `qwen/qwen3.5-9b`, `Qwen/Qwen3.5-9B-Instruct`, `modelo:free`… */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,127}$/;

/** Una variable vacía (`AI_BASE_URL=` en el .env) cuenta como no definida. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

/**
 * Esquema de variables de entorno del servidor, separado de `env.ts` para poder probarlo y usarlo
 * en scripts sin evaluar `process.env`. Cada fase agrega aquí sus variables.
 */
export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:3000"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    BETTER_AUTH_SECRET: z.string().min(32, "Debe tener al menos 32 caracteres."),
    STORAGE_DRIVER: z.enum(["local"]).default("local"),
    STORAGE_LOCAL_ROOT: z.string().min(1).default(".data/uploads"),
    // Proxies de confianza delante de Next, para la IP del cliente (ver src/server/client-ip.ts).
    // 0 = Next expuesto directo: se ignora X-Forwarded-For y no hay IP confiable (los límites por IP no
    // aplican). N = la IP es la N-ésima entrada de X-Forwarded-For contando desde la derecha.
    TRUSTED_PROXY_HOPS: z
      .enum(["0", "1", "2", "3", "4", "5"], { error: "Debe ser un entero de 0 a 5." })
      .default("0")
      .transform(Number),
    // Pagos (SEC-01). Hoy solo existe el proveedor simulado; el real se agrega en PAYMENT_PROVIDERS.
    PAYMENT_PROVIDER: z
      .enum(PAYMENT_PROVIDERS, { error: `Debe ser uno de: ${PAYMENT_PROVIDERS.join(", ")}.` })
      .default("mock"),
    // Pagos simulados en producción: solo para un piloto cerrado, como decisión explícita. En
    // desarrollo y pruebas no hace falta; en producción, sin ella el arranque falla con el simulador.
    ALLOW_SIMULATED_PAYMENTS: z.stringbool({ error: "Debe ser true o false." }).default(false),
    // IA. `mock` (por omisión) no llama a nadie. Con `openai_compatible` las tres siguientes son
    // obligatorias; la llave es un secreto (nunca en el repositorio ni en el navegador).
    AI_PROVIDER: z
      .enum(AI_PROVIDERS, { error: `Debe ser uno de: ${AI_PROVIDERS.join(", ")}.` })
      .default("mock"),
    AI_BASE_URL: optional(
      z.url({ protocol: /^https?$/, error: "Debe ser una URL http(s) (termina en /v1)." }),
    ),
    AI_API_KEY: optional(z.string().min(16, "Debe tener al menos 16 caracteres.")),
    AI_DEFAULT_MODEL: optional(
      z.string().regex(MODEL_ID, "Id de modelo inválido (p. ej. qwen/qwen3.5-9b)."),
    ),
    // IA simulada en producción (ADR-038): solo para un piloto cerrado, como decisión explícita. Con
    // `mock`, «Vende con IA» y el kit de anuncios entregan textos de plantilla, no de un modelo. En
    // desarrollo y pruebas no hace falta; en producción, sin ella el arranque falla con `mock`.
    ALLOW_SIMULATED_AI: z.stringbool({ error: "Debe ser true o false." }).default(false),
    // Secreto de las tareas programadas (`/api/cron/*`, cabecera `Authorization: Bearer …`).
    // Obligatorio en producción; sin él, las rutas de cron deben rechazar toda petición.
    CRON_SECRET: optional(z.string().min(32, "Debe tener al menos 32 caracteres.")),
  })
  .superRefine((env, ctx) => {
    // SEC-21: en producción, fuera de loopback, todo viaja cifrado (cookies Secure y base con TLS).
    // Loopback se permite para probar el build de producción en local (`pnpm start`, E2E en CI).
    // Las URL se leen con `parseUrl`: si el campo ya falló, `new URL` lanzaría un TypeError que
    // lleva el valor (la contraseña de DATABASE_URL) y podría acabar en un log.
    const app = parseUrl(env.APP_URL);
    if (env.NODE_ENV === "production") {
      if (app && app.protocol !== "https:" && !isLoopback(app.hostname)) {
        ctx.addIssue({
          code: "custom",
          path: ["APP_URL"],
          message:
            "En producción APP_URL debe usar https (las cookies de sesión van marcadas Secure).",
        });
      }
      const database = parseUrl(env.DATABASE_URL);
      const sslmode = database?.searchParams.get("sslmode");
      if (
        database &&
        !isLoopback(database.hostname) &&
        !["require", "verify-ca", "verify-full"].includes(sslmode ?? "")
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message:
            "En producción la base de datos remota debe usar TLS: agrega sslmode=require (o verify-full) a DATABASE_URL.",
        });
      }
    }
    if (env.PAYMENT_PROVIDER === SIMULATED_PAYMENT_PROVIDER && !simulatedPaymentsAllowed(env)) {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOW_SIMULATED_PAYMENTS"],
        message:
          "Con PAYMENT_PROVIDER=mock en producción nadie paga de verdad. Configura un proveedor real o, solo para un piloto cerrado, ALLOW_SIMULATED_PAYMENTS=true.",
      });
    }
    if (env.AI_PROVIDER === SIMULATED_AI_PROVIDER && !simulatedAIAllowed(env)) {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOW_SIMULATED_AI"],
        message:
          "Con AI_PROVIDER=mock en producción la IA es simulada: los vendedores recibirían textos de plantilla, no de un modelo. Configura AI_PROVIDER=openai_compatible o, solo para un piloto cerrado, ALLOW_SIMULATED_AI=true.",
      });
    }
    if (env.AI_PROVIDER === "openai_compatible") {
      for (const name of ["AI_BASE_URL", "AI_API_KEY", "AI_DEFAULT_MODEL"] as const) {
        if (env[name] === undefined) {
          ctx.addIssue({
            code: "custom",
            path: [name],
            message: "Obligatoria con AI_PROVIDER=openai_compatible.",
          });
        }
      }
    }
    // La llave viaja en cada petición: fuera de la máquina, solo cifrada. Y nunca en la URL. (Otro
    // protocolo ya lo rechaza el campo.)
    const aiBase = env.AI_BASE_URL === undefined ? null : parseUrl(env.AI_BASE_URL);
    if (aiBase) {
      if (aiBase.protocol === "http:" && !isLoopback(aiBase.hostname)) {
        ctx.addIssue({
          code: "custom",
          path: ["AI_BASE_URL"],
          message: "Debe usar https (la llave de la IA viaja en cada petición).",
        });
      }
      if (aiBase.username !== "" || aiBase.password !== "") {
        ctx.addIssue({
          code: "custom",
          path: ["AI_BASE_URL"],
          message: "No pongas credenciales en la URL; la llave va en AI_API_KEY.",
        });
      }
    }
    // Loopback se permite sin secreto para probar el build de producción en local; ahí el cron
    // queda cerrado (sin CRON_SECRET toda petición a /api/cron/* se rechaza).
    if (
      env.NODE_ENV === "production" &&
      env.CRON_SECRET === undefined &&
      !(app && isLoopback(app.hostname))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message:
          "Obligatoria en producción (mínimo 32 caracteres): protege las tareas programadas.",
      });
    }
  });

export type ServerEnv = z.output<typeof serverEnvSchema>;

/** Configuración de IA ya resuelta: con `openai_compatible`, el esquema garantiza los tres datos. */
export type AIProviderConfig =
  | { provider: "mock" }
  | { provider: "openai_compatible"; baseUrl: string; apiKey: string; model: string };

/**
 * Configuración del proveedor de IA con tipos estrechos (evita repetir `!` en el adaptador). Lanza si
 * se llama con un objeto que no pasó por `serverEnvSchema` y le falta algo.
 */
export function aiProviderConfig(
  env: Pick<ServerEnv, "AI_PROVIDER" | "AI_BASE_URL" | "AI_API_KEY" | "AI_DEFAULT_MODEL">,
): AIProviderConfig {
  if (env.AI_PROVIDER === "mock") return { provider: "mock" };
  const { AI_BASE_URL: baseUrl, AI_API_KEY: apiKey, AI_DEFAULT_MODEL: model } = env;
  if (!baseUrl || !apiKey || !model) {
    throw new Error("Configuración de IA incompleta para openai_compatible.");
  }
  return { provider: "openai_compatible", baseUrl, apiKey, model };
}

/** `new URL` sin lanzar: `null` si el valor no es una URL (el campo ya reportó el problema). */
function parseUrl(value: string): URL | null {
  return URL.canParse(value) ? new URL(value) : null;
}

/** `localhost`, `127.x.x.x` o `[::1]`: la conexión no sale de la máquina. */
function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "[::1]" || /^127(\.\d{1,3}){3}$/.test(hostname);
}
