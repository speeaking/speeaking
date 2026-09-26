import { z } from "zod";
import {
  PAYMENT_PROVIDERS,
  SIMULATED_PAYMENT_PROVIDER,
  simulatedPaymentsAllowed,
} from "./providers/payments/policy";

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
    PAYMENT_PROVIDER: z.enum(PAYMENT_PROVIDERS).default("mock"),
    // Pagos simulados en producción: solo para un piloto cerrado, como decisión explícita. En
    // desarrollo y pruebas no hace falta; en producción, sin ella el arranque falla con el simulador.
    ALLOW_SIMULATED_PAYMENTS: z.stringbool({ error: "Debe ser true o false." }).default(false),
  })
  .superRefine((env, ctx) => {
    if (env.PAYMENT_PROVIDER === SIMULATED_PAYMENT_PROVIDER && !simulatedPaymentsAllowed(env)) {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOW_SIMULATED_PAYMENTS"],
        message:
          "Con PAYMENT_PROVIDER=mock en producción nadie paga de verdad. Configura un proveedor real o, solo para un piloto cerrado, ALLOW_SIMULATED_PAYMENTS=true.",
      });
    }
  });

export type ServerEnv = z.output<typeof serverEnvSchema>;
