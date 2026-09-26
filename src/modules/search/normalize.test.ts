import { describe, expect, it } from "vitest";
import {
  FOLD_FROM,
  FOLD_TO,
  foldText,
  likePattern,
  parseSearchQuery,
  SEARCH_MAX_LENGTH,
  SEARCH_MAX_TERMS,
} from "./normalize";

describe("foldText", () => {
  it("quita mayúsculas y acentos del español", () => {
    expect(foldText("Café")).toBe("cafe");
    expect(foldText("PIÑATA")).toBe("pinata");
    expect(foldText("Pingüino")).toBe("pinguino");
    expect(foldText("Árbol Único")).toBe("arbol unico");
  });

  it("también pliega letras escritas en forma descompuesta (NFD)", () => {
    expect(foldText("Cafe\u0301")).toBe("cafe");
    expect(foldText("n\u0303")).toBe("n");
  });

  it("no toca números, emojis ni otros signos", () => {
    expect(foldText("Tenis 42 ⚽ $2,000")).toBe("tenis 42 ⚽ $2,000");
  });

  it("la tabla de la base de datos es simétrica: cada letra tiene su versión simple", () => {
    expect([...FOLD_FROM]).toHaveLength([...FOLD_TO].length);
    expect(FOLD_TO).toMatch(/^[a-z]+$/);
    // Lo que PostgreSQL haría con translate() coincide con foldText para cada letra.
    [...FOLD_FROM].forEach((char, index) => {
      expect(foldText(char)).toBe(FOLD_TO[index]);
    });
  });
});

describe("parseSearchQuery", () => {
  it("devuelve null si no hay nada que buscar", () => {
    expect(parseSearchQuery(undefined)).toBeNull();
    expect(parseSearchQuery(["tenis"])).toBeNull();
    expect(parseSearchQuery("")).toBeNull();
    expect(parseSearchQuery("    ")).toBeNull();
    expect(parseSearchQuery("¿?¡!")).toBeNull();
  });

  it("limpia espacios y conserva el texto original para mostrarlo", () => {
    expect(parseSearchQuery("  Tenis   para  CORRER ")).toEqual({
      text: "Tenis para CORRER",
      terms: ["tenis", "para", "correr"],
    });
  });

  it("quita signos al inicio y al final de cada palabra", () => {
    expect(parseSearchQuery("¿Chilaquiles, verdes?")?.terms).toEqual(["chilaquiles", "verdes"]);
  });

  it("ignora letras sueltas si hay palabras más largas", () => {
    expect(parseSearchQuery("pan y café")?.terms).toEqual(["pan", "cafe"]);
    expect(parseSearchQuery("y")?.terms).toEqual(["y"]);
  });

  it("no repite palabras y respeta el máximo de palabras", () => {
    expect(parseSearchQuery("Café cafe CAFÉ")?.terms).toEqual(["cafe"]);
    const many = parseSearchQuery("uno dos tres cuatro cinco seis siete");
    expect(many?.terms).toHaveLength(SEARCH_MAX_TERMS);
  });

  it("recorta búsquedas demasiado largas", () => {
    const result = parseSearchQuery("a".repeat(200));
    expect(result?.text).toHaveLength(SEARCH_MAX_LENGTH);
  });
});

describe("likePattern", () => {
  it("busca la palabra en cualquier parte", () => {
    expect(likePattern("tenis")).toBe("%tenis%");
  });

  it("escapa los comodines que escribe la persona", () => {
    expect(likePattern("100%")).toBe("%100\\%%");
    expect(likePattern("a_b")).toBe("%a\\_b%");
    expect(likePattern("c:\\x")).toBe("%c:\\\\x%");
  });
});
