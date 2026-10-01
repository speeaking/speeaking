import { describe, expect, it } from "vitest";
import { parseProfileEdit, PROFILE_BIO_MAX } from "./profile-edit-schema";

const MEDIA = "0199a000-0000-7000-8000-0000000000f1";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("parseProfileEdit (ADR-058)", () => {
  it("limpia espacios y deja en null la ciudad y la presentación vacías", () => {
    const result = parseProfileEdit(
      form({ displayName: "  Ana López ", city: "  ", bio: "", avatar: "keep", cover: "" }),
    );

    expect(result.success && result.data).toEqual({
      displayName: "Ana López",
      city: null,
      bio: null,
      avatar: { kind: "keep" },
      cover: { kind: "keep" },
    });
  });

  it("entiende poner una foto recién subida y quitar la portada", () => {
    const result = parseProfileEdit(form({ displayName: "Ana", avatar: MEDIA, cover: "remove" }));

    expect(result.success && result.data.avatar).toEqual({ kind: "set", mediaId: MEDIA });
    expect(result.success && result.data.cover).toEqual({ kind: "remove" });
  });

  it("rechaza un nombre corto, uno que suplanta a la plataforma y una presentación larga", () => {
    expect(parseProfileEdit(form({ displayName: "A" })).success).toBe(false);
    expect(parseProfileEdit(form({ displayName: "Equipo Estreno" })).success).toBe(false);
    expect(
      parseProfileEdit(form({ displayName: "Ana", bio: "x".repeat(PROFILE_BIO_MAX + 1) })).success,
    ).toBe(false);
  });

  it("una imagen que no es un id válido es un error, no un cambio", () => {
    const result = parseProfileEdit(form({ displayName: "Ana", avatar: "javascript:alert(1)" }));

    expect(result.success).toBe(false);
  });
});
