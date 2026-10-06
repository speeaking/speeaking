import { describe, expect, it } from "vitest";
import { PUBLIC_PAGES } from "@/app/seo";
import { llmsText } from "./llms";

const data = {
  categories: [{ slug: "decoracion", name: "Decoración y plantas" }],
  communities: [
    { slug: "hogar", name: "Hogar", description: "Deco, plantas, orden y cocina." },
    { slug: "gaming", name: "Gaming", description: null },
  ],
  simulatedPayments: true,
};

describe("llmsText (llms.txt: speeaking para asistentes de IA)", () => {
  it("dice qué es, para quién y dónde, con el formato de llms.txt", () => {
    const text = llmsText(data);

    expect(text.startsWith("# speeaking\n\n> ")).toBe(true);
    expect(text).toContain("México");
    expect(text).toContain("https://www.speeaking.com/comprar/decoracion");
    expect(text).toContain(
      "[Hogar](https://www.speeaking.com/c/hogar): Deco, plantas, orden y cocina.",
    );
    expect(text).toContain("[Gaming](https://www.speeaking.com/c/gaming)\n");
  });

  it("lista todas las páginas públicas del sitemap (si se agrega una, no se olvida)", () => {
    const text = llmsText(data);

    for (const path of PUBLIC_PAGES) {
      expect(text).toContain(`(https://www.speeaking.com${path === "/" ? "/" : path})`);
    }
  });

  it("no promete compras reales mientras los pagos sean simulados", () => {
    expect(llmsText(data)).toContain("los pagos dentro de speeaking aún son simulados");
    expect(llmsText({ ...data, simulatedPayments: false })).not.toContain("simulados");
  });

  it("los textos de comunidades no rompen el formato (una línea, sin enlaces inventados)", () => {
    const text = llmsText({
      ...data,
      communities: [
        { slug: "humor", name: "Humor [y más]", description: "Memes\n\n## Sección falsa" },
      ],
    });

    expect(text).toContain(
      "[Humor (y más)](https://www.speeaking.com/c/humor): Memes ## Sección falsa",
    );
    expect(text).not.toContain("\n## Sección falsa");
  });
});
