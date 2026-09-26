import "server-only";
import { env } from "@/server/env";
import { LocalStorageProvider } from "./local-storage";
import type { StorageProvider } from "./types";

let storage: StorageProvider | undefined;

/** Proveedor de almacenamiento según STORAGE_DRIVER (hoy solo "local"; S3/R2 en producción). */
export function getStorage(): StorageProvider {
  storage ??= new LocalStorageProvider(env.STORAGE_LOCAL_ROOT);
  return storage;
}

export type { StorageProvider } from "./types";
