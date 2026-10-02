import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MEDIA_WIDTHS } from "@/lib/image-loader";
import { LocalStorageProvider } from "@/server/providers/storage/local-storage";
import { assertSafeKey, InvalidStorageKeyError } from "@/server/providers/storage/types";
import { deleteStoredMedia, variantKey, variantKeys } from "./variant-keys";

const KEY = "images/2026/09/0199a000-0000-7000-8000-00000000000a.webp";

describe("variantKey (ADR-039)", () => {
  it("una clave válida del almacenamiento por ancho, bajo variants/", () => {
    expect(variantKey(KEY, 640)).toBe(
      "variants/w640/images/2026/09/0199a000-0000-7000-8000-00000000000a-webp.webp",
    );
    for (const key of variantKeys(KEY)) expect(assertSafeKey(key)).toBe("image/webp");
    expect(new Set(variantKeys(KEY)).size).toBe(MEDIA_WIDTHS.length);
  });

  it("originales con otra extensión no comparten variante", () => {
    expect(variantKey("seed/a.png", 256)).not.toBe(variantKey("seed/a.webp", 256));
  });

  it("rechaza claves peligrosas", () => {
    expect(() => variantKey("../x.webp", 256)).toThrow(InvalidStorageKeyError);
  });
});

describe("deleteStoredMedia", () => {
  let root: string;
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "speeaking-variants-"));
    storage = new LocalStorageProvider(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("borra del disco el original y todas sus variantes; no toca las de otras fotos", async () => {
    const other = "images/2026/09/0199a000-0000-7000-8000-00000000000f.webp";
    await storage.put(KEY, Buffer.from("original"));
    for (const width of [256, 640, 1600] as const) {
      await storage.put(variantKey(KEY, width), Buffer.from(`w${width}`));
    }
    await storage.put(other, Buffer.from("otra"));
    await storage.put(variantKey(other, 640), Buffer.from("otra w640"));

    await deleteStoredMedia(storage, KEY);

    expect(await storage.get(KEY)).toBeNull();
    for (const key of variantKeys(KEY)) expect(await storage.get(key)).toBeNull();
    expect(await storage.get(other)).not.toBeNull();
    expect(await storage.get(variantKey(other, 640))).not.toBeNull();
    // Sin variantes (nunca se pidieron) tampoco falla.
    await expect(deleteStoredMedia(storage, other)).resolves.toBeUndefined();
    expect(await readdir(join(root, "variants", "w640", "images", "2026", "09"))).toEqual([]);
  });

  it("si un borrado falla, intenta los demás y después lanza el error", async () => {
    const attempted: string[] = [];
    const failing = {
      delete: async (key: string) => {
        attempted.push(key);
        if (key === variantKey(KEY, 384)) throw new Error("disco");
      },
    };

    await expect(deleteStoredMedia(failing, KEY)).rejects.toThrow("disco");
    expect(attempted.sort()).toEqual([KEY, ...variantKeys(KEY)].sort());
  });
});
