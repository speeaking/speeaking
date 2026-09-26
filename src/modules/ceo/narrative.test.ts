import { describe, expect, it, vi } from "vitest";
import { isGroundedNarrative, type NarrativeFacts, writeNarrative } from "./narrative";

const facts: NarrativeFacts = {
  title: "Espaciar las piezas comerciales (4 posiciones → 5 posiciones)",
  hypothesis: "La conversión comercial bajó 25 %.",
  expectedImpact: "Recuperar la conversión comercial.",
  numbers: { recent: 0.015, baseline: 0.02, relativeChange: -0.25, recentSample: 20000 },
};

describe("narrativa del analista (la IA solo redacta)", () => {
  it("sin IA usa la plantilla determinista", async () => {
    expect(await writeNarrative(facts)).toEqual({
      source: "template",
      text: "La conversión comercial bajó 25 %. Recuperar la conversión comercial.",
    });
  });

  it("acepta un texto de la IA que solo cita cifras calculadas por código", async () => {
    const narrate = vi.fn(async () => ({
      text: "La conversión pasó de 2 % a 1.5 % con 20,000 impresiones: una baja de 25 %.",
      model: "qwen3.5-9b",
    }));
    expect(await writeNarrative(facts, narrate)).toEqual({
      source: "ai",
      text: "La conversión pasó de 2 % a 1.5 % con 20,000 impresiones: una baja de 25 %.",
      model: "qwen3.5-9b",
    });
  });

  it("descarta cifras escritas con letra, dígitos de otros sistemas y promesas", () => {
    for (const text of [
      "Las visitas se duplicarán.",
      "La conversión subirá veinte por ciento.",
      "Bajó a la mitad.",
      "Habrá mil ventas más.",
      "La conversión bajó ٢٥ %.",
      "Esto garantiza más ventas.",
      "Sin duda recupera la conversión.",
    ]) {
      expect(isGroundedNarrative(text, facts), text).toBe(false);
    }
    // «por mil» es la unidad de las métricas y «una» es artículo: se aceptan.
    expect(
      isGroundedNarrative("Hubo una baja de 25 % en los reportes por mil impresiones.", facts),
    ).toBe(true);
  });

  it("descarta el texto de la IA si inventa una cifra, trae una liga o falla", async () => {
    expect(isGroundedNarrative("Subirá 40 % las ventas.", facts)).toBe(false);
    expect(isGroundedNarrative("Mira https://ejemplo.com", facts)).toBe(false);
    const invented = vi.fn(async () => ({ text: "Esto dará 300 ventas más." }));
    expect((await writeNarrative(facts, invented)).source).toBe("template");
    const broken = vi.fn(async () => {
      throw new Error("timeout");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await writeNarrative(facts, broken)).source).toBe("template");
    expect((await writeNarrative(facts, async () => null)).source).toBe("template");
  });
});
