# feed

RecommendationEngine (feed "Para ti"), Commerce Engine (intención por categoría) y política de mezcla
comercial configurable (ADR-008). Registra impresiones con posición, puntuación y versión. Fase: 1.5.

**Presentación (rediseño «Revista», F2–F3).** `card-variant.ts` elige cómo se pinta cada pieza
(portada, tipográfica o estándar) sin tocar el ranking ni las posiciones de impresión. El DTO
(`dto.ts`, `toFeedItem`) se arma campo por campo y nunca incluye el costo (prueba en `dto.test.ts`).
`rankCandidates` devuelve la búsqueda que coincidió (`IntentMatch`) para el chip «Porque buscas…», y
«En tu presupuesto» lo calcula `fitsDeclaredBudget` en el servidor (P2).

**Inicio (F5–F6b, ola C).**

- `HomeFeed` junta las burbujas (`CommunityBubbles`) y el feed. Tocar una burbuja filtra con
  `/api/feed?community=` o `?following=1` sin salir de la página. «Siguiendo» (`FeedRequest.following`)
  reutiliza a quién sigue la persona desde su contexto; sin sesión, o si no sigue a nadie, la página
  viene vacía (nunca se rellena).
- Las burbujas aceptan `unread` (communityId → nuevas), que pintan solo si es > 0. Los datos llegan
  con F7.
- `getHomeFirstPage` (`first-page.ts`) guarda la primera página de «Para ti» con `cache()` por
  request. La columna derecha la usa para no repetir en «Lo que buscas» un producto que ya está en
  el feed (`dedupe.ts`).
- `FeedList` intercala bloques (`slots`) sin tocar las posiciones del ranking:
  - «Arma tu feed» del visitante, después de la 2.ª pieza (`xl:hidden`);
  - «Gente de tus comunidades», después de la 6.ª.
- El compositor, la bienvenida («¡Listo, …!», marcada con una cookie breve que se borra al cerrarla; antes era `/?bienvenida=1`, que se quitaba de la URL al
  mostrarse) y los bloques intercalados solo acompañan a «Para ti».
- `home.ts` arma las burbujas, el momento de bienvenida y «Más de {comunidad}» para `/p/[id]`.
