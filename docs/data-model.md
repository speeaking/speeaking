# Modelo de datos

Diseño completo. Las tablas se crean en la fase que las usa; la fuente de verdad del esquema vigente es
`prisma/schema.prisma`. Marcadas con (\*) las entidades que no estaban en la especificación original.

## Convenciones

- **IDs:** UUIDv7 (ordenables por tiempo, buena localidad en índices).
- **Tiempo:** `createdAt` / `updatedAt` en todas las tablas mutables, `timestamptz` en UTC.
- **Dinero:** centavos en `Int` + `currency` (default `MXN`). Máximo por valor: ~$21.4 M MXN.
- **Estados** con enums en lugar de borrado físico para contenido moderable.
- **Contadores denormalizados** (`likeCount`, `commentCount`, `saveCount`) actualizados en la misma
  transacción que la acción, para no hacer `COUNT(*)` al pintar el feed.
- **Privacidad:** el costo del producto vive en `ProductCost`; la ubicación pública es ciudad/estado.

## Sprint 1

### Identidad

| Entidad                              | Campos clave                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `User`                               | id, name, email (único), emailVerified, image — administrada por Better Auth                                                                                                                                                                                                         |
| `Session`, `Account`, `Verification` | tablas de Better Auth                                                                                                                                                                                                                                                                |
| `Profile`                            | userId (único), username (único, minúsculas), displayName, bio, avatarUrl, city, state, goals[], personalizationEnabled, isEditorial, **discoverable** («Aparecer en sugerencias» de «Gente de tus comunidades», activo por omisión), **role** (USER, ADMIN; ver abajo), onboardedAt |
| `SellerProfile`                      | userId (único), displayName, description, city, state, acceptedPaymentMethods[], status                                                                                                                                                                                              |
| `UserConsent` (\*)                   | userId, type (TERMS, PRIVACY_NOTICE, PERSONALIZATION, **DISCOVERABILITY**), version, granted, createdAt — historial inmutable: cada cambio de «Aparecer en sugerencias» agrega un registro                                                                                           |

### Social y comunidades

| Entidad                    | Campos clave                                                                                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Community` (\*)           | slug (único), name, description, emoji, hue (0–360, color de la comunidad), sortOrder, isOfficial, memberCount (denormalizado)                                                                                                                                              |
| `CommunityCategory` (\*)   | communityId + categoryId — conecta interés social con categorías de producto                                                                                                                                                                                                |
| `CommunityMembership` (\*) | userId + communityId, createdAt                                                                                                                                                                                                                                             |
| `Post`                     | authorId, communityId?, type (POST, VIDEO, PRODUCT), body, productId?, status, isEditorial, isAiGenerated, likeCount, commentCount, saveCount, publishedAt                                                                                                                  |
| `Media`                    | ownerId, kind (IMAGE, VIDEO), storageKey, mimeType, width, height, sizeBytes, blurDataUrl, altText, status · **crédito de fotos de terceros** (stock con licencia libre): creditName, creditUrl (autor y su perfil), sourceUrl (foto original), license (p. ej. «Unsplash») |
| `PostMedia` (\*)           | postId + mediaId, position                                                                                                                                                                                                                                                  |
| `Like`                     | userId + postId (PK compuesta)                                                                                                                                                                                                                                              |
| `Comment`                  | postId, authorId, body, status                                                                                                                                                                                                                                              |
| `Follow`                   | followerId + followingId (PK compuesta)                                                                                                                                                                                                                                     |
| `SuggestionDismissal` (\*) | userId + targetUserId (PK compuesta), createdAt — «Quitar» en «Gente de tus comunidades»: esa persona no se vuelve a sugerir                                                                                                                                                |
| `SavedItem`                | userId, postId? / productId? (exactamente uno), único por usuario y objetivo                                                                                                                                                                                                |

### Catálogo

| Entidad             | Campos clave                                                                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Category`          | slug (único), name, parentId? (jerárquica), sortOrder                                                                                                                                                                                     |
| `Product`           | sellerId, slug (único), title, description, priceCents, currency, stock, status (DRAFT, ACTIVE, PAUSED, SOLD_OUT, ARCHIVED), condition, categoryId, tags[], city, state                                                                   |
|                     | **Datos verificables (P4):** pickupAvailable, localDeliveryAvailable, localDeliveryZones[], nationalShippingAvailable, shippingPriceCents?, deliveryMinDays, deliveryMaxDays, warrantyType, warrantyDays?, returnWindowDays, authenticity |
| `ProductCost` (\*)  | productId (PK), unitCostCents — nunca sale del servidor salvo para su dueño                                                                                                                                                               |
| `ProductMedia` (\*) | productId + mediaId, position                                                                                                                                                                                                             |

