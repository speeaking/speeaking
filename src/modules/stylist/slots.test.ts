import { describe, expect, it } from "vitest";
import { classifySlot, isGarmentSlot, slotFromText } from "./slots";

const fashion = (categorySlug: string, title: string, tags: string[] = []) =>
  classifySlot({ categorySlug, parentSlug: "moda", title, tags });

describe("huecos de un look", () => {
  it("la categoría explícita manda", () => {
    expect(fashion("tenis", "Botas de piel")).toBe("shoes");
    expect(fashion("vestidos", "Camisa larga")).toBe("dress");
    expect(fashion("bolsas", "Reloj de bolsillo")).toBe("bag");
    expect(fashion("relojes-y-joyeria", "Reloj plateado")).toBe("accessory");
  });

  it("con «ropa» decide por palabras del título o las etiquetas, sin acentos", () => {
    expect(fashion("ropa", "Camisa blanca de vestir")).toBe("top");
    expect(fashion("ropa", "Pantalón negro slim")).toBe("bottom");
    expect(fashion("ropa", "PANTALONES de mezclilla")).toBe("bottom");
    expect(fashion("ropa", "Vestido negro con top de encaje")).toBe("dress");
    expect(fashion("ropa", "Chamarra tipo camisa")).toBe("outerwear");
    expect(fashion("ropa", "Suéter de lana")).toBe("outerwear");
    expect(fashion("ropa", "Conjunto", ["playera", "algodón"])).toBe("top");
    expect(fashion("ropa", "Calcetas nike", ["calcetas", "nike"])).toBe("accessory");
    expect(fashion("ropa", "Prenda sin pista")).toBeNull();
  });

  it("fuera de moda no hay hueco", () => {
    expect(
      classifySlot({ categorySlug: "audio", parentSlug: "electronica", title: "Camisa", tags: [] }),
    ).toBeNull();
    expect(
      classifySlot({ categorySlug: "hogar", parentSlug: null, title: "Bolsa de tela", tags: [] }),
    ).toBeNull();
  });

  it("las palabras no se cortan: «tenista» no es tenis ni «topología» un top", () => {
    expect(slotFromText("gorra de tenista")).toBe("accessory");
    expect(slotFromText("libro de topología")).toBeNull();
  });

  it("las prendas principales son las que se prueban", () => {
    expect(isGarmentSlot("top")).toBe(true);
    expect(isGarmentSlot("dress")).toBe(true);
    expect(isGarmentSlot("shoes")).toBe(false);
    expect(isGarmentSlot("bag")).toBe(false);
  });
});
