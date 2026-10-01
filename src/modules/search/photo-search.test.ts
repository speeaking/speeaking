import { describe, expect, it } from "vitest";
import { itemsToQueries, PHOTO_ITEMS_MAX, photoSearchTask } from "./photo-search";

describe("itemsToQueries (ADR-061)", () => {
  it("convierte lo que vio el modelo en búsquedas con su color, sin repetir", () => {
    expect(
      itemsToQueries({
        items: [
          { name: "Camisa de lino", color: "Blanca" },
          { name: "camisa de lino", color: "blanca" },
          { name: "tenis", color: null },
          { name: "bolsa blanca", color: "blanca" },
        ],
      }),
    ).toEqual([
      {
        label: "Camisa de lino blanca",
        queries: ["camisa de lino blanca", "camisa de lino", "camisa blanca", "camisa"],
      },
      { label: "Tenis", queries: ["tenis"] },
      { label: "Bolsa blanca", queries: ["bolsa blanca", "bolsa"] },
    ]);
  });

  it("no repite el color si el nombre ya lo dice en otro género o número", () => {
    expect(
      itemsToQueries({
        items: [
          { name: "playera blanca", color: "blanco" },
          { name: "tenis blancos", color: "blanco" },
          { name: "jeans", color: "azul marino" },
          { name: "sudadera gris", color: "grises" },
        ],
      }).map((item) => item.queries),
    ).toEqual([
      ["playera blanca", "playera"],
      ["tenis blancos", "tenis"],
      ["jeans azul marino", "jeans"],
      ["sudadera gris", "sudadera"],
    ]);
  });

  it("limpia signos y descarta lo que queda vacío; nunca más de cuatro", () => {
    const items = itemsToQueries({
      items: [
        { name: "<script>", color: null },
        { name: "!!", color: null },
        ...Array.from({ length: 6 }, (_, index) => ({ name: `cosa ${index}`, color: null })),
      ],
    });
    expect(items[0]).toEqual({ label: "Script", queries: ["script"] });
    expect(items).toHaveLength(PHOTO_ITEMS_MAX);
    expect(
      items.flatMap((item) => item.queries).every((query) => /^[\p{L}\p{N}\s-]+$/u.test(query)),
    ).toBe(true);
  });
});

describe("photoSearchTask", () => {
  it("manda la foto como imagen y las reglas prohíben describir personas", () => {
    const messages = photoSearchTask.messages({ image: "data:image/jpeg;base64,AAAA" });
    expect(messages.images).toEqual(["data:image/jpeg;base64,AAAA"]);
    expect(messages.system).toContain("NUNCA describas ni identifiques personas");
  });

  it("el simulador cumple su esquema", () => {
    expect(photoSearchTask.output.parse(photoSearchTask.mock({ image: "" })).items).toHaveLength(2);
  });
});
