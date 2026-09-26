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

| Entidad                              | Campos clave                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                               | id, name, email (único), emailVerified, image — administrada por Better Auth                                                                                                                                                                      |
| `Session`, `Account`, `Verification` | tablas de Better Auth                                                                                                                                                                                                                             |
| `Profile`                            | userId (único), username (único, minúsculas), displayName, bio, avatarUrl, city, state, goals[], personalizationEnabled, isEditorial, **discoverable** («Aparecer en sugerencias» de «Gente de tus comunidades», activo por omisión), onboardedAt |
| `SellerProfile`                      | userId (único), displayName, description, city, state, acceptedPaymentMethods[], status                                                                                                                                                           |
| `UserConsent` (\*)                   | userId, type (TERMS, PRIVACY_NOTICE, PERSONALIZATION, **DISCOVERABILITY**), version, granted, createdAt — historial inmutable: cada cambio de «Aparecer en sugerencias» agrega un registro                                                        |

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

| Entidad                 | Campos clave                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AIRequest`             | userId, feature, provider, model, promptVersion, input (JSON saneado), status, latencyMs                                                                                |
| `AIResponse`            | requestId (único), output (JSON validado), inputTokens, outputTokens, costMicrosUsd                                                                                     |
| `AnalyticsEvent`        | type, userId?, anonymousId?, entityType, entityId?, sourcePostId?, surface, position?, score?, algorithmVersion?, query?, metadata (JSON)                               |
| `PlatformSetting` (\*)  | key (único), value (JSON validado por esquema), version, updatedBy                                                                                                      |
| `PlatformDecision` (\*) | actor (AI, HUMAN), kind, hypothesis, settingKey?, previousValue?, newValue?, status (PROPOSED, APPROVED, APPLIED, REVERTED, REJECTED), riskLevel, measuredImpact (JSON) |

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
| `Report` (\*)              | reporterId, target (post/producto/usuario), reason, status — moderación mínima                                                                                                          |
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

## Sprints 3–4 y preparación

- `Campaign` (sellerId, productId, objective, channel: INTERNAL | SHARE_KIT | META | GOOGLE | TIKTOK,
  status, dailyBudgetCents, durationDays, strategy JSON, guardrails JSON), `CampaignCreative`,
  `CampaignMetricDaily`, `CampaignAction` (bitácora del Autopiloto con aprobación).
- `Experiment` / `ExperimentAssignment` (motor de automejora).
- `CreatorProfile`, `AffiliateLink`, `Commission` (creadores).
- `Conversation` / `Message` (mensajería comprador–vendedor; base del AI Sales Agent).
- `Notification`.

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
