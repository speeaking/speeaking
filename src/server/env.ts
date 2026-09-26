import "server-only";
import { parseEnv } from "@/lib/env/parse-env";
import { serverEnvSchema } from "./env-schema";

/** Variables de entorno del servidor, validadas al arrancar. Nunca se importan desde el cliente. */
export const env = parseEnv(serverEnvSchema, process.env);
