import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "./local-storage";
import { InvalidStorageKeyError } from "./types";

describe("LocalStorageProvider", () => {
  let root: string;
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "speeaking-storage-"));
    storage = new LocalStorageProvider(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("guarda y recupera un archivo con su tipo de contenido", async () => {
    await storage.put("images/2026/09/foto.webp", Buffer.from("datos"));

    const file = await storage.get("images/2026/09/foto.webp");

    expect(file?.data.toString()).toBe("datos");
    expect(file?.contentType).toBe("image/webp");
  });

  it("devuelve null si el archivo no existe", async () => {
    expect(await storage.get("images/no-existe.webp")).toBeNull();
  });

  it("borra archivos sin fallar si ya no existen", async () => {
    await storage.put("images/borrar.webp", Buffer.from("x"));
    await storage.delete("images/borrar.webp");
    await storage.delete("images/borrar.webp");

    expect(await storage.get("images/borrar.webp")).toBeNull();
  });

  it("expone una URL pública bajo /media", () => {
    expect(storage.publicUrl("images/a.webp")).toBe("/media/images/a.webp");
  });

  it.each(["../secreto.webp", "images/../../x.webp", "/abs.webp", "images\\x.webp", "a.exe", ""])(
    "rechaza la clave peligrosa o inválida %j",
    async (key) => {
      await expect(storage.put(key, Buffer.from("x"))).rejects.toBeInstanceOf(
        InvalidStorageKeyError,
      );
      await expect(storage.get(key)).rejects.toBeInstanceOf(InvalidStorageKeyError);
    },
  );
});