### IA, eventos y plataforma

| Entidad                 | Campos clave                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AIRequest`             | userId, feature, provider, model, promptVersion, input (JSON saneado), status, latencyMs                                                                                                                                                                                        |
| `AIResponse`            | requestId (único), output (JSON validado), inputTokens, outputTokens, costMicrosUsd                                                                                                                                                                                             |
| `AnalyticsEvent`        | type, userId?, anonymousId?, entityType, entityId?, sourcePostId?, surface, position?, score?, algorithmVersion?, query?, metadata (JSON)                                                                                                                                       |
| `PlatformSetting` (\*)  | key (único), value (JSON validado por esquema), version, updatedBy                                                                                                                                                                                                              |
| `PlatformDecision` (\*) | actor (AI, HUMAN), kind, hypothesis, settingKey?, previousValue?, newValue?, status (PROPOSED, APPROVED, APPLIED, REVERTED, REJECTED), riskLevel, measuredImpact (JSON) · desde 2026-09-26: guardrails, evaluation, autoApplied, reason, experimentId, approvedById (ver abajo) |

## Sprint 2 — Comprar

| Entidad                    | Campos clave                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cart` / `CartItem`        | userId (único) · productId, quantity, sourcePostId?                                                                                                                                     |
| `Address` (\*)             | userId, recipientName, phone, street, number, neighborhood (colonia), city, state, postalCode, references                                                                               |
| `Checkout` (\*)            | buyerId, status, totalCents — agrupa las órdenes de un pago                                                                                                                             |
| `Order`                    | checkoutId, buyerId, sellerId, status, subtotalCents, shippingCents, platformFeeCents, totalCents, shippingAddress (snapshot)                                                           |
| `OrderItem`                | orderId, productId, titleSnapshot, unitPriceCents, unitCostCents (snapshot privado para el beneficio), quantity, commissionBps, sourcePostId?                                           |
| `Payment`                  | checkoutId, provider, providerRef (único), status, amountCents, method                                                                                                                  |
| `PaymentEvent` (\*)        | provider + providerEventId (único) — idempotencia de webhooks                                                                                                                           |
| `Report` (\*)              | Creado el 2026-09-26: ver «Administración, automejora y moderación»                                                                                                                     |
| `PlatformLedgerEntry` (\*) | kind (COMMISSION, SUBSCRIPTION, PROMOTION, AI_PREMIUM, AI_COST, INFRA_COST, PAYMENT_FEE), amountCents, currency, reference, occurredAt — economía de la plataforma y cobertura de la IA |

## Agregado en el rediseño y la auditoría (2026-09-25/26)

