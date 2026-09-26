-- SEC-32: índices de trigramas para la búsqueda (`src/modules/search/sql.ts`). `LIKE '%palabra%'`
-- sobre texto plegado (minúsculas y sin acentos) recorría las tablas completas en cada búsqueda.
--
-- Cada índice es sobre la MISMA expresión que usa la consulta, con la misma tabla de plegado
-- (`FOLD_FROM` → `FOLD_TO` en `src/modules/search/normalize.ts`; `sql.test.ts` verifica que coincidan):
-- si cambia una, hay que cambiar la otra o el índice deja de usarse. Prisma no modela índices sobre
-- expresiones: viven solo en esta migración.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- `array_to_string` es STABLE (no se puede indexar). Con `text[]` el resultado solo depende de la
-- entrada, así que esta envoltura sí es IMMUTABLE.
CREATE OR REPLACE FUNCTION "search_tags_text"(tags text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT array_to_string(tags, ' ') $$;

-- Comunidades: nombre y descripción.
CREATE INDEX "communities_search_trgm_idx" ON "communities" USING gin (
  translate(lower("name" || ' ' || "description"),
    'áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncaaaaaaeeeeiiiiooooouuuunc') gin_trgm_ops
);

-- Productos: título y etiquetas.
CREATE INDEX "products_search_trgm_idx" ON "products" USING gin (
  translate(lower("title" || ' ' || "search_tags_text"("tags")),
    'áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncaaaaaaeeeeiiiiooooouuuunc') gin_trgm_ops
);

-- Publicaciones: texto.
CREATE INDEX "posts_search_trgm_idx" ON "posts" USING gin (
  translate(lower("body"),
    'áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncaaaaaaeeeeiiiiooooouuuunc') gin_trgm_ops
);
