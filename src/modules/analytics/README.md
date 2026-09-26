# analytics

`track()`, taxonomía de eventos y atribución (`sourcePostId`) desde el día 1 (ADR-009); métricas del
Studio (beneficio, ventas, visitas, conversión). Fases: 1.5–1.7.

**Integridad de métricas (SEC-20).** `integrity.ts` filtra en `track` antes de guardar: impresiones,
vistas y compartidos cuentan una vez por persona (o IP) y entidad por ventana; los compartidos solo
de publicaciones o productos visibles; `sourcePostId` solo si esa publicación publicada es del
producto; `AI_PROPOSAL_ACCEPTED` solo con una propuesta propia. Una propuesta de la IA simulada
(plantilla sin modelo, ADR-038) no es una generación de IA: sus `AI_PROPOSAL_GENERATED` y
`AI_PROPOSAL_ACCEPTED` no se guardan, y `aiUsage` la cuenta aparte (`ai.requests.simulated`).

**Impresiones visibles (T5, ADR-037).** `VISIBLE_IMPRESSION` es un tipo propio; `IMPRESSION` sigue
siendo la pieza servida. `POST /api/impressions` → `recordVisibleImpressions`
(`visible-impressions.ts`, contrato en `visible-impression-contract.ts`): solo publicaciones
publicadas, no del autor, servidas a quien reporta (con personalización: su `IMPRESSION` de 24 h, de
donde se copian posición, versión y espacio; sin ella: la cubeta de deduplicación de lo servido para
su cuenta o IP; sin sesión ni IP: no más visibles que servidas anónimas en 25 h, más un contador
atómico por publicación para que peticiones simultáneas no lo rebasen sin límite; peor caso, el
doble), una por persona (o IP), publicación y día. Nunca lanza: si la base falla, responde `failed`. `track()` descarta cualquier
`VISIBLE_IMPRESSION` que no venga por aquí. `platform-aggregates.ts` cuenta las visibles
(`FEED_IMPRESSIONS_ARE_VISIBLE = true`) y aparte las servidas.

**Con qué decide el motor (ADR-037).** Solo con personas con sesión (y personalización; sin ella los
eventos quedan anónimos y no se distinguen de un visitante sin cuenta): `signedInFeedTotals` y
`personFeedActivity` cuentan las impresiones visibles con persona y, en los numeradores (reportes,
«No me interesa», interacciones, visitas desde el feed), solo lo de esas mismas personas. Eso
alimenta el umbral de tráfico, las salvaguardas, la exposición mínima del monitor, el analista y los
experimentos. Lo anónimo queda en métricas descriptivas (`feed.impressions.visible.anonymous`,
`feed.impressions.served`, `product.visits`): un robot sin cuenta puede inflarlas, pero no forzar ni
esconder una reversión.
