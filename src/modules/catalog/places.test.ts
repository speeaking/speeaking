import { describe, expect, it } from "vitest";
import {
  aggregateCategoryPlaces,
  aggregatePlaces,
  MEXICAN_STATES,
  MIN_PRODUCTS_FOR_PLACE_PAGE,
  placePath,
  placesWithPage,
  stateBySlug,
  stateFromText,
} from "./places";

describe("estados de México: el texto libre del vendedor se lee como un estado canónico", () => {
  it("son las 32 entidades, cada una con su liga en español sin acentos", () => {
    expect(MEXICAN_STATES).toHaveLength(32);
    expect(new Set(MEXICAN_STATES.map((state) => state.slug)).size).toBe(32);
    for (const state of MEXICAN_STATES) expect(state.slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it.each([
    ["Jalisco", "jalisco"],
    ["jal.", "jalisco"],
    ["  JALISCO ", "jalisco"],
    ["CDMX", "ciudad-de-mexico"],
    ["Ciudad de México", "ciudad-de-mexico"],
    ["ciudad de mexico", "ciudad-de-mexico"],
    ["D.F.", "ciudad-de-mexico"],
    ["Edomex", "estado-de-mexico"],
    ["Estado de México", "estado-de-mexico"],
    ["Edo. Méx.", "estado-de-mexico"],
    ["Nuevo León", "nuevo-leon"],
    ["NL", "nuevo-leon"],
    ["Querétaro", "queretaro"],
    ["Qro", "queretaro"],
    ["Michoacán de Ocampo", "michoacan"],
    ["Veracruz de Ignacio de la Llave", "veracruz"],
    ["Coahuila de Zaragoza", "coahuila"],
    ["BCS", "baja-california-sur"],
    ["Baja California", "baja-california"],
    ["Yucatán", "yucatan"],
    ["Q. Roo", "quintana-roo"],
  ])("«%s» es %s", (text, slug) => {
    expect(stateFromText(text)?.slug).toBe(slug);
  });

  it("lo que no es un estado no se adivina (ni ciudades sueltas ni texto ambiguo)", () => {
    for (const text of ["", "México", "Guadalajara", "Monterrey", "Narnia", "Baja"]) {
      expect(stateFromText(text)).toBeNull();
    }
  });

  it("encuentra el estado por su liga", () => {
    expect(stateBySlug("nuevo-leon")?.name).toBe("Nuevo León");
    expect(stateBySlug("nada")).toBeNull();
  });
});

describe("aggregatePlaces: cuántos productos tiene cada estado, sumando sus variantes", () => {
  it("suma las variantes de un mismo estado y guarda cómo venían escritas", () => {
    const places = aggregatePlaces([
      { state: "CDMX", count: 4 },
      { state: "Ciudad de México", count: 3 },
      { state: "Jalisco", count: 2 },
      { state: "Narnia", count: 9 },
    ]);

    expect(places.get("ciudad-de-mexico")).toEqual({
      state: stateBySlug("ciudad-de-mexico"),
      count: 7,
      values: ["CDMX", "Ciudad de México"],
    });
    expect(places.get("jalisco")?.count).toBe(2);
    // Lo que no es un estado no cuenta para ninguno.
    expect([...places.keys()].sort()).toEqual(["ciudad-de-mexico", "jalisco"]);
  });

  it("una página de estado necesita al menos 6 productos (sin páginas vacías)", () => {
    expect(MIN_PRODUCTS_FOR_PLACE_PAGE).toBe(6);
  });
});

describe("aggregateCategoryPlaces: productos por categoría y estado (la categoría padre suma las hijas)", () => {
  it("cuenta en la categoría y en su padre, con las variantes del estado sumadas", () => {
    const counts = aggregateCategoryPlaces([
      { state: "CDMX", categorySlug: "tenis", parentSlug: "moda", count: 4 },
      { state: "Ciudad de México", categorySlug: "bolsas", parentSlug: "moda", count: 3 },
      { state: "Jalisco", categorySlug: "decoracion", parentSlug: null, count: 6 },
      { state: "Narnia", categorySlug: "decoracion", parentSlug: null, count: 50 },
    ]);

    expect(counts).toEqual(
      new Map([
        ["tenis/ciudad-de-mexico", 4],
        ["moda/ciudad-de-mexico", 7],
        ["bolsas/ciudad-de-mexico", 3],
        ["decoracion/jalisco", 6],
      ]),
    );
  });
});

describe("placesWithPage: los estados que ya tienen página, en orden alfabético", () => {
  it("deja fuera los que tienen menos de 6 productos y ordena como en español", () => {
    const places = aggregatePlaces([
      { state: "Yucatán", count: 6 },
      { state: "Ags", count: 9 },
      { state: "Jalisco", count: 5 },
      { state: "Michoacán", count: 12 },
    ]);

    expect(placesWithPage(places).map((place) => place.state.name)).toEqual([
      "Aguascalientes",
      "Michoacán",
      "Yucatán",
    ]);
    expect(placesWithPage(new Map())).toEqual([]);
  });

  it("arma la ruta en español: por estado o por categoría en un estado", () => {
    expect(placePath("jalisco")).toBe("/comprar/en/jalisco");
    expect(placePath("nuevo-leon", "decoracion")).toBe("/comprar/decoracion/en/nuevo-leon");
  });
});
