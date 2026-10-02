# trust

Confianza y moderación (P14, `docs/product-principles.md`, ADR-036): **riesgo** de falsificación;
nunca acusa ni certifica. Reportes de la comunidad, comprobante privado del vendedor y cola del
equipo en `/admin/moderacion`. Una fila de `AuthenticityCheck` por producto (la revisión vigente,
actualizada en su lugar).

- `rules.ts`: reglas deterministas (P2) con mensajes en español: precio contra la mediana de ≥ 5
  TIENDAS (un precio por tienda: agrupar por persona) o contra la referencia aproximada
  (`reference-prices.ts`), palabras de imitación con marca (`keywords.ts`, `brands.ts`; las negadas
  —«no réplica», «cero clones»— no cuentan), declaración «original» en conflicto, tienda nueva con
  artículo de marca caro, reportes de personas distintas (los descartados no cuentan; solos se
  quedan en riesgo bajo, pero sumados a otra regla pueden subir el nivel, y con él la nota
  «Revisa: …» que ve quien compra, antes de que el equipo los revise). Puntaje 0–1 → LOW / MEDIUM
  (≥ 0.3) / HIGH (≥ 0.6). Si cambian pesos o reglas, sube `RULES_VERSION` (hoy `v2`).
- `status.ts`: estado de la revisión al reevaluar (las decisiones del equipo no se deshacen solas) y
  lo que ve quien compra (`buyerAuthenticityView`: «Autenticidad sin verificar», «Comprobante
  revisado por speeaking», nota neutral). «Comprobante revisado» se pierde si el vendedor cambia QUÉ
  vende (título, etiquetas, categoría o condición: `listingChanged`, lo calcula
  `catalog/service.ts`, que además lo baja a AUTO_CLEAR en la misma transacción de la edición:
  falla cerrada si la reevaluación de después falla) o si al reevaluar sube el puntaje (p. ej. un
  precio mucho menor). Solo a
  lo declarado original se le pide comprobante; con riesgo alto sin declararse original se pide
  corregir la publicación.
- Fotos del comprobante (`proof-media.ts`): las del envío vigente (`proofMediaIds`, índice GIN) y
  las de envíos anteriores (`AuthenticityProofHistory`: una fila por foto y envío, con `submittedAt`
  y `replacedAt`). Reemplazar el comprobante no libera las anteriores (auditoría): todas son
  privadas (`/media` solo a su dueño; el equipo, por `/admin/moderacion/prueba/[id]`, también las
  reemplazadas), nunca se adjuntan a publicaciones ni productos (validación en
  `social/actions.ts` y `catalog/service.ts`, y el trigger `reject_proof_media_link` en
  `post_media`/`product_media` para cualquier otro camino o carrera) y el recolector de huérfanas
  no las borra (`media/README.md`). `submitProof` las bloquea FOR UPDATE (`lockPrivateReadyMedia`)
  y comprueba en otra sentencia que sigan sin adjuntar: con el trigger, adjuntar y guardar como
  comprobante a la vez nunca terminan los dos.
- Verificar exige: comprobante enviado, las mismas fotos que el equipo vio (`proofIds`), que sigan
  existiendo y que la publicación no use palabras de imitación.
- `service.ts`: `refreshAuthenticityCheck` (alta y edición del catálogo, reportes, cambio a
  genérico; serializado por producto), reportes, comprobante del vendedor y acciones del equipo
  (`assertAdmin` + bitácora en `PlatformDecision` con `kind` `moderation.*` / `authenticity.*`).
