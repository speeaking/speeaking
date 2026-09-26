# feed

RecommendationEngine (feed "Para ti"), Commerce Engine (intención por categoría) y política de mezcla
comercial configurable (ADR-008). Registra impresiones con posición, puntuación y versión. Fase: 1.5.

**Impresiones: servidas y visibles (T5, ADR-037).** Son dos eventos distintos:

- **Servida** (`IMPRESSION`, `impressions.ts` → `trackImpressions`): el servidor la registra al
  mandar la página, con posición, puntuación, versión del algoritmo y espacio (`slot`), se vea o no.
  Una por persona (o IP), publicación y hora. Es la base para entrenar y evaluar el ranking y el
  comprobante de que la pieza se le sirvió a alguien; como métrica es solo descriptiva
  (`feed.impressions.served`).
- **Visible** (`VISIBLE_IMPRESSION`): la mide el navegador (`components/visible-impressions.ts`,
  `use-visible-impressions.ts`): al menos la mitad de la pieza en pantalla durante 1 segundo
  continuo, con la pestaña a la vista, una vez por pieza y vista de la página. `FeedList` pone
  `data-impression-post` y `data-impression-position` en el contenedor de cada pieza con ranking
  (la posición del ranking, no la de pantalla: los bloques intercalados no la mueven). El navegador
  junta lo visto y lo manda cada 5 s, o con `sendBeacon` al ocultar o dejar la página, a
  `POST /api/impressions`. El servidor (`analytics/visible-impressions.ts`) solo la acepta si la
  pieza se le SIRVIÓ a quien la reporta, copia de la servida la versión y el espacio (nunca del
  navegador) y guarda una por persona (o IP), publicación y día.
- Con qué se decide: el motor de automejora (umbral de tráfico, salvaguardas, analista,
  experimentos) usa SOLO las visibles de personas con sesión; las visibles anónimas y las servidas
  quedan como métricas descriptivas (`analytics/README.md`, `ceo/README.md`).

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
