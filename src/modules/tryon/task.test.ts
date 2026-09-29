import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_TRY_ON_GARMENTS, tryOnInstructions, tryOnTask } from "./task";

async function solid(width: number, height: number, color: string) {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .webp()
    .toBuffer();
}

describe("tarea de Pruébatelo", () => {
  it("el prompt nombra cada prenda por su hueco, pide conservar a la persona y no lleva datos personales", () => {
    const text = tryOnInstructions([
      {
        image: { data: Buffer.alloc(1), mimeType: "image/webp" },
        title: "Camisa negra",
        slot: "top",
      },
      {
        image: { data: Buffer.alloc(1), mimeType: "image/webp" },
        title: "Tenis blancos",
        slot: "shoes",
      },
    ]);
    expect(text).toContain('Image 2: Parte de arriba — "Camisa negra"');
    expect(text).toContain('Image 3: Calzado — "Tenis blancos"');
    expect(text).toMatch(/Keep the person's face, identity/);
    expect(text).not.toMatch(/@|correo|nombre/i);
  });

  it("manda la foto de la persona primero y a lo más 4 prendas", () => {
    const garment = (title: string) => ({
      image: { data: Buffer.from(title), mimeType: "image/webp" },
      title,
      slot: "top" as const,
    });
    const prompt = tryOnTask.prompt({
      person: { data: Buffer.from("persona"), mimeType: "image/webp" },
      garments: Array.from({ length: 6 }, (_, index) => garment(`prenda ${index}`)),
    });
    expect(prompt.images).toHaveLength(1 + MAX_TRY_ON_GARMENTS);
    expect(prompt.images[0]!.data.toString()).toBe("persona");
  });

  it("el simulador compone una imagen webp con la foto y las prendas", async () => {
    const person = await solid(600, 800, "#8899aa");
    const garment = await solid(400, 400, "#e4007c");
    const result = await tryOnTask.mock({
      person: { data: person, mimeType: "image/webp" },
      garments: [
        { image: { data: garment, mimeType: "image/webp" }, title: "Camisa", slot: "top" },
      ],
    });
    expect(result.mimeType).toBe("image/webp");
    const meta = await sharp(result.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(800);
  });

  it("el simulador no estira una foto diminuta: la rellena hasta un lienzo mínimo", async () => {
    const person = await solid(1, 1, "#8899aa");
    const garment = await solid(400, 400, "#e4007c");
    const result = await tryOnTask.mock({
      person: { data: person, mimeType: "image/png" },
      garments: [
        { image: { data: garment, mimeType: "image/webp" }, title: "Camisa", slot: "top" },
      ],
    });
    const meta = await sharp(result.data).metadata();
    expect(meta.width).toBe(320);
    expect(meta.height).toBe(320);
  });
});
