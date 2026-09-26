import { describe, expect, it } from "vitest";
import { FOLD_FROM, FOLD_TO, parseSearchQuery } from "./normalize";
import { communitySearchSql, postSearchSql, productSearchSql, SEARCH_LIMITS } from "./sql";

const builders = [
  ["comunidades", communitySearchSql],
  ["productos", productSearchSql],
  ["publicaciones", postSearchSql],
] as const;

describe.each(builders)("búsqueda de %s", (_name, build) => {
  it("lo escrito por la persona solo viaja como parámetro, nunca dentro del SQL", () => {
    const hostile = "x'); DROP TABLE users; --";
    const query = parseSearchQuery(hostile)!;
    const statement = build(query.terms);

    expect(statement.text).not.toContain("DROP");
    expect(statement.text).not.toContain("users");
    expect(statement.text).not.toContain("x'");
    expect(statement.values).toContain("%drop%");
    expect(statement.values).toContain("%users%");
  });

  it("exige todas las palabras, sin acentos ni mayúsculas en ambos lados", () => {
    const query = parseSearchQuery("Piñata Ñandú")!;
    const statement = build(query.terms);

    expect(statement.values).toContain("%pinata%");
    expect(statement.values).toContain("%nandu%");
    expect(statement.values).toContain(FOLD_FROM);
    expect(statement.values).toContain(FOLD_TO);
    expect(statement.text).toMatch(/translate\(lower\(/);
    expect(statement.text).toMatch(/LIKE \$\d+ AND [\s\S]+ LIKE \$\d+/);
  });

  it("tiene límite propio", () => {
    const statement = build(["tenis"], 3);

    expect(statement.text).toMatch(/LIMIT \$\d+\s*$/);
    expect(statement.values.at(-1)).toBe(3);
  });

  it("no acepta una búsqueda sin palabras", () => {
    expect(() => build([])).toThrow();
  });
});

describe("filtros de visibilidad", () => {
  it("los productos: solo activos y con existencias; el costo ni se menciona", () => {
    const { text } = productSearchSql(["tenis"]);

    expect(text).toContain(`p."status" = 'ACTIVE'`);
    expect(text).toContain(`p."stock" > 0`);
    expect(text).not.toMatch(/cost/i);
  });

  it("las publicaciones: solo publicadas", () => {
    expect(postSearchSql(["receta"]).text).toContain(`p."status" = 'PUBLISHED'`);
  });

  it("los productos de una categoría: el slug también viaja como parámetro", () => {
    const hostile = "audio' OR '1'='1";
    const statement = productSearchSql(["audifonos"], 24, { categorySlug: hostile });

    expect(statement.text).not.toContain("OR '1'");
    expect(statement.text).toContain(`FROM "categories" c`);
    // La categoría o su padre (Electrónica incluye Audio y audífonos).
    expect(statement.values.filter((value) => value === hostile)).toHaveLength(2);
    expect(statement.values.at(-1)).toBe(24);
  });

  it("sin categoría no filtra por categoría", () => {
    expect(productSearchSql(["tenis"]).text).not.toContain("categories");
  });

  it("usa los límites por sección por omisión", () => {
    expect(communitySearchSql(["a"]).values.at(-1)).toBe(SEARCH_LIMITS.communities);
    expect(productSearchSql(["a"]).values.at(-1)).toBe(SEARCH_LIMITS.products);
    expect(postSearchSql(["a"]).values.at(-1)).toBe(SEARCH_LIMITS.posts);
  });
});
