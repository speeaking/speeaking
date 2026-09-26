/** Almacenamiento de archivos (ADR-005): disco local en desarrollo, S3/R2 en producción. */
export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** URL con la que el navegador puede pedir el archivo. */
  publicUrl(key: string): string;
}

export class InvalidStorageKeyError extends Error {
  override name = "InvalidStorageKeyError";
  constructor() {
    super("Clave de almacenamiento inválida");
  }
}

const CONTENT_TYPES = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
  mp4: "video/mp4",
} as const;

/** Claves permitidas: segmentos en minúsculas separados por "/" y una extensión conocida. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*\.(webp|jpg|png|mp4)$/;

/** Valida la clave (impide path traversal) y devuelve su tipo de contenido. */
export function assertSafeKey(key: string): string {
  const match = KEY_PATTERN.exec(key);
  if (!match) {
    throw new InvalidStorageKeyError();
  }
  return CONTENT_TYPES[match[2] as keyof typeof CONTENT_TYPES];
}
