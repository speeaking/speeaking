import "server-only";
import { env } from "@/server/env";
import { createStorage, createVideoStore } from "./factory";
import type { StorageProvider } from "./types";
import type { VideoStore } from "./video-store";

let storage: StorageProvider | undefined;
let videoStore: VideoStore | undefined;

/** Proveedor de almacenamiento según STORAGE_DRIVER: `local` (disco) o `s3` (Cloudflare R2). */
export function getStorage(): StorageProvider {
  storage ??= createStorage(env);
  return storage;
}

/** Videos cortos (ADR-062): subida y entrega directas, sin pasar el archivo por la app. */
export function getVideoStore(): VideoStore {
  videoStore ??= createVideoStore(env);
  return videoStore;
}

export type { StorageProvider } from "./types";
export type { VideoStore } from "./video-store";
