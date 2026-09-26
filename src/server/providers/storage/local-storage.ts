import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { assertSafeKey, InvalidStorageKeyError, type StorageProvider } from "./types";

/** Guarda archivos en disco (desarrollo). Se sirven con la ruta `/media/[...key]`. */
export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string) {
    assertSafeKey(key);
    const path = resolve(join(this.root, key));
    // Defensa adicional: la ruta final debe quedar dentro de la raíz.
    if (!path.startsWith(this.root + sep)) {
      throw new InvalidStorageKeyError();
    }
    return path;
  }

  async put(key: string, data: Buffer) {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string) {
    const contentType = assertSafeKey(key);
    try {
      return { data: await readFile(this.pathFor(key)), contentType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string) {
    await rm(this.pathFor(key), { force: true });
  }

  publicUrl(key: string) {
    assertSafeKey(key);
    return `/media/${key}`;
  }
}