| Entidad o campo                                | Para qué                                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Media.creditName/creditUrl/sourceUrl/license` | Crédito de las fotos de stock con licencia libre (semilla)                                                                                                       |
| `Profile.discoverable`                         | «Aparecer en sugerencias» (Gente de tus comunidades); consentimiento `DISCOVERABILITY`                                                                           |
| `SuggestionDismissal`                          | userId + targetUserId (único): sugerencias que la persona quitó                                                                                                  |
| `CommunityMembership.lastSeenAt`               | «N nuevas» por comunidad                                                                                                                                         |
| `RateLimitBucket`                              | key (PK, sin datos personales: correos en sha256), count, expiresAt — limitador atómico propio (`src/server/rate-limit.ts`), separado de la tabla de Better Auth |
| Índices trigram (`pg_trgm`)                    | Búsqueda global en comunidades, publicaciones y productos sobre la misma expresión normalizada que usa `src/modules/search`                                      |

## Administración, automejora y moderación (2026-09-26)

Migración `ai_ceo_authenticity` (y `visible_impressions`, que solo agrega un tipo de evento, y
`proof_media_protection`: bitácora de comprobantes y su trigger). Sirve a tres frentes: el motor
de automejora (IA CEO), la moderación con revisión de autenticidad y la elección de modelo de IA
por evaluación. Las restricciones que Prisma no modela (CHECK e índice
parcial) viven solo en la migración. Decisiones: ADR-035 (rol), ADR-036 (autenticidad), ADR-037
(impresiones visibles y salvaguardas) y ADR-034 (evaluaciones).

### Rol de equipo (ADR-035)

| Entidad o campo               | Para qué                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserRole` (USER, ADMIN)      | Rol de equipo.                                                                                                                                                                                                                                                                                                                                                               |
| `Profile.role` (default USER) | Vive en `Profile` y no en `User`: Better Auth escribe `users` (registro, `update-user`, hooks) y su plugin `admin` usa un `role` de texto propio; en `Profile` ningún camino de Better Auth lo toca. Solo lo cambia `scripts/make-admin.ts`; ninguna acción, formulario ni DTO de escritura lo expone. Exige perfil: una cuenta sin bienvenida terminada no puede ser ADMIN. |

### Motor de automejora

