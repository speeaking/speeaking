import { describe, expect, it } from "vitest";
import { composeLooks, type LookCandidate, relevance, swapSlot } from "./composer";
import type { Need } from "./need";
import type { OutfitSlot } from "./slots";

let counter = 0;
function product(
  slot: OutfitSlot,
  priceCents: number,
  title: string,
  tags: string[] = [],
  sellerId = "s1",
): LookCandidate {
  counter += 1;
  return {
    id: `p${String(counter).padStart(3, "0")}`,
    slot,
    priceCents,
    title,
    tags,
    sellerId,
    publishedAt: new Date(2026, 8, counter),
  };
}

const need: Need = {
  occasion: "boda",
  style: "moderno",
  budgetMaxCents: 300_000,
  gender: null,
  timeOfDay: "noche",
  colors: ["negro"],
  keywords: ["boda"],
};

function catalog() {
  counter = 0;
  return [
    product("top", 89_900, "Camisa de vestir negra", ["formal"], "a"),
    product("top", 49_900, "Playera básica blanca", ["algodón"], "b"),
    product("top", 129_900, "Camisa de seda", ["elegante"], "c"),
    product("bottom", 119_900, "Pantalón de vestir slim", ["formal"], "b"),
    product("bottom", 69_900, "Jeans mezclilla", ["casual"], "d"),
    product("shoes", 149_900, "Zapatos oxford negros", ["formal", "vestir"], "e"),
    product("shoes", 99_900, "Tenis blancos minimal", ["moderno", "sneaker"], "f"),
    product("accessory", 59_900, "Reloj minimalista", ["moderno"], "g"),
    product("bag", 39_900, "Mochila urbana", ["street"], "h"),
    product("dress", 199_900, "Vestido negro satinado", ["noche", "elegante"], "i"),
    product("shoes", 89_900, "Mocasines café", ["clasico"], "j"),
  ];
}

describe("compositor de looks (P2)", () => {
  it("arma 3 looks distintos, completos y dentro del presupuesto, mezclando vendedores", () => {
    const looks = composeLooks({ candidates: catalog(), need });
    expect(looks).toHaveLength(3);
    for (const look of looks) {
      expect(look.totalCents).toBeLessThanOrEqual(300_000);
      const slots = look.items.map((item) => item.slot);
      if (look.template === "top-bottom-shoes") {
        expect(slots).toEqual(expect.arrayContaining(["top", "bottom", "shoes"]));
      } else {
        expect(slots).toEqual(expect.arrayContaining(["dress", "shoes"]));
      }
      const sellers = new Set(
        look.items.map((item) => catalog().find((p) => p.id === item.productId)!.sellerId),
      );
      expect(sellers.size).toBeGreaterThan(1);
    }
    // Ningún look repite exactamente a otro (una pieza sí puede aparecer en dos looks).
    const keys = looks.map((look) =>
      look.items
        .map((item) => item.productId)
        .sort()
        .join("|"),
    );
    expect(new Set(keys).size).toBe(looks.length);
  });

  it("es determinista", () => {
    const first = composeLooks({ candidates: catalog(), need });
    const second = composeLooks({ candidates: catalog(), need });
    expect(second).toEqual(first);
  });

  it("prefiere lo que coincide con la ocasión, el estilo y los colores", () => {
    const [top, playera] = catalog();
    expect(relevance(top!, need)).toBeGreaterThan(relevance(playera!, need));
    const looks = composeLooks({ candidates: catalog(), need, count: 1 });
    const firstTop = looks[0]!.items.find((item) => item.slot === "top");
    expect(firstTop?.productId).toBe("p001");
  });

  it("baja de precio piezas para caber en un presupuesto ajustado y descarta lo imposible", () => {
    const tight = composeLooks({
      candidates: catalog(),
      need: { ...need, budgetMaxCents: 220_000 },
    });
    expect(tight.length).toBeGreaterThan(0);
    for (const look of tight) expect(look.totalCents).toBeLessThanOrEqual(220_000);
    expect(
      composeLooks({ candidates: catalog(), need: { ...need, budgetMaxCents: 10_000 } }),
    ).toEqual([]);
  });

  it("sin presupuesto agrega opcionales (reloj, bolsa) sin repetir hueco", () => {
    const [look] = composeLooks({
      candidates: catalog(),
      need: { ...need, budgetMaxCents: null },
      count: 1,
    });
    const slots = look!.items.map((item) => item.slot);
    expect(slots).toContain("accessory");
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("«Completa mi look» fija el producto y elige la plantilla por su hueco", () => {
    const items = catalog();
    const dress = items.find((item) => item.slot === "dress")!;
    const looks = composeLooks({
      candidates: items,
      need: { ...need, budgetMaxCents: null },
      anchor: dress,
    });
    expect(looks.length).toBeGreaterThan(0);
    for (const look of looks) {
      expect(look.template).toBe("dress-shoes");
      expect(look.items.some((item) => item.productId === dress.id)).toBe(true);
      expect(look.items.some((item) => item.slot === "bottom")).toBe(false);
    }
  });

  it("para hombre no propone vestido", () => {
    const looks = composeLooks({ candidates: catalog(), need: { ...need, gender: "hombre" } });
    expect(looks.every((look) => look.template === "top-bottom-shoes")).toBe(true);
  });

  it("cambia una pieza por la siguiente opción o por una más barata, respetando el presupuesto", () => {
    const items = catalog();
    const roomy = { ...need, budgetMaxCents: 400_000 };
    const [look] = composeLooks({ candidates: items, need: roomy, count: 1 });
    const shoes = look!.items.find((item) => item.slot === "shoes")!;
    expect(shoes.productId).toBe("p006");
    const swapped = swapSlot(look!, "shoes", items, roomy);
    expect(swapped).not.toBeNull();
    expect(swapped!.items.find((item) => item.slot === "shoes")!.productId).toBe("p007");
    expect(swapped!.totalCents).toBeLessThanOrEqual(400_000);
    const cheaper = swapSlot(look!, "shoes", items, roomy, "cheaper");
    expect(cheaper!.items.find((item) => item.slot === "shoes")!.priceCents).toBeLessThan(
      shoes.priceCents,
    );
    // Sin otra bolsa en el catálogo no hay con qué cambiarla.
    expect(swapSlot(look!, "bag", items, roomy)).toBeNull();
    // Con un presupuesto al límite, un cambio que no cabe se rechaza en vez de pasarse.
    const [tight] = composeLooks({ candidates: items, need, count: 1 });
    const attempt = swapSlot(tight!, "shoes", items, need);
    if (attempt) expect(attempt.totalCents).toBeLessThanOrEqual(300_000);
  });
});