- `visibility.ts`: filtros `VISIBLE_PRODUCT` y `POST_WITH_VISIBLE_PRODUCT` para toda consulta
  pública (en SQL: `p."moderationStatus" = 'VISIBLE'`). Los usan el feed, Comprar, similares,
  perfiles, tarjetas, búsqueda (`search/sql.ts`), «Lo que buscas» y la actividad de comunidades
  (`discovery/queries.ts`), «N nuevas» (`social/unread.ts`), el carrito (`commerce/cart.ts`: no se
  agrega un oculto y `getCartLines` lo omite, así el checkout nunca lo ve; `countHiddenCartLines` +
  `unavailableCartNotice` arman el aviso de /carrito «Un producto ya no está disponible y lo
  quitamos de tu pedido», `app/(social)/carrito/notice.ts`), el número del carrito en la navegación
  (`identity/session.ts`), los conteos de publicaciones de comunidades nuevas
  (`identity/service.ts`), el selector de producto de /crear/publicacion y `/media`. Regresión
  contra PostgreSQL: `visibility.db.test.ts` y `hidden-leaks.db.test.ts`.
- `buyer-copy.ts`: los textos de autenticidad que ve quien compra, en un solo lugar: la etiqueta y el
  detalle de la ficha (`status.ts`) y «¿Es original?» (`catalog/quick-answers.ts`). `catalog/dto.ts`
  (`buyerAuthenticityOf`) calcula una vez lo que ve quien compra y llena con su `claim`
  `ProductFacts.authenticityClaim`: la respuesta coincide con la ficha en cada estado. El kit de
  anuncios (`ai/ad-kit/facts.ts`, `mayClaimOriginal`) solo permite «original» con ese `claim` en
  `declared` o `reviewed`; sin él, no lo afirma (falla cerrada). Pendiente fuera de este módulo:
  `ai/ad-kit/service.ts` (`toAdKitProduct`) aún no selecciona la revisión ni llena
  `authenticityClaim` (con `buyerAuthenticityOf(row.authenticity, row.authenticityCheck).claim`),
  así que hoy ningún kit dice «original» ni lleva la frase «Original (lo declara el vendedor)».
- `reevaluate.ts` + `scripts/trust-reevaluate.ts` (`pnpm trust:reevaluate`, con `--dry-run`,
  `--batch-size=50` e `--include-unchecked`): después de subir `RULES_VERSION`, reevalúa por tandas
  las revisiones hechas con otra versión (mismo `refreshAuthenticityCheck`). Un «Comprobante
  revisado» con el mismo riesgo o menor se conserva sin reescribirse (sigue con la versión anterior
  y cada corrida lo vuelve a contar como «se conserva»); si el puntaje sube, vuelve a la cola como
  en cualquier reevaluación. `--dry-run` calcula lo mismo sin guardar (anticipa los cambios de
  estado y de riesgo). Los productos sin revisión solo se cuentan, salvo con `--include-unchecked`,
  que los evalúa por primera vez. Idempotente. Primera corrida en la base de desarrollo
  (2026-09-26): 30 revisiones `v1` → `v2`, sin cambios de estado ni de riesgo; 9 productos sin
  revisión (la simulación con `--include-unchecked` los deja en AUTO_CLEAR / LOW; no se corrió).
- `ai-signal.ts` + `ai-runner.ts`: señal OPCIONAL de la IA (tarea `authenticity_text`, ajuste
  `trust.aiSignal.enabled`, apagada por omisión). Solo texto; peso máximo 0.15; nunca decide sola.
  Usa el runner común (`getAIProvider`); en producción, el simulado nunca suma riesgo.
- Límites (`limits.ts`): reportar 10/h y 30/día por cuenta (30/h por IP); comprobante 20/h;
  acciones del equipo 300/h.

Ajustes de plataforma: `trust.aiSignal.enabled` (booleano) y `trust.referencePrices` (lista con el
formato de `referencePricesSchema`; sin ajuste válido se usa la lista del código).

Si cambian reglas, pesos, marcas o palabras: sube `RULES_VERSION` y corre `pnpm trust:reevaluate
--dry-run` para ver qué cambiaría (p. ej. cuántos «Comprobante revisado» volverían a la cola) y
después sin `--dry-run`. Cambiar solo `trust.referencePrices` no sube la versión: esos productos se
reevalúan al editarse o reportarse. Las fotos de comprobante (vigentes y reemplazadas) son privadas
(vendedor y ADMIN), nunca se adjuntan y el recolector de huérfanas (`media/orphans.ts`) nunca las
borra.
