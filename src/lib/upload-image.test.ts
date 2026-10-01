import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IMAGE_NOT_REDUCIBLE,
  IMAGE_TOO_HEAVY,
  MAX_SEND_BYTES,
  prepareImageUpload,
  uploadErrorMessage,
} from "./upload-image";

const MB = 1024 * 1024;

function fileOf(size: number, type = "image/jpeg") {
  const file = new File(["x"], "foto.jpg", { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** Navegador falso: una foto de 4000×3000 y un lienzo que «codifica» con los tamaños dados. */
function stubBrowser(encodedSizes: number[]) {
  const drawn: { width: number; height: number }[] = [];
  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 4000, height: 3000, close })),
  );
  vi.stubGlobal("document", {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: "",
          fillRect: vi.fn(),
          drawImage: () => drawn.push({ width: canvas.width, height: canvas.height }),
        }),
        toBlob: (resolve: (blob: Blob | null) => void, type: string) => {
          const blob = new Blob(["y"], { type });
          Object.defineProperty(blob, "size", { value: encodedSizes.shift() ?? 1 });
          resolve(blob);
        },
      };
      return canvas;
    },
  });
  return { drawn, close };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prepareImageUpload", () => {
  it("una foto ligera se manda tal cual (el servidor la re-codifica igual)", async () => {
    const file = fileOf(2 * MB);
    await expect(prepareImageUpload(file)).resolves.toEqual({ ok: true, file });
  });

  it("una pesada se reduce a 2560 px en JPEG antes de mandarla (Vercel corta en 4.5 MB)", async () => {
    const { drawn, close } = stubBrowser([1.5 * MB]);

    const result = await prepareImageUpload(fileOf(12 * MB));

    expect(result.ok && result.file.type).toBe("image/jpeg");
    expect(result.ok && result.file.size).toBe(1.5 * MB);
    expect(drawn).toEqual([{ width: 2560, height: 1920 }]);
    expect(close).toHaveBeenCalled();
  });

  it("si a 2560 px sigue pesando, prueba a 1600 px con más compresión", async () => {
    const { drawn } = stubBrowser([5 * MB, 2 * MB]);

    const result = await prepareImageUpload(fileOf(30 * MB));

    expect(result.ok && result.file.size).toBe(2 * MB);
    expect(drawn.map((size) => size.width)).toEqual([2560, 1600]);
  });

  it("sin poder leerla: cabe y se manda tal cual, o se dice antes de intentarlo", async () => {
    // Sin `createImageBitmap` (o con HEIC en Chrome) no se puede reducir.
    const fits = fileOf(MAX_SEND_BYTES - 1);
    await expect(prepareImageUpload(fits)).resolves.toEqual({ ok: true, file: fits });
    await expect(prepareImageUpload(fileOf(6 * MB, "image/heic"))).resolves.toEqual({
      ok: false,
      error: IMAGE_NOT_REDUCIBLE,
    });
  });

  it("más de 40 MB ni se intenta leer", async () => {
    await expect(prepareImageUpload(fileOf(41 * MB))).resolves.toEqual({
      ok: false,
      error: IMAGE_TOO_HEAVY,
    });
  });
});

describe("uploadErrorMessage", () => {
  it("un 413 sin cuerpo (Vercel o el corte de SEC-03) dice que pesa demasiado", () => {
    expect(uploadErrorMessage(413)).toBe("La imagen es demasiado pesada. Prueba con otra.");
    expect(uploadErrorMessage(500)).toBe("No pudimos subir la imagen.");
  });
});
