import { describe, expect, it } from "vitest";
import { splitByOwner } from "./owner-cases";

const ANA = "0199a000-0000-7000-8000-0000000000a1";
const LUIS = "0199a000-0000-7000-8000-0000000000a2";

const post = (id: string, ownerId: string, url = `https://www.speeaking.com/p/${id}`) => ({
  targetType: "POST" as const,
  targetId: id,
  ownerId,
  url,
});

describe("un caso por cada cuenta que subió lo señalado", () => {
  it("todo de una sola cuenta (o nada de speeaking): un solo caso con todas las direcciones", () => {
    const a = post("p1", ANA);
    const b = post("p2", ANA);
    expect(
      splitByOwner([
        { raw: "speeaking.com/p/p1", targets: [a] },
        { raw: "https://otro.example/x", targets: [] },
        { raw: "speeaking.com/p/p2", targets: [b] },
      ]),
    ).toEqual([
      {
        urls: ["speeaking.com/p/p1", "https://otro.example/x", "speeaking.com/p/p2"],
        targets: [a, b],
      },
    ]);
    expect(splitByOwner([{ raw: "https://otro.example/x", targets: [] }])).toEqual([
      { urls: ["https://otro.example/x"], targets: [] },
    ]);
  });

  it("varias cuentas: un caso para cada una, en el orden en que aparecen", () => {
    const ana = post("p1", ANA);
    const luis = post("p2", LUIS);
    const cases = splitByOwner([
      { raw: "https://otro.example/x", targets: [] },
      { raw: "speeaking.com/p/p2", targets: [luis] },
      { raw: "speeaking.com/p/p1", targets: [ana] },
    ]);

    expect(cases).toEqual([
      // Lo que no apunta a nada de speeaking acompaña al primer caso (el equipo lo ve igual).
      { urls: ["https://otro.example/x", "speeaking.com/p/p2"], targets: [luis] },
      { urls: ["speeaking.com/p/p1"], targets: [ana] },
    ]);
  });

  it("lo mismo señalado dos veces cuenta una vez; una dirección de dos cuentas va en ambos casos", () => {
    const ana = post("p1", ANA);
    const anaAgain = post("p1", ANA, "https://www.speeaking.com/media/foto.webp");
    const luis = post("p2", LUIS, "https://www.speeaking.com/media/foto.webp");
    const cases = splitByOwner([
      { raw: "speeaking.com/p/p1", targets: [ana] },
      { raw: "speeaking.com/media/foto.webp", targets: [anaAgain, luis] },
    ]);

    expect(cases).toEqual([
      { urls: ["speeaking.com/p/p1", "speeaking.com/media/foto.webp"], targets: [ana] },
      { urls: ["speeaking.com/media/foto.webp"], targets: [luis] },
    ]);
  });
});
