import { describe, expect, it } from "vitest";
import { CREATE_OPTIONS } from "./create-options";
import { siteConfig } from "./site";

describe("CREATE_OPTIONS (menú «Crear»)", () => {
  it("«Sube y vende» describe el flujo real: empieza con una frase y la foto es opcional", () => {
    // Video del 2026-10-02: decía «Sube una foto y pon tu precio», pero el flujo empieza con una
    // frase, la foto es opcional y la IA no la lee.
    const option = CREATE_OPTIONS.find(({ title }) => title === siteConfig.sellerFeatureName);

    expect(option?.description).toBe(
      "Cuéntalo en una frase: te armamos la publicación y tus números.",
    );
    expect(option?.description).not.toMatch(/foto/i);
  });
});
