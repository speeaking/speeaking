import type { ServerEnv } from "@/server/env-schema";
import { EditorialStorageProvider } from "./editorial-storage";
import { LocalStorageProvider } from "./local-storage";
import { type S3StorageConfig, S3StorageProvider } from "./s3-storage";
import type { StorageProvider } from "./types";
import { LocalVideoStore, S3VideoStore, type VideoStore } from "./video-store";

export type StorageEnv = Pick<
  ServerEnv,
  | "STORAGE_DRIVER"
  | "STORAGE_LOCAL_ROOT"
  | "S3_ENDPOINT"
  | "S3_BUCKET"
  | "S3_REGION"
  | "S3_ACCESS_KEY_ID"
  | "S3_SECRET_ACCESS_KEY"
>;

/**
 * El proveedor según `STORAGE_DRIVER` (ADR-005, ADR-040). Sin `server-only`: los scripts de la
 * terminal (limpiezas, seed) pueden usar el mismo almacenamiento que la app con
 * `createStorage(parseEnv(serverEnvSchema, process.env))`.
 */
export function createStorage(env: StorageEnv): StorageProvider {
  switch (env.STORAGE_DRIVER) {
    case "local":
      return new EditorialStorageProvider(new LocalStorageProvider(env.STORAGE_LOCAL_ROOT));
    case "s3":
      return new EditorialStorageProvider(new S3StorageProvider(s3StorageConfig(env)));
  }
}

/** Dónde viven los videos (ADR-062): el mismo disco o bucket que las fotos. */
export function createVideoStore(env: StorageEnv): VideoStore {
  switch (env.STORAGE_DRIVER) {
    case "local":
      return new LocalVideoStore(env.STORAGE_LOCAL_ROOT);
    case "s3":
      return new S3VideoStore(s3StorageConfig(env));
  }
}

/**
 * Configuración del bucket con tipos estrechos. Con `STORAGE_DRIVER=s3` el esquema ya garantiza los
 * datos; lanza si se llama con un objeto que no pasó por `serverEnvSchema` y le falta algo.
 */
export function s3StorageConfig(env: StorageEnv): S3StorageConfig {
  const {
    S3_ENDPOINT: endpoint,
    S3_BUCKET: bucket,
    S3_REGION: region,
    S3_ACCESS_KEY_ID: accessKeyId,
    S3_SECRET_ACCESS_KEY: secretAccessKey,
  } = env;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Configuración de almacenamiento S3 incompleta.");
  }
  return { endpoint, bucket, region, accessKeyId, secretAccessKey };
}
