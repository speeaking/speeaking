import { describe, expect, it } from "vitest";
import { createPostSchema, MAX_POST_IMAGES } from "./schemas";

const uuid = "0199a000-0000-7000-8000-000000000001";

describe("createPostSchema", () => {
  it("acepta texto solo o imagen sola", () => {
    expect(createPostSchema.safeParse({ body: "Hola", mediaIds: [] }).success).toBe(true);
    expect(createPostSchema.safeParse({ body: "", mediaIds: [uuid] }).success).toBe(true);
  });

  it("rechaza publicaciones vacías", () => {
    expect(createPostSchema.safeParse({ body: "   ", mediaIds: [] }).success).toBe(false);
  });

  it("limita el número de imágenes y valida los identificadores", () => {
    const tooMany = Array.from({ length: MAX_POST_IMAGES + 1 }, () => uuid);
    expect(createPostSchema.safeParse({ body: "x", mediaIds: tooMany }).success).toBe(false);
    expect(createPostSchema.safeParse({ body: "x", mediaIds: ["../../etc"] }).success).toBe(false);
  });
});
