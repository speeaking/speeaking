# search

Búsqueda global de `/buscar?q=` (barra superior en escritorio, lupa en móvil): comunidades por
nombre y descripción, productos activos con existencias por título y etiquetas, y publicaciones
visibles por su texto. Límites por sección en `SEARCH_LIMITS`.

- **Sin acentos ni mayúsculas, sin extensiones.** `normalize.ts` pliega el texto buscado con una
  tabla (`FOLD_FROM` → `FOLD_TO`) y `sql.ts` pliega las columnas con `translate(lower(col), …)`
  usando la misma tabla, así «cafe» encuentra «Café». Cada palabra debe aparecer (AND).
- **Moderación (P14).** Productos solo `moderationStatus = 'VISIBLE'` y publicaciones sin producto o
  con su producto visible, filtrado en el SQL (también en la ventana sin índice): un oculto no ocupa
  un lugar del `LIMIT` ni aparece en /buscar o /comprar. `trust/hidden-leaks.db.test.ts` lo prueba.
- **SQL parametrizado.** Lo que escribe la persona solo viaja como parámetro (`$n`), nunca dentro
  del texto SQL; los comodines `%` y `_` se escapan. `sql.test.ts` lo verifica.
- **DTOs públicos.** `productCardsByIds` usa una lista blanca de campos: el costo ni se consulta.
  Las publicaciones se hidratan con `hydratePosts` (social).
- **P5.** Cada búsqueda registra `SEARCH` (superficie `DISCOVER`, `metadata.scope = "global"` y los
  resultados por sección, útil para detectar búsquedas sin resultados).
- **Índices de trigramas (SEC-32).** Cada documento plegado tiene un índice GIN `pg_trgm` sobre la
  misma expresión (migración `20260926110000_search_trigram_indexes`; `sql.test.ts` compara ambas y
  `sql.db.test.ts` prueba con `EXPLAIN` que PostgreSQL los usa). La tabla de plegado va como literal
  en el SQL (no como parámetro) para que la expresión coincida con la del índice. Una palabra sin 3
  letras o dígitos ASCII seguidos («tv», «a.b», «жжж»: con `LC_CTYPE` "C" no tiene trigramas) se
  filtra sobre lo que el índice encontró con las demás; si ninguna es indexable, productos y
  publicaciones solo revisan las `UNINDEXED_SEARCH_WINDOW` (2,000) filas más recientes, así el costo
  no crece con la tabla.
- **Después:** búsqueda semántica (pgvector) cuando el volumen lo pida.

## Buscar con una foto (ADR-061)

`/buscar/foto`: la persona elige una foto y ve productos parecidos de las tiendas.

- **La IA describe, el código busca (P2).** `photo-search.ts` pide al modelo hasta 4 cosas que se
  pueden comprar (nombre común en México y color) y las convierte en búsquedas de la más precisa a
  la más general; `photo-search-service.ts` junta hasta 12 productos por cosa con la búsqueda de
  siempre (`listShopProducts`), sin repetir.
- **La foto no se guarda.** El navegador la reduce a 1024 px y el servidor a 768 px en JPEG sin
  metadatos (`resizeForVision`); solo viaja al modelo. En el registro de IA queda que hubo una foto,
  nunca la foto. El modelo tiene prohibido describir o identificar personas.
- **Topes.** Solo con sesión; intentos por hora por cuenta e IP (`SOCIAL_LIMITS.photo`) antes de
  reducir la foto, y la cuota de IA por persona (`PHOTO_SEARCH_LIMITS`, 10 por hora y 20 al día).
- **Modelo.** `AI_VISION_MODEL` o la ruta de `image_search` en `/admin/ia`; sin él, «no disponible».
