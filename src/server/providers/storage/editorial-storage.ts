import { readFile } from "node:fs/promises";
import { join } from "node:path";
import assets from "../../../../content/editorial/launch-20261003/assets.json";
import { variantKey } from "@/modules/media/variant-keys";
import type { MediaWidth } from "@/lib/image-loader";
import { assertSafeKey, mediaUrl, type StorageProvider } from "./types";

const root = join(process.cwd(), "content", "editorial", "launch-20261003", "images");
const files = new Map<string, string>();
for (const asset of assets) {
  // Esta lista forma parte del despliegue; ninguna ruta recibida del navegador elige un archivo.
  if (!/^[a-z]+$/.test(asset.slug)) throw new Error("Nombre de imagen editorial inválido.");
  files.set(asset.storageKey, `${asset.slug}.webp`);
  for (const width of asset.variants) {
    files.set(variantKey(asset.storageKey, width as MediaWidth), `${asset.slug}-w${width}.webp`);
  }
}

/**
 * Imágenes editoriales inmutables incluidas en el despliegue. `/media` sigue autorizando cada
 * petición con la fila y el adjunto publicados: ocultar o eliminar la publicación corta el acceso.
 * Los archivos no están en `public/` ni tienen una ruta que evite esa autorización. Todas las
 * fotos de personas y tiendas siguen usando el proveedor de disco o bucket configurado.
 */
export class EditorialStorageProvider implements StorageProvider {
  constructor(private readonly storage: StorageProvider) {}

  async get(key: string) {
    const contentType = assertSafeKey(key);
    const file = files.get(key);
    if (!file) return this.storage.get(key);
    return { data: await readFile(join(root, file)), contentType };
  }

  async put(key: string, data: Buffer) {
    assertSafeKey(key);
    if (files.has(key)) throw new Error("Las imágenes editoriales del despliegue son inmutables.");
    return this.storage.put(key, data);
  }

  async delete(key: string) {
    assertSafeKey(key);
    // El original y sus variantes son assets del release. Se retira el acceso borrando la fila
    // de media o su adjunto, nunca modificando archivos compartidos de una función de Vercel.
    if (files.has(key)) return;
    return this.storage.delete(key);
  }

  publicUrl(key: string) {
    return mediaUrl(key);
  }
}
