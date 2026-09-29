import "server-only";
import { env } from "@/server/env";
import { createStorage } from "./factory";
import type { StorageProvider } from "./types";

let storage: StorageProvider | undefined;

/** Proveedor de almacenamiento según STORAGE_DRIVER: `local` (disco) o `s3` (Cloudflare R2). */
export function getStorage(): StorageProvider {
  storage ??= createStorage(env);
  return storage;
}

export type { StorageProvider } from "./types";