| Entidad                  | Campos clave                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DailyMetric` (\*)       | day (`date`), key, dimension (default `""` = total), value (Float), sampleSize (Int, CHECK ≥ 0), único por (day, key, dimension). **Día = día calendario de America/Mexico_City**: de 00:00 a 24:00 hora del centro = de 06:00Z a 06:00Z del día siguiente (sin horario de verano desde 2022; calcúlalo con la zona, no con +6 fijo). Se recalcula con upsert: la tarea es idempotente. Llaves: `feed.impressions.visible`, `feed.commerce.ctr`, `sellers.active`, `reports.count`, `not_interested.count`, `product.visits.per_active_seller`… Corte en `dimension`: `variant:<experimento>:<variante>`, `community:<slug>`. `value` es un agregado calculado por código (P2), nunca por la IA.         |
| `Experiment` (\*)        | key (único, entra en el hash de asignación), settingKey, hypothesis, status (DRAFT, RUNNING, STOPPED, CONCLUDED), variants (`{ control, treatment }`, validados con el esquema del ajuste), allocation (0–1 al tratamiento, CHECK), minSamplePerVariant (> 0; ≈ 41,000 impresiones visibles para el CTR del feed, `plan-90-dias.md` §2.4), primaryMetric (llave de `DailyMetric`), guardrails, startedAt, endedAt, result (calculado por código), decisionId (único: la decisión que lo originó). **A lo más uno RUNNING por `settingKey`** (índice único parcial). Asignación estable **por persona** con hash, sin tabla de asignaciones; la exposición se registra como evento `EXPERIMENT_EXPOSURE`. |
| `PlatformDecision` (+)   | guardrails (salvaguardas a vigilar: métrica, dirección, cambio relativo máximo, exposición mínima), evaluation (línea base, observado, muestra y veredicto, por código), autoApplied (solo riesgo bajo tras el umbral), reason (motivo corto; si lo escribe la IA es dato, no instrucción), experimentId (experimento cuya evidencia la sustenta: adoptar, descartar o revertir), approvedById (ADMIN que aprobó o rechazó). Dos relaciones con `Experiment`: `Experiment.decisionId` = la propuesta que lo lanzó (1:1); `PlatformDecision.experimentId` = las decisiones tomadas con su resultado (1:N).                                                                                                |
| `JobRun` (\*)            | job (nombre estable: `daily-metrics`, `expire-checkouts`…), status (RUNNING, SUCCEEDED, FAILED), startedAt, finishedAt, summary (JSON sin datos personales; vacío mientras corre), error (corto, sin secretos). Una fila por ejecución; una RUNNING vieja sin `finishedAt` es una tarea que murió.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `AnalyticsEventType` (+) | `EXPERIMENT_EXPOSURE` (metadata: experimento y variante). `VISIBLE_IMPRESSION` (migración `visible_impressions`, ADR-037): impresión VISIBLE del feed, ≥ 50 % de la pieza en pantalla durante ≥ 1 s continuo, aceptada solo para una pieza servida: con sesión y personalización, servida a esa persona; sin ellas, contra la cubeta de lo servido a esa cuenta o IP o, sin IP de confianza, sin pasar de las servidas anónimas de esa publicación. `IMPRESSION` sigue siendo la pieza SERVIDA. Alimenta `feed.impressions.visible`; el umbral de tráfico solo cuenta las ligadas a una persona.                                                                                                         |

### Moderación y autenticidad (ADR-036)

| Entidad o campo                                              | Campos clave                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Report` (\*)                                                | reporterId? (SetNull: si la cuenta se borra, el reporte queda sin autor), targetType (POST, PRODUCT, USER, COMMENT), targetId (polimórfico, sin llave foránea: el servicio verifica que exista y sea visible), reason (COUNTERFEIT, SCAM, PROHIBITED, SPAM, OFFENSIVE, OTHER), details? (≤ 1,000, dato no confiable), status (OPEN, ACTIONED, DISMISSED), resolvedById?, resolvedAt?. **Único por (reporterId, targetType, targetId)**: la misma persona no reporta dos veces lo mismo (NULL no choca).                                                                                                                                                                                                       |
| `AuthenticityCheck` (\*)                                     | **Una fila por producto (`productId` único), la revisión vigente**; al reevaluar se actualiza en su lugar. Se eligió sobre un historial porque la cola y la página del producto necesitan «el estado actual» sin `DISTINCT ON` ni filas viejas que compitan; la huella queda en `rulesVersion`, `reviewedBy/At` y los reportes. riskLevel (`RiskLevel`), score (0–1, CHECK), signals (`[{ rule, weight, message }]`, `message` en español claro), rulesVersion, aiSignal? (señal de la IA; nunca decide sola), status (AUTO_CLEAR, NEEDS_PROOF, PROOF_SUBMITTED, VERIFIED_BY_ADMIN, REJECTED), proofMediaIds (`uuid[]`, fotos privadas), reviewedById?, reviewedAt?, reviewNote? (se le muestra al vendedor). |
| `AuthenticityProofHistory` (\*)                              | Tabla `authenticity_proof_history` (migración `proof_media_protection`): bitácora de comprobantes, **una fila por foto en cada envío** del vendedor: productId, mediaId, submittedAt, replacedAt? (`null` = parte del comprobante vigente; al enviar otro, las anteriores reciben la fecha). Reemplazar un comprobante no libera sus fotos (auditoría): siguen privadas, no se adjuntan y el recolector de huérfanas no las borra. Índices por `mediaId` («¿esta foto fue un comprobante?») y (productId, submittedAt). Cascada con el producto y con la foto (y la foto, con la cuenta de su dueño). Sin plazo de conservación todavía: pendiente de decisión legal (ADR-036).                               |
| `Product.moderationStatus` (VISIBLE, HIDDEN) + `moderatedAt` | Moderación independiente de `ProductStatus` (que controla el vendedor: sus acciones de pausar o activar no tocan este campo). HIDDEN = fuera de todo lo público; el vendedor lo sigue viendo en Studio. El motivo está en `Report` o `AuthenticityCheck`.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Post.status` / `Comment.status` = HIDDEN                    | Ya existían y **son** el estado de moderación de publicaciones y comentarios (solo el equipo los pone o quita; ningún camino del autor). Todas las consultas públicas ya filtran `PUBLISHED`, así que no hizo falta otro campo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**Trigger `reject_proof_media_link`** (migración `proof_media_protection`, solo en SQL: Prisma no
modela triggers). `BEFORE INSERT OR UPDATE OF "mediaId"` en `post_media` y `product_media`: si la
foto está en algún `authenticity_checks."proofMediaIds"` (índice GIN, `@>`) o en
`authenticity_proof_history`, rechaza la fila con `check_violation` y el mensaje
`proof_media_link: …` (`trust/proof-media.ts` → `isProofMediaLinkError`: quien adjunta responde como
a una foto inválida). Es la última defensa, venga de donde venga el INSERT; las acciones ya validan
antes. Primero toma `FOR KEY SHARE` sobre la fila de `media`: una carrera con `submitProof` (que la
bloquea `FOR UPDATE` mientras la guarda como comprobante) se resuelve en fila, y adjuntar y guardar
como comprobante nunca terminan los dos.

**Consultas que deben filtrar `moderationStatus: "VISIBLE"` (o `p."moderationStatus" = 'VISIBLE'` en SQL)**
para que un producto oculto desaparezca de verdad:

- `src/modules/feed/queries.ts`: espacios comerciales y publicaciones ligadas a producto
  (`product: { status: "ACTIVE", stock: { gt: 0 } }`, 4 lugares).
- `src/modules/catalog/queries.ts`: página pública por slug (oculto → `null` salvo para su dueño),
  listado de Comprar y «similares».
- `src/modules/search/sql.ts`: búsqueda de productos (la subconsulta sin índice también debe
  seleccionar la columna).
- `src/modules/discovery/queries.ts`: productos de Descubrir.
- `src/modules/social/unread.ts`: conteo «N nuevas» con producto.
- `src/modules/social/actions.ts` (`SAVABLE_PRODUCT_STATUSES`) y `saved-queries.ts`: no guardar ni
  mostrar productos ocultos en Guardados.
- `src/modules/analytics/integrity.ts` (`PUBLIC_PRODUCT_STATUSES`): no contar compartidos de ocultos.
- `src/app/media/[...key]/route.ts`: con un producto oculto, sus fotos solo a su dueño y al equipo.
  Las fotos de comprobante (`proofMediaIds` y `authenticity_proof_history`) solo al vendedor y a
  ADMIN.
- `src/modules/media/orphans.ts`: excluye las fotos de comprobante, vigentes y reemplazadas, del
  recolector de huérfanas (si no, se borrarían a las 24 h).
- Carrito (`src/modules/commerce/cart.ts`): no se agrega un oculto; `getCartLines` (el checkout) lo
  omite sin borrarlo y abrir /carrito (`listCartRemovingHidden`) borra esas líneas y avisa una vez
  («Quitamos un producto que ya no está disponible»). `checkout.ts` no se toca en esta etapa
  (ADR-033).

### IA: evaluación de modelos

| Entidad          | Campos clave                                                                                                                                                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AIEvalRun` (\*) | provider, model, promptVersion, task (se recomienda el nombre de `AIFeature`), cases, passed (CHECK 0 ≤ passed ≤ cases), metrics (JSON válido, cifras inventadas, categoría correcta, latencia…), costMicrosUsd (≥ 0), createdAt. Base para elegir el modelo más barato que pase (ADR-033 #9). |
| `AIFeature` (+)  | `AUTHENTICITY_REVIEW` (señal de IA en autenticidad) y `MODEL_EVALUATION` (las llamadas de evaluación pasan por el guardián y cuentan en el presupuesto).                                                                                                                                       |

## Sprints 3–4 y preparación

- `Campaign` (sellerId, productId, objective, channel: INTERNAL | SHARE_KIT | META | GOOGLE | TIKTOK,
  status, dailyBudgetCents, durationDays, strategy JSON, guardrails JSON), `CampaignCreative`,
  `CampaignMetricDaily`, `CampaignAction` (bitácora del Autopiloto con aprobación).
- ~~`Experiment` / `ExperimentAssignment`~~: `Experiment` ya existe (2026-09-26) y la asignación es un hash
  estable por persona, sin tabla.
- `CreatorProfile`, `AffiliateLink`, `Commission` (creadores).
- `Conversation` / `Message` (mensajería comprador–vendedor; base del AI Sales Agent).
- `Notification`.

## Estilista, Pruébatelo y saldo (2026-09-29, ADR-043 a ADR-045)

| Entidad             | Campos clave                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AIRequest.funding` | `AIFunding`: PLATFORM (subsidio, cuenta en `ai.budget`), USER_PAID, SELLER_PAID (cobrados del saldo, no cuentan), SYSTEM                                                                                                                         |
| `Wallet`            | userId (único), balanceCents (CHECK ≥ 0), currency                                                                                                                                                                                               |
| `WalletEntry`       | walletId, kind (TOPUP, PROMO, TRY_ON, SPONSORED_TRY_ON, REFUND, ADJUSTMENT), amountCents (±, ≠ 0), balanceAfterCents, reference, simulated                                                                                                       |
| `WalletTopUp`       | walletId, packId, amountCents, bonusCents, status (PENDING, PAID, FAILED, EXPIRED), provider, providerRef (único), simulated, paidAt                                                                                                             |
| `TryOnPhoto`        | userId, mediaId (único; privada, nunca adjuntable), consentVersion, expiresAt (30 días)                                                                                                                                                          |
| `TryOnResult`       | userId, photoId, productIds[], cacheKey (único: foto + productos + prompt + modelo), status (PENDING, READY, FAILED), resultMediaId (único, privada), aiRequestId (único), funding, sponsorSellerId, chargedCents, errorCode, expiresAt          |
| `StyleLook`         | userId?, needText, need (JSON validado), items (JSON: productId, slot, priceCents), totalCents, currency, title, explanation, copySource, anchorProductId, algorithmVersion                                                                      |
| `SellerProfile`     | + sponsorsTryOn, tryOnDailyCapCents (CHECK ≥ 0)                                                                                                                                                                                                  |
| `PlatformSetting`   | + `ai.features` (banderas por función; solo ADMIN, decisión de riesgo ALTO), `ai.budget.tryOnDailyCapUsd`                                                                                                                                        |
| Enums               | `AIFeature` + SHOPPING_INTENT, LOOK_COPY, VIRTUAL_TRY_ON · `AnalyticsEventType` + NEED_SUBMITTED, LOOK_GENERATED, LOOK_ITEM_SWAPPED, TRY_ON_GENERATED, WALLET_TOPUP, WALLET_CHARGE · `Surface` + STYLIST, WALLET · `ConsentType` + TRY_ON_PHOTOS |

El trigger `reject_proof_media_link` (`post_media`, `product_media`) también rechaza las fotos de
`try_on_photos` y los resultados de `try_on_results` (`private_media_link`); el recolector de
huérfanas las excluye y la operación diaria (`tryon-retention`) borra las vencidas.

## Índices principales

| Consulta                       | Índice                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feed global reciente           | `Post (status, publishedAt DESC, id)`                                                                                                                                |
| Feed por comunidad             | `Post (communityId, status, publishedAt DESC)`                                                                                                                       |
| Perfil                         | `Post (authorId, publishedAt DESC)`                                                                                                                                  |
| Catálogo                       | `Product (status, categoryId, createdAt DESC)`, `Product (sellerId, status)`                                                                                         |
| Likes / guardados / seguidores | PK compuestas + índice inverso (`postId`, `followingId`)                                                                                                             |
| Comentarios                    | `Comment (postId, createdAt)`                                                                                                                                        |
| Eventos                        | `(type, createdAt)`, `(entityType, entityId, createdAt)`, `(userId, createdAt)`, `(sourcePostId)`                                                                    |
| Búsqueda (`/buscar`, Comprar)  | Por palabras con `translate(lower(…))` y `LIKE` parametrizado, sin índice todavía; trigramas o búsqueda semántica cuando el volumen lo pida                          |
| Gente de tus comunidades       | Consultas acotadas (LIMIT) sobre `Post (communityId, status, publishedAt DESC)` y membresías recientes; conviene `CommunityMembership (communityId, createdAt DESC)` |
| Métricas diarias               | `DailyMetric` único (day, key, dimension) + (key, day)                                                                                                               |
| Colas del equipo               | `Report (status, createdAt)`, `Report (targetType, targetId, status)`, `AuthenticityCheck (status, updatedAt)`, `PlatformDecision (status, createdAt DESC)`          |
| Enfriamiento por ajuste        | `PlatformDecision (settingKey, appliedAt DESC)`; un solo experimento RUNNING por ajuste (índice único parcial)                                                       |
| Tareas programadas             | `JobRun (job, startedAt DESC)`, `JobRun (status, startedAt)`                                                                                                         |
