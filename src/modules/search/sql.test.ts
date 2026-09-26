import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOLD_FROM, FOLD_TO, parseSearchQuery } from "./normalize";
import {
  communitySearchSql,
  isIndexableTerm,
  MIN_INDEXED_TERM_LENGTH,
  postSearchSql,
  productSearchSql,
  SEARCH_LIMITS,
  UNINDEXED_SEARCH_WINDOW,
} from "./sql";

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
    // La tabla de plegado es una constante del código: va como literal para que coincida con el
    // índice de trigramas (un parámetro `$n` no coincidiría en un plan genérico).
    expect(statement.text).toContain(`'${FOLD_FROM}', '${FOLD_TO}'`);
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

/** `translate(lower(<doc>), '…', '…')` sin alias, comillas ni espacios, para comparar con la migración. */
function foldedExpressions(sql: string) {
  const pattern = /translate\(lower\((?:[^()]|\([^()]*\))*\), '[^']*', '[^']*'\)/g;
  return [...sql.matchAll(pattern)].map(([expression]) =>
    expression
      .replace(/\b[cp]\./g, "")
      .replaceAll('"', "")
      .replace(/\s+/g, ""),
  );
}

describe("índices de trigramas (SEC-32)", () => {
  const migration = readFileSync(
    new URL(
      "../../../prisma/migrations/20260926110000_search_trigram_indexes/migration.sql",
      import.meta.url,
    ),
    "utf8",
  )
    .replaceAll('"', "")
    .replace(/\s+/g, "");

  it.each(builders)(
    "la expresión que busca en %s es exactamente la del índice (misma tabla de plegado)",
    (_name, build) => {
      // La primera expresión plegada es el documento del WHERE (la segunda, la del ORDER BY).
      const [document] = foldedExpressions(build(["tenis"]).text);

      expect(document).toBeDefined();
      expect(migration).toContain(`${document}gin_trgm_ops`);
    },
  );

  it("las palabras cortas no usan la expresión indexada (no obligan a recorrer todo el índice)", () => {
    const { text, values } = productSearchSql(["funda", "xl"]);

    expect(MIN_INDEXED_TERM_LENGTH).toBe(3);
    expect(values).toEqual(expect.arrayContaining(["%funda%", "%xl%"]));
    expect(text).toMatch(/\) LIKE \$\d+ AND \(translate\(lower\([\s\S]+\) \|\| ''\) LIKE \$\d+/);
    expect(values).not.toContain(UNINDEXED_SEARCH_WINDOW);
  });

  it("solo cuenta como indexable una palabra con 3 letras o dígitos ASCII seguidos (trigrama)", () => {
    expect(["tenis", "ab1", "funda"].map(isIndexableTerm)).toEqual([true, true, true]);
    // Con LC_CTYPE "C", pg_trgm no arma trigramas con letras no ASCII ni a través de signos.
    expect(["tv", "жжж", "ßßß", "a.b", "q-z"].map(isIndexableTerm)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it.each(builders)("en %s, «жжж» (sin trigramas) no usa la expresión indexada", (_name, build) => {
    const { text } = build(["жжж"]);

    expect(text).toMatch(/\(translate\(lower\([\s\S]+\) \|\| ''\) LIKE \$\d+/);
  });

  it("sin palabras indexables, productos y publicaciones solo revisan las filas más recientes", () => {
    for (const statement of [postSearchSql(["tv"]), productSearchSql(["жжж", "xl"])]) {
      expect(statement.text).toMatch(/FROM \(\s*SELECT r\."id"[\s\S]+LIMIT \$\d+\s*\) p/);
      expect(statement.values).toContain(UNINDEXED_SEARCH_WINDOW);
      // El límite de resultados sigue siendo el último parámetro.
      expect(statement.text).toMatch(/LIMIT \$\d+\s*$/);
    }
    // Con una palabra indexable, la tabla completa (el índice la acota).
    expect(postSearchSql(["tv", "tenis"]).values).not.toContain(UNINDEXED_SEARCH_WINDOW);
  });

  it("con categoría y sin palabras indexables, la ventana es de esa categoría", () => {
    const statement = productSearchSql(["tv"], 24, { categorySlug: "electronica" });

    expect(statement.text).toMatch(/r\."categoryId" IN \([\s\S]+\)\s+ORDER BY r\."id" DESC/);
    expect(statement.text).not.toContain(`p."categoryId"`);
    expect(statement.values.filter((value) => value === "electronica")).toHaveLength(2);
  });
});
