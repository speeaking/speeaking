-- Solo nombre y usuario públicos. Misma expresión de plegado que personSearchSql.
-- No cambia cuentas, contenido ni permisos; el índice sirve búsquedas parciales con 3+ letras.
CREATE INDEX "profiles_public_search_trgm_idx" ON "profiles" USING gin (
  translate(lower("displayName" || ' ' || "username"),
    'áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncaaaaaaeeeeiiiiooooouuuunc') gin_trgm_ops
) WHERE "onboardedAt" IS NOT NULL AND "isEditorial" = false;
