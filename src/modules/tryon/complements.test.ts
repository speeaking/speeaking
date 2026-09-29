import { describe, expect, it } from "vitest";
import type { CandidateRow } from "@/modules/stylist/queries";
import { suggestComplements } from "./complements";

function candidate(
  id: string,
  categorySlug: string,
  priceCents: number,
  sellerId = "s1",
  withImage = true,
): CandidateRow {
  return {
    id,
    slug: id,
    title: id,
    tags: [],
    priceCents,
    currency: "MXN",
    stock: 3,
    city: "CDMX",
    categorySlug,
    parentSlug: "moda",
    sellerId,
    sellerUserId: `u-${sellerId}`,
    sellerName: `Tienda ${sellerId}`,
    publishedAt: null,
    image: withImage
      ? { url: `/media/${id}`, width: 800, height: 1000, blurDataUrl: null, alt: null }
      : null,
  };
}

const catalog: CandidateRow[] = [
  candidate("pantalon-caro", "pantalones-y-faldas", 1_299, "s2"),
  candidate("pantalon-propio", "pantalones-y-faldas", 899, "s1"),
  candidate("tenis", "tenis", 1_499, "s2"),
  candidate("tenis-sin-foto", "tenis", 500, "s1", false),
  candidate("saco", "chamarras-y-sacos", 2_100, "s2"),
  candidate("bolsa", "bolsas", 899, "s2"),
  candidate("otra-camisa", "camisas-y-blusas", 300, "s1"),
];

describe("«Agrégale…»: complementos de una prenda (ADR-046)", () => {
  it("propone hasta 3 huecos distintos, primero de la misma tienda y luego lo más barato", () => {
    const picks = suggestComplements({ id: "camisa", slot: "top", sellerId: "s1" }, catalog);
    expect(picks.map((pick) => pick.id)).toEqual(["pantalon-propio", "tenis", "saco"]);
    expect(picks.map((pick) => pick.slotLabel)).toEqual([
      "Parte de abajo",
      "Calzado",
      "Abrigo o saco",
    ]);
  });

  it("nunca repite el hueco de la prenda ni propone productos sin foto", () => {
    const picks = suggestComplements({ id: "camisa", slot: "top", sellerId: "s9" }, catalog);
    expect(picks.some((pick) => pick.slot === "top")).toBe(false);
    expect(picks.some((pick) => pick.id === "tenis-sin-foto")).toBe(false);
  });

  it("un vestido pide calzado y bolsa, no partes de arriba", () => {
    const picks = suggestComplements({ id: "vestido", slot: "dress", sellerId: "s2" }, catalog);
    expect(picks.map((pick) => pick.slot)).toEqual(["shoes", "bag", "outerwear"]);
  });
});
