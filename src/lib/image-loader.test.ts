import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import mediaImageLoader, { MEDIA_WIDTHS, snapMediaWidth } from "./image-loader";

const KEY = "/media/images/2026/09/0199a000-0000-7000-8000-00000000000a.webp";

describe("mediaImageLoader (ADR-039)", () => {
  it("pide las fotos subidas a /media con un ancho permitido, nunca a /_next/image", () => {
    expect(mediaImageLoader({ src: KEY, width: 640, quality: 75 })).toBe(`${KEY}?w=640`);
    expect(mediaImageLoader({ src: KEY, width: 1600 })).not.toContain("_next/image");
  });

  it.each([
    [1, 256],
    [32, 256],
    [256, 256],
    [257, 384],
    [384, 384],
    [500, 640],
    [750, 828],
    [828, 828],
    [1080, 1080],
    [1200, 1600],
    [1920, 1600],
    [3840, 1600],
  ])("ancho pedido %i → %i (el permitido que lo cubre; tope 1600)", (requested, expected) => {
    expect(snapMediaWidth(requested)).toBe(expected);
    expect(mediaImageLoader({ src: KEY, width: requested })).toBe(`${KEY}?w=${expected}`);
  });

  it("ignora la calidad: la codificación la decide el servidor", () => {
    expect(mediaImageLoader({ src: KEY, width: 640, quality: 10 })).toBe(
      mediaImageLoader({ src: KEY, width: 640, quality: 100 }),
    );
  });

  it.each([
    "/brand/mark.svg",
    "/icons/icon-192.png",
    "/_next/static/media/logo.1234.png",
    "https://example.com/media/a.webp",
    `${KEY}?v=1`,
    `${KEY}#frag`,
  ])("otras fuentes (y /media con query) quedan tal cual: %s", (src) => {
    expect(mediaImageLoader({ src, width: 640 })).toBe(src);
  });

  it("los anchos de next.config.ts son exactamente MEDIA_WIDTHS, con loader propio", () => {
    const images = nextConfig.images!;
    expect(images.loader).toBe("custom");
    expect(images.loaderFile).toBe("./src/lib/image-loader.ts");
    const configured = [...images.imageSizes!, ...images.deviceSizes!].sort((a, b) => a - b);
    expect(configured).toEqual([...MEDIA_WIDTHS]);
    // Todos los de `imageSizes` son menores que el menor de `deviceSizes` (como espera Next).
    expect(Math.max(...images.imageSizes!)).toBeLessThan(Math.min(...images.deviceSizes!));
    // Si alguien volviera al loader por omisión, el optimizador no aceptaría /media.
    expect(images.localPatterns).toEqual([]);
    expect(images.remotePatterns).toEqual([]);
  });
});
