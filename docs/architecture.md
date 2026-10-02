# Arquitectura

## Visión técnica

Monolito modular en Next.js (ADR-001). La lógica de negocio vive en servicios que no dependen de Next;
la web los usa mediante Server Actions y, cuando llegue la app móvil, se exponen en `/api/v1` sin
reescribirlos. Todo proveedor externo (IA, pagos, archivos, email) se usa a través de una interfaz con
una implementación simulada para desarrollo.

## Stack (versiones exactas fijadas)

| Capa          | Elección                                                               |
| ------------- | ---------------------------------------------------------------------- |
| Framework     | Next.js 16.3.6 (App Router, Turbopack, React Compiler, rutas tipadas)  |
| UI            | React 19.2.8, Tailwind CSS 4.3.3, shadcn/ui 4.21 (Base UI 1.8), lucide |
| Lenguaje      | TypeScript 5.9.3 estricto (+ `noUncheckedIndexedAccess`)               |
| Validación    | Zod 4.6.5                                                              |
| Base de datos | PostgreSQL 17 + Prisma 7 (fase 1.2)                                    |
| Autenticación | Better Auth 1.7 (fase 1.3)                                             |
| Pruebas       | Vitest 5 (unit + componentes con jsdom), Playwright 1.63 (E2E)         |
| Calidad       | ESLint 9 (next + reglas con tipos), Prettier 3.9 + plugin de Tailwind  |
| Paquetes      | pnpm 10.33, `save-exact`, cuarentena de 24 h para versiones nuevas     |

## Capas

```
app/ (páginas y layouts: solo composición de UI)
  │  Server Actions (web) · Route Handlers /api (feed paginado, uploads, webhooks, app móvil futura)
  ▼
modules/<m>/service.ts   reglas de negocio y permisos (sin dependencias de Next)
  │
  ▼
modules/<m>/queries.ts   acceso a datos con Prisma; devuelve DTOs explícitos
  │
  ▼
PostgreSQL               server/providers/*: AI · Payment · Storage · Email (interfaces + adaptadores)
```

## Estructura

```
src/
├─ app/            rutas (URLs en español): inicio, descubrir, comunidad, crear, comprar, perfil,
│                  producto, studio (panel del vendedor), api
├─ modules/        un directorio por dominio (ver tabla)
│  └─ <módulo>/    components/ · actions.ts · service.ts · queries.ts · schemas.ts · *.test.ts
├─ server/         env validado, db, auth, providers/
├─ components/ui/  design system (shadcn/ui)
├─ config/         marca y mercado (site.ts)
├─ lib/            utilidades puras (sin efectos)
└─ styles/         CSS compartido
```

| Módulo      | Responsabilidad                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity`  | Registro, sesión, perfiles, activar vendedor, consentimientos versionados (`LEGAL_VERSIONS`)                                                                  |
| `social`    | Publicaciones, comentarios, likes, guardados, seguidores, comunidades, «N nuevas»                                                                             |
| `media`     | Subida, validación y re-codificación de imágenes, limpieza de huérfanas; video (después)                                                                      |
| `feed`      | RecommendationEngine, Commerce Engine, política de mezcla (con experimentos), impresiones                                                                     |
| `discovery` | Columna «Para ti» y «Gente de tus comunidades»: solo datos reales, privacidad de a quién se sigue (ADR-030)                                                   |
| `search`    | Búsqueda global `/buscar` y la de Comprar: sin acentos, SQL parametrizado, índices de trigramas                                                               |
| `catalog`   | Productos, categorías, costo privado, datos estructurados de envío y garantía                                                                                 |
| `commerce`  | Carrito, checkout, órdenes, pagos simulados (fuera del alcance de esta etapa, ADR-033)                                                                        |
| `trust`     | Riesgo de falsificación por reglas, reportes, comprobante del vendedor y cola de moderación (ADR-036)                                                         |
| `ai`        | Sube y vende, kit de anuncios, proveedor por tarea (`ai.routing`), presupuesto y cuotas, guardianes, evaluaciones (ADR-031, ADR-034, ADR-038)                 |
| `analytics` | `track()`, taxonomía de eventos, atribución, métricas del Studio, impresiones visibles (`/api/impressions`, ADR-037), agregados de solo lectura para el motor |
| `platform`  | `PlatformSetting` versionado, catálogo de ajustes con riesgo y límites (`tunables.ts`), `applySettingChange`, experimentos y calendario de congelamiento      |
| `ceo`       | Motor de automejora: métricas diarias, analista, autonomía, experimentos, salvaguardas, operación diaria y Centro de decisiones (ADR-019, ADR-033, ADR-037)   |
| `admin`     | Rol ADMIN: `requireAdmin`, `getAdminViewer`, `assertAdmin`, `make-admin` y estructura de `/admin` (ADR-035, ver Administración y operación)                   |
| `stylist`   | «¿Qué necesitas?», «Crea mi look», «Completa mi look», cambiar piezas, comprar look y coincidencias comprador–producto (código determinista, ADR-043)         |
| `tryon`     | «Pruébatelo»: foto privada con consentimiento, quién paga, reserva atómica, proveedor de imágenes, caché y retención de 30 días (ADR-044, ADR-045)            |
| `billing`   | Saldo en pesos (cartera y libro), precio comunitario, recargas (simuladas hoy, webhook después) y patrocinio del vendedor (ADR-044)                           |

**Reglas de dependencia**

1. `app/` importa componentes, actions y utilidades; nunca Prisma ni `queries.ts`.
2. `actions.ts` (`"use server"`) valida la entrada con Zod, obtiene la sesión y llama al servicio.
3. `service.ts` contiene reglas de negocio y autorización; no importa `next/*`.
4. `queries.ts` es el único lugar con Prisma; importa `server-only` y devuelve DTOs explícitos.
5. Un módulo usa a otro solo a través de su `service.ts`, nunca de sus `queries.ts`.
6. Código de servidor con secretos importa `server-only`.

## Reglas técnicas obligatorias

- **DTOs explícitos.** Nunca se pasa una entidad de Prisma a un componente cliente: sus props se
  serializan dentro del HTML. El costo interno vive en una tabla aparte y una prueba verifica que ningún
  DTO público lo contenga.
- **La IA redacta, el código calcula (P2).** Las cifras financieras salen de funciones puras con
  pruebas en `modules/*/pricing` o equivalentes; la IA solo recibe esos números para explicarlos.
- **Datos verificables (P4).** Envío, garantía, devoluciones, métodos de pago y autenticidad son
  columnas o enums, no texto libre.
- **Dinero en centavos (`Int`) + moneda.** Nunca `float`. Formato con `Intl.NumberFormat("es-MX")`.
- **Fechas en UTC** en la base de datos; se muestran en `America/Mexico_City`.

## Proveedores

| Interfaz          | Sprint 1                                                                     | Después                                                                                                |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `AIProvider`      | `MockAIProvider` determinista                                                | Modelo abierto pagado por uso con API compatible con OpenAI (`AI_PROVIDER=openai_compatible`, ADR-033) |
| `PaymentProvider` | `MockPaymentProvider` (pasarela simulada)                                    | Mercado Pago / Stripe con reparto de fondos                                                            |
| `StorageProvider` | Disco local (`.data/uploads`)                                                | Cloudflare R2 privado por API S3 (`STORAGE_DRIVER=s3`, ADR-040); implementado                          |
| `ImageProvider`   | `MockImageProvider` (compone la foto con las prendas y una franja «ejemplo») | Modelo que genera imágenes desde el chat (`AI_IMAGE_MODEL`, OpenRouter con `modalities`, ADR-043)      |
| `EmailProvider`   | Consola                                                                      | Resend / SES                                                                                           |
| `MediaProcessor`  | Imágenes con `sharp`                                                         | Video con proveedor gestionado (S2)                                                                    |

La implementación se elige por variable de entorno en `server/providers/<tipo>/index.ts`.

## Feed, comunidades y Commerce Engine

- **Comunidades por nicho** (curadas por la plataforma en V0.1): el onboarding pide elegir al menos 3.
  Cada comunidad se relaciona con categorías de producto, lo que conecta interés social con intención
  comercial.
- **RecommendationEngine** (interfaz): `getFeed({ viewerId, cursor, limit }) → { items, nextCursor }`.
  La implementación es explicable: candidatos → puntuación → Commerce Engine → reglas de mezcla →
  paginación por cursor. Desde la v1, lo que la persona publicó en la última hora abre su página
  (motivo `own`, ADR-068): al publicar y volver al inicio, lo ve arriba, como en Facebook.
- **Política de mezcla** (`FeedPolicy`): tope comercial (~1 de cada 3–4), diversidad de autores y
  comunidades. Es un parámetro con límites validados, almacenado como ajuste de plataforma y ajustable
  por el motor de automejora dentro de esos límites.
- **Commerce Engine:** intención por categoría desde señales propias con pesos y decaimiento. La
  intención elige qué producto ocupa un espacio comercial; nunca aumenta el tope.
- **Impresiones:** cada elemento servido registra posición, puntuación y versión del algoritmo, base
  para entrenar modelos de ranking después.

## Eventos y atribución (P5)

`track(event)` escribe `AnalyticsEvent` en segundo plano (`after()` de Next) sin bloquear la respuesta
y respetando la preferencia de personalización. Taxonomía inicial: impresión, vista, clic, búsqueda,
like, guardado, comentario, seguir, compartir, unirse a comunidad, vista de producto, agregar al
carrito, checkout iniciado, compra, propuesta de IA generada/aceptada. Carrito y órdenes guardan la
publicación de origen (`sourcePostId`) para atribuir ventas a contenido y creadores.

## IA

- `AIProvider` expone operaciones de dominio (p. ej. `generateSaleProposal`), no un chat genérico.
- Toda salida se valida con Zod antes de usarse; si no valida, se reintenta o se informa el error.
- `AIRequest`/`AIResponse` registran proveedor, modelo, versión del prompt, tokens, costo y latencia.
- El vendedor revisa y edita todo antes de publicar (humano en el circuito).
- **AI Sales Agent (futuro):** solo herramientas de lectura sobre datos P4; si un dato no existe,
  responde que el vendedor no lo ha especificado y ofrece preguntarle. Los mensajes de compradores son
  entrada no confiable (prompt injection): el agente no puede cambiar precios ni prometer nada.

## Motor de automejora ("la IA como CEO")

Objetivo: que la plataforma mejore de forma continua para atraer y retener personas, vendedores y
creadores, con la IA como operadora principal, dentro de límites que pone el código (ADR-019,
ADR-033, `plan-90-dias.md` §2.3–2.4).

**Ciclo (diario):** medir → detectar oportunidad → proponer (hipótesis + impacto esperado) →
aplicar o experimentar según el riesgo → vigilar salvaguardas → adoptar o revertir → aprender.

**Regla (extiende P2 al propio motor):** la IA propone; el código mide, clasifica el riesgo, valida
límites y paso máximo, aplica y revierte; una persona aprueba lo de riesgo alto. La IA nunca decide
su propio riesgo. **Pagos, precios, comisiones y gasto quedan fuera de su alcance: ni siquiera los
puede proponer con valores** (ADR-033).

| Riesgo | Qué mueve (catálogo `platform/tunables.ts`)                                                                                                                                                 | Autonomía en modo `low_risk` (tras el umbral de tráfico)                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Bajo   | `feed.policy.recencyHalfLifeHours` (6–168, ±20 %), `explorationShare` (0–0.5, ±0.05), `authorWindow` (2–10, ±1)                                                                             | Se aplica solo, con reversión automática                                       |
| Medio  | `feed.policy.commerceSlotEvery` (3–12, ±1) y `minGapBetweenCommerce` (2–12, ±1), en cualquier dirección                                                                                     | Experimento al 10 %; adoptarlo requiere aprobación humana                      |
| Alto   | Todo lo demás (moderación, políticas) y cualquier ajuste fuera del catálogo; prohibidos: `commerce.*`, `payments.*`, `pricing.*`, `fees.*`, `ai.budget*`, `ai.routing`, `platform.autonomy` | Nunca automático («Solo propuesta»); los prohibidos no se aplican ni aprobados |

**Piezas (código en `src/modules/platform` y `src/modules/ceo`):**

- **Métricas diarias** (`ceo/metrics.ts`, consultas de solo lectura en
  `analytics/platform-aggregates.ts`, definiciones en `ceo/metric-catalog.ts`): `DailyMetric` por día
  de México (upsert idempotente) con impresiones del feed, contenido comercial visto, conversión
  comercial, visitas a producto por impresión y por vendedor activo, primera venta de vendedores
  nuevos, reportes y «No me interesa» por mil impresiones, D1/D7 aproximados, costo de IA contra el
  tope y cortes por variante de cada experimento. Honestidad: las impresiones son VISIBLES (T5,
  ADR-037: ≥ 50 % de la pieza en pantalla ≥ 1 s continuo, solo de piezas servidas a quien las
  reporta, una por persona, publicación y día). **Solo deciden las personas con sesión** (y
  personalización): las filas que usan el umbral, las salvaguardas, el analista y los experimentos
  cuentan sus impresiones visibles y, en los numeradores (reportes, «No me interesa», interacciones,
  visitas), solo lo de esas mismas personas (`signedInFeedTotals`). Sin detección de robots, así un
  robot sin cuenta no mueve ninguna tasa. Las visibles anónimas (`feed.impressions.visible.anonymous`)
  y la pieza servida (`feed.impressions.served`) son descriptivas y no deciden nada. Las filas por
  impresión anteriores a `VISIBLE_IMPRESSIONS_SINCE` (2026-09-27, el primer día completo con
  visibles) no se comparan (`ceo/metric-rows.ts`). Los 5xx aún no se registran y su salvaguarda
  aparece «sin datos» (nunca un 0 inventado).
- **Analista** (`ceo/analyst.ts`, detectores en `ceo/detectors.ts`): compara los últimos 7 días con
  los 28 previos con prueba z de dos proporciones. La varianza de cada lado se multiplica por el
  MAYOR entre el efecto de diseño por persona (1 + (m − 1)·ρ, ρ = 0.05, con m calculado POR VENTANA:
  impresiones con persona ÷ personas distintas en esos 7 o 28 días, no el promedio diario, que
  subestimaría la varianza) y la variación medida entre días (sobredispersión, `varianceFactor`):
  reciente contra línea base no cancela los días atípicos (quincena, puentes). Cuenta solo a
  personas con sesión. Exige muestra mínima y un cambio relativo mínimo, y propone UN paso dentro de
  límites. Una propuesta por ajuste abierta a la vez; enfriamiento de 7 días tras aplicar o
  revertir. La narrativa es una plantilla; un `Narrator` opcional (IA) solo redacta y su texto se
  descarta si cita una cifra que no calculó el código, escribe cifras con letra («el doble»,
  «veinte por ciento») o promete resultados («garantiza»).
- **Autonomía** (`PlatformSetting` `platform.autonomy` = `observer` | `low_risk`, por omisión
  `observer`; lo cambia el equipo en /admin/resumen con confirmación y queda como decisión
  `autonomy.mode`). No hay modo «apagado»: `observer` ya no aplica ni prueba nada solo (lo aplicado
  antes lo siguen vigilando las salvaguardas); callar también al analista sería un ajuste aparte que
  hoy no existe. `ceo/autonomy-policy.ts` decide: alto → nunca; observador → solo propone;
  congelamiento (Buen Fin, 13–17 nov 2026, y 12–25 dic) → nada cambia solo; conflicto → espera; sin
  umbral → «Tráfico insuficiente para decidirlo con datos»; bajo → aplica; medio → experimento al 10 %.
- **Umbral de tráfico** (`ceo/threshold.ts`): 2 × muestra mínima por variante en ≤ 14 días, en cada
  una de las dos últimas semanas, contando solo impresiones visibles de personas con sesión y
  personalización (las únicas que se asignan a una variante; el tráfico anónimo, robots y pruebas
  sin cuenta no cuentan). Muestra ≈ 41,000 impresiones con los supuestos del plan (2.0 % → 2.4 %,
  α = 0.05, potencia 80 %, m = 20, ρ = 0.05); con datos suficientes usa la tasa medida y las impresiones por persona en 14 días (ρ
  nunca por debajo de 0.05). **Se mide en impresiones visibles (plan §2.4):**
  `FEED_IMPRESSIONS_ARE_VISIBLE` (`analytics/platform-aggregates.ts`) es `true` desde T5; si alguna
  vez volviera a `false` (piezas servidas), el umbral no se daría por cumplido y en modo `low_risk`
  nada se aplicaría ni probaría solo.
- **`applySettingChange` / `revertSettingChange`** (`platform/apply.ts`): el único camino que
  cambia un ajuste (H9). Exige la decisión, reclasifica el riesgo con el catálogo, valida límites y
  paso, exige que el valor actual siga siendo el de la propuesta, serializa con un candado por
  ajuste, sube la versión de `PlatformSetting` y deja la bitácora (`evaluation.trail`: quién, qué,
  cuándo). Riesgo medio solo se adopta con un experimento concluido y una persona.
- **Experimentos** (`platform/experiments.ts`, `ceo/experiments.ts`): asignación estable por persona
  (SHA-256 de llave + persona; sin sesión = control). `getFeedPolicy(viewerId)` devuelve el valor de
  tratamiento a quien le toca mientras el experimento está RUNNING y su control sigue siendo el valor
  vigente; a lo más uno por ajuste raíz. Si el valor vigente cambia mientras corre (p. ej. se revierte
  una adopción anterior), el experimento se ignora al servir y se detiene («control desactualizado»). Se
  analiza por persona (errores robustos por clúster, y nunca menos conservador que la prueba z con
  efecto de diseño). Con la muestra mínima en ambas variantes concluye: si mejora con p < 0.05 se
  PROPONE adoptarlo; si no, se registra el descarte; a los 42 días sin muestra, «no concluyente».
- **Salvaguardas** (`ceo/guardrails.ts`, `ceo/monitor.ts`): tras cualquier cambio aplicado
  (automático o humano) y entre variantes de un experimento. Revierten solas si, tras la exposición
  mínima, los reportes suben > 25 %, «No me interesa» > 15 %, el contenido comercial visto pasa de
  30 %, la conversión comercial baja > 10 %, los 5xx pasan de 1 % o las visitas a producto por
  vendedor activo caen > 15 % (ADR-033 #13), siempre que el empeoramiento sea además
  estadísticamente significativo (prueba unilateral, α = 0.05; la varianza de cada lado se
  multiplica por el MAYOR entre el efecto de diseño por persona del analista y la variación medida:
  entre días en el monitor, entre personas en un experimento; con línea base en 0, un tope
  absoluto). La exposición mínima (5,000 impresiones visibles) y todas sus tasas cuentan solo a
  personas con sesión (ADR-037): un robot sin cuenta no fuerza ni esconde una reversión. Se revisa
  una vez al día con la operación diaria (las métricas son diarias: cada hora no agregaría datos);
  se vigila 14 días y, si faltan datos, a lo más 28, y entonces se cierra con «sin evidencia de daño
  con esta muestra». Los días congelados no entran en comparaciones relativas.
- **Operación diaria** (`ceo/pipeline.ts`): métricas → experimentos → salvaguardas → analista →
  checkouts vencidos → imágenes huérfanas → retención de entradas de IA; cada paso con su `JobRun`,
  idempotente y sin ejecuciones encimadas. `pnpm ops:daily [--engine-only]` en la terminal y
  `/api/cron/daily` (GET de Vercel Cron o POST, `Authorization: Bearer <CRON_SECRET>`, comparación
  de tiempo constante, límite de frecuencia; sin el secreto correcto responde 404). La limpieza de
  imágenes se omite sola si borraría fotos de prueba de autenticidad.
- **Centro de decisiones** (/admin/resumen, /admin/decisiones, /admin/experimentos; `requireAdmin`,
  acciones con `getAdminViewer` + Zod + límite por persona, servicio con `assertAdmin`): reporte
  semanal (qué cambió, por qué, impacto, costo de IA contra el tope, cobertura, tareas), cola para
  aprobar, rechazar o revertir con nota (actor HUMAN y `approvedById`), experimentos para iniciar o
  detener. La bitácora de moderación (`moderation.*`, `authenticity.*`) usa la misma tabla pero no
  aparece aquí ni se puede aprobar, rechazar o revertir desde estas acciones. La bitácora de cada
  decisión (`evaluation`) solo crece: lo guardado por otros módulos se conserva tal cual.

**Impresiones visibles (ADR-037):** el navegador las mide (`feed/components/visible-impressions.ts`,
IntersectionObserver + cronómetro que se pausa con la pestaña oculta) y las manda cada 5 s o con
`sendBeacon` al salir a `POST /api/impressions`; el servidor solo acepta piezas servidas a quien las
reporta (`analytics/visible-impressions.ts`).

**Pendiente:** registro de 5xx para dos métricas; conectar un `Narrator`
con el proveedor de IA (`AIFeature.PLATFORM_ANALYSIS`, con el guardián de presupuesto); cambios de
código como pull requests (nunca directo a producción); 2FA para aprobar riesgo alto.

## Economía de la IA (autofinanciamiento)

La IA debe pagar su propia existencia y después financiar el crecimiento.

- **Costo medido:** cada `AIRequest` guarda tokens, modelo y costo (en micro-dólares); el costo de
  infraestructura y de procesadores de pago se registra como gasto de plataforma.
- **Ingresos medidos (Sprint 2+):** comisiones, suscripciones, promoción e IA premium en un libro de
  plataforma (`PlatformLedgerEntry`), calculados por código (P2).
- **Presupuesto de IA:** `ai.budget` (ajuste de plataforma) = presupuesto semilla mensual + un
  porcentaje de los ingresos del mes anterior. Un guardián (`AIBudgetGuard`) valida cada solicitud:
  al acercarse al límite prioriza funciones que generan ingresos o ventas para vendedores y degrada o
  pospone las demás. Nunca deja a un vendedor sin respuesta a mitad de un flujo.
- **Indicadores:** cobertura = ingresos de plataforma ÷ costo total de IA; costo de IA por venta
  generada; beneficio del vendedor por peso gastado en IA. Meta: cobertura ≥ 1 (autofinanciada) y
  luego > 1 (utilidades).
- **Cómo mejora la cobertura el motor de automejora:** elige el modelo adecuado por tarea (medido con
  evaluaciones), usa caché de prompts, cuotas por plan y propone precios o comisiones con base en el
  valor entregado (p. ej. cobrar una fracción del beneficio generado al vendedor). Cambiar precios,
  comisiones o planes es de riesgo alto: requiere aprobación humana.

## Comercio (Sprint 2)

Una orden por vendedor dentro de un checkout; precio, costo y comisión se congelan en `OrderItem`;
stock con decremento atómico condicionado (`stock >= cantidad`) y reservas con expiración; webhooks
idempotentes; nunca se almacenan datos de tarjeta.

## Administración y operación

Área del equipo en `/admin` (Resumen, Decisiones, Experimentos, Moderación, IA). La estructura base
vive en `src/modules/admin` y `src/app/admin`; cada sección la construye su módulo.

**Rol.** `Profile.role` (`USER` | `ADMIN`, ver `data-model.md`). Está en el perfil y no en `users`
para que ningún camino de Better Auth lo pueda escribir. **Solo se da o se quita desde la terminal:**

```
pnpm make-admin <correo>            # dar ADMIN
pnpm make-admin <correo> --revoke   # quitarlo
```

El script se niega con una base que parezca de producción (`NODE_ENV=production` o un servidor que
no es esta máquina) salvo con `--allow-production`, y exige que la cuenta haya terminado la
bienvenida. El rol se lee de la base en cada petición: darlo o quitarlo aplica en la siguiente carga.

**Tres barreras (todas obligatorias).**

1. **Páginas y layouts:** `requireAdmin()` (`modules/admin/guard.ts`). A quien no es ADMIN, con o sin
   sesión, le responde 404 con la misma página «No encontramos esta página» que una ruta inexistente:
   sin redirigir a iniciar sesión, sin título ni metadatos propios (la prueba E2E revisa estado,
   encabezado y título; no compara el HTML byte a byte). Por eso `/admin` **no** está en
   `PROTECTED_PREFIXES` ni tiene regla propia en `proxy.ts`: la redirección optimista delataría el
   área; el comodín del proxy ya le pone la CSP. Ocultarla reduce el ruido pero no es la barrera: el
   route handler de fotos de comprobante (`/admin/moderacion/prueba/<id>`) responde un 404 en texto
   plano, distinto del HTML. El layout llama `requireAdmin()` para no pintar la estructura, pero
   tampoco es la barrera: cada página vuelve a llamarlo (los layouts no se renderizan de nuevo al
   navegar entre páginas hermanas).
2. **Server Actions y route handlers:** `getAdminViewer()` (devuelve `null` en lugar de lanzar; la
   acción responde un error genérico), Zod en la entrada y `rateLimit` con llave por persona (scope
   `admin.<acción>` → `admin.<acción>:user:<uuid>`; el scope no admite `:`), como toda acción nueva.
3. **Servicios:** toda función de servicio del área recibe a quien actúa y llama
   `assertAdmin(actorUserId)` (`modules/admin/service.ts`), que vuelve a leer el rol de la base.

**Huella.** Quién aprobó, resolvió o revisó queda en la fila: `PlatformDecision.approvedById`,
`Report.resolvedById`, `AuthenticityCheck.reviewedById`. Las páginas llevan `noindex`.

**Configuración.**

- **Tareas programadas:** ver [Operación](#operación).
- **IA de pago por uso en un servidor externo:** `AI_PROVIDER=openai_compatible` con `AI_BASE_URL`
  (https), `AI_API_KEY` y `AI_DEFAULT_MODEL` (ADR-033 #6 y #9): un modelo abierto en un proveedor
  con API compatible con OpenAI o en un servidor con GPU rentado; nada corre en la PC del
  fundador. Por omisión, `mock`. `aiProviderConfig(env)` (`server/env-schema.ts`) entrega la
  configuración con tipos estrechos.
- **IA simulada en producción (ADR-038):** con `AI_PROVIDER=mock` y `NODE_ENV=production` el
  arranque falla salvo `ALLOW_SIMULATED_AI=true` (solo build local o piloto cerrado: los
  vendedores recibirían textos de plantilla). Es el espejo de `ALLOW_SIMULATED_PAYMENTS` (ADR-032).
- **Modo de autonomía:** **no** es variable de entorno. Vive en `PlatformSetting`
  (`platform.autonomy` = `observer` | `low_risk`, por omisión `observer`) para que el fundador lo
  cambie desde `/admin/resumen` y quede en la bitácora.

**Pendiente.** Segundo factor (2FA) y reautenticación reciente para aprobar decisiones de riesgo
alto (`plan-90-dias.md` §2.1 pide «rol de equipo con 2FA»); bitácora de cambios de rol (hoy solo el
script, que exige acceso a la terminal y a la base); suspender cuentas que no son de vendedor (hoy
solo existe `SellerProfile.status`, así que un reporte de USER solo puede suspender la venta).

## Operación

Lo que la plataforma necesita correr para operar sola. Cada tarea es idempotente (se puede repetir sin
duplicar nada), deja una fila de `JobRun` por ejecución y no se encima con otra igual; una RUNNING
vieja o una FAILED reciente aparece en `/admin/resumen`.

| Tarea                        | Cuándo                                                                   | Cómo                                                              | Qué hace                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operación diaria             | Una vez al día, después de medianoche en CDMX (06:00 UTC)                | `/api/cron/daily` en producción; `pnpm ops:daily` en terminal     | Métricas del día anterior (rellena hasta 14 días faltantes) → experimentos → salvaguardas → analista → checkouts vencidos → imágenes huérfanas → retención de entradas de IA (90 días, ADR-031). Si las métricas fallan, salvaguardas y analista se omiten. `--engine-only` corre solo el motor.                                                                                             |
| Limpieza de huérfanas suelta | Solo si hace falta fuera de la diaria                                    | `pnpm exec tsx scripts/cleanup-orphan-media.ts [--dry-run]`       | Borra imágenes sin adjuntar de más de 24 h (SEC-14). Nunca toca fotos de comprobantes de autenticidad (`media/orphans.ts`); la diaria además se omite sola si su conteo no cuadra.                                                                                                                                                                                                           |
| Reevaluar autenticidad       | Tras cambiar reglas, pesos, marcas o palabras (subiendo `RULES_VERSION`) | `pnpm trust:reevaluate [--dry-run] [--include-unchecked]`         | Reevalúa las revisiones hechas con otra `RULES_VERSION` (ADR-036), por tandas y un producto a la vez; idempotente. `--dry-run` calcula lo mismo sin guardar; `--include-unchecked` evalúa también los productos sin revisión. Las decisiones del equipo no se deshacen solas. Cambiar solo `trust.referencePrices` no sube la versión: esos productos se reevalúan al editarse o reportarse. |
| Evaluar modelos de IA        | Al cambiar de modelo o de prompt, y antes de proponer una ruta           | `pnpm ai:eval --task <tarea> …` (`--confirm-spend` si es de pago) | Corre los casos de `evals/*.jsonl` y guarda `AIEvalRun`. **No se programa:** con un modelo de pago gasta dinero y es decisión humana. La evidencia para enrutar vale 30 días (ADR-034).                                                                                                                                                                                                      |
| Dar o quitar ADMIN           | Cuando cambie el equipo                                                  | `pnpm make-admin <correo> [--revoke]`                             | Único camino que cambia `Profile.role` (ADR-035).                                                                                                                                                                                                                                                                                                                                            |

**`/api/cron/daily`.** GET (Vercel Cron) o POST (a mano), con `Authorization: Bearer <CRON_SECRET>`
(obligatorio en producción, ≥ 32 caracteres; comparación de tiempo constante). Sin el secreto
correcto, o sin `CRON_SECRET` definido, responde 404 en texto plano y sin detalles (no es idéntico
al 404 HTML de una ruta inexistente: no oculta que la ruta existe, solo no dice nada más; la
protección es el secreto). Límite de 30 intentos por hora por IP (si hay IP confiable; al pasarlo
también responde 404) y de 6 ejecuciones autorizadas por hora en total (429); plazo máximo de 300 s.
La respuesta es el resumen de cada paso (sin datos personales).

**En un hosting de pago.** Los horarios de cron van en UTC; programa la diaria después de las
06:00 UTC (medianoche en la Ciudad de México), por ejemplo a las 07:15 UTC.

- **Vercel (Pro) con Vercel Cron** (hosting elegido, ADR-033 #10 y ADR-040): `vercel.json` ya la
  programa a las `0 9 * * *` (09:00 UTC = 03:00 en la Ciudad de México). Basta definir `CRON_SECRET`
  en las variables del proyecto: Vercel lo manda solo como `Authorization: Bearer …`. Vercel no
  reintenta un cron fallido (se repite a mano con `curl -X POST`). Ver [Infraestructura](#infraestructura).

- **VPS** (servidor propio rentado): una entrada de cron que llame la misma ruta, con el secreto en
  un archivo que solo lea el usuario del cron (nunca en la línea del crontab ni en el repositorio):

  ```
  # /etc/cron.d/vendeia (el servidor en UTC)
  15 7 * * * vendeia curl -fsS -X POST -H "Authorization: Bearer $(cat /etc/vendeia/cron-secret)" https://<dominio>/api/cron/daily -o /dev/null
  ```

  `pnpm ops:daily` también sirve en el mismo servidor de la app (usa `DATABASE_URL` y el
  almacenamiento de esa máquina, y necesita las dependencias de desarrollo por `tsx`); la ruta es
  preferible porque corre el mismo código que producción, con su secreto y sus límites.

**Pendiente.** Alerta externa si la diaria no corrió (hoy solo se ve en `/admin/resumen`), liberar
checkouts vencidos cada 5 minutos (hoy diario y oportunista; el código de pagos no se toca en esta
etapa), respaldos de Neon con simulacro de restauración y Sentry. El monitor de salvaguardas es
diario a propósito (métricas diarias).

## Infraestructura

Producción en **Vercel Pro + Neon Launch + Cloudflare R2** (ADR-033 #10, ADR-040). Todo escala solo,
sin servidores que administrar. Paso a paso para el fundador: [`docs/deploy.md`](deploy.md).

```
Navegador ──▶ Vercel CDN ──▶ Funciones de Next (iad1, Fluid compute)
                                 │  páginas, Server Actions, /api, /media (autoriza cada foto)
                                 ├──▶ Neon PostgreSQL (aws-us-east-1): app por el pooler
                                 │     (DATABASE_URL), migraciones por la directa (DATABASE_URL_UNPOOLED)
                                 ├──▶ Cloudflare R2 (bucket privado, API S3): originales y variantes
                                 └──▶ OpenRouter (IA por uso, AI_PROVIDER=openai_compatible)
Vercel Cron (09:00 UTC) ──▶ /api/cron/daily (Bearer CRON_SECRET)
```

| Pieza         | Cómo escala                                                                               | Tope de costo                                     |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Vercel        | Instancias bajo demanda con varias peticiones cada una; sin tráfico no cobra CPU          | Spend Management con pausa de producción          |
| Neon          | Autoscaling de 0.25 a 2 CU y scale to zero a los 5 min; pooler de hasta 10,000 conexiones | El máximo de CU                                   |
| Cloudflare R2 | Sin servidores; almacenamiento sin límite; sin cobro por salida de datos                  | Ninguno automático (alertas de facturación)       |
| OpenRouter    | Por llamada                                                                               | Límite de crédito de la llave + presupuesto de IA |

- **Configuración en el repositorio:** `vercel.json` (región `iad1` junto a la base, cron diario y
  `buildCommand: pnpm vercel-build`). No hace falta `output` ni cambios en `next.config.ts`: Vercel
  usa su adaptador de Next.
- **Build y migraciones:** `scripts/vercel-build.mts` corre `prisma generate`, `next build` y, solo
  en producción y solo si compiló, `prisma migrate deploy` por la conexión directa (revisada antes de
  compilar: sin `-pooler` y con `sslmode`). Las vistas previas no migran ni reciben
  variables de producción. Toda migración debe ser compatible con el código anterior (un Instant
  Rollback no deshace migraciones). A mano: `pnpm db:deploy`.
- **Almacenamiento:** `STORAGE_DRIVER=s3` → `S3StorageProvider` (`server/providers/storage`,
  `createStorage` en `factory.ts`). El bucket es privado; `publicUrl` siempre es `/media/<clave>`.
  En producción, el disco local falla al arrancar salvo `ALLOW_LOCAL_STORAGE=true`, y en Vercel
  siempre.
- **Variables:** `server/env-schema.ts` valida todo en el build y al arrancar; la tabla completa está
  en `docs/deploy.md` (paso 8). En Vercel, `TRUSTED_PROXY_HOPS=1`.
- **Respaldos:** historial de Neon de 7 días (restauración a un instante) con simulacro mensual; las
  fotos borradas por la app no se recuperan.

**Pendiente.** `attachDatabasePool` (`@vercel/functions`) para cerrar conexiones inactivas antes de
que Vercel suspenda una instancia; alerta externa del cron; copia periódica del bucket. El CDN de
Vercel usa el `Cache-Control` de las funciones cuando no hay `CDN-Cache-Control`: las fotos públicas
de `/media` (`public, max-age=3600, stale-while-revalidate=86400`) quedan en su caché, así que el
retiro de una foto (SEC-14, ventana de ADR-039) depende de cómo Vercel revalide ante el 404; se
comprueba en el primer despliegue (`docs/deploy.md`, paso 13) y, si pasa de una hora, se fija
`Vercel-CDN-Cache-Control` en la ruta.

## Núcleo de IA y compra asistida (ADR-043 a ADR-045)

El plan «Ecosistema de IA» (20 funciones, 5 fases) se apoya en lo que ya existía (proveedores por
interfaz, tareas estructuradas, enrutador, guardián, evaluaciones) más tres piezas nuevas:

```
Persona ──▶ ficha de producto («Ver cómo me veo», diálogo) · /estilista · /probar
Tienda  ──▶ /studio/saldo (saldo, «Ver cómo me veo» activo, recargas) · /studio/campanas (destacar)
                │
                ▼
   modules/stylist   necesidad (reglas + modelo) → candidatos reales → compositor (código) → looks
   modules/tryon     foto privada + consentimiento → quién paga (tienda → cortesía → demanda) → reserva atómica → ImageProvider → resultado privado
   modules/billing   saldo de la tienda, precio comunitario, recargas, «Ver cómo me veo» activo, destacados
                │
                ▼
   modules/ai        ai.features (banderas) · ai.routing · guardián (funding, tope diario, cuotas por función)
                │
                ▼
   server/providers  ai (texto) · image (imágenes) · storage · payments
```

- **Banderas** (`ai.features`, `modules/ai/features.ts`): lista cerrada de las 20 funciones más las
  existentes; solo ADMIN las cambia en `/admin/ia` (decisión HUMAN de riesgo alto); las planeadas
  no tienen código y siempre están apagadas. Los servicios llaman `requireFeature` antes de gastar.
- **Quién paga** (`AIRequest.funding`, ADR-046): quien compra nunca. `SELLER_PAID` se cobra del
  saldo de la tienda en la misma transacción que la reserva y no consume presupuesto; `PLATFORM`
  (las pruebas de cortesía de cada tienda y las tareas subsidiadas) y `SYSTEM` consumen el
  presupuesto de subsidio (`ai.budget`, con tope diario para las pruebas). Sin ninguna opción, la
  prueba no se genera y la demanda queda registrada (`TRY_ON_REQUESTED`). Cada función tiene
  además cuotas propias por hora y por día.
- **La IA nunca inventa productos:** el estilista arma looks con código determinista sobre
  productos activos, con existencias y visibles; el modelo solo interpreta la necesidad (el
  presupuesto lo pone el código) y, cuando se encienda, nombra el look con guardián.
- **Fotos de Pruébatelo:** privadas (solo su dueña o dueño, ni el equipo), nunca adjuntables
  (validación + trigger `private_media_link`), excluidas del recolector de huérfanas, con
  consentimiento versionado y borrado a los 30 días en la operación diaria (`tryon-retention`).
- **Caché:** un resultado de Pruébatelo se identifica por foto + productos + prompt + modelo.
- **Eventos (P5):** `NEED_SUBMITTED`, `LOOK_GENERATED`, `LOOK_ITEM_SWAPPED`, `TRY_ON_GENERATED`,
  `TRY_ON_REQUESTED`, `WALLET_TOPUP`, `WALLET_CHARGE`; superficies `STYLIST` y `WALLET`.
- **Cobro:** `docs/modelo-de-ingresos.md`. Página pública `/precios`.
- **Mensajes privados (`modules/messages`, ADR-047):** una conversación por par de personas,
  texto plano, gratis, con no leídos en la barra superior, reporte de la cuenta desde el hilo y
  antispam por persona. Sin sockets: el hilo se refresca cada 10 s mientras está visible. Bloquear
  mensajes (ADR-069) se revisa en el servicio, al empezar y al enviar.
- **Recuadros ahí mismo (ADR-068):** la campana, los mensajes y «Crear» son enlaces a su página
  hasta que la página carga y se sabe el tamaño de la pantalla (`useWideScreen`); después abren un
  recuadro (Base UI Popover) en escritorio o un panel desde abajo (Drawer) en teléfono, que traen
  sus datos con acciones del servidor de lectura (mismas consultas y reglas que las páginas). La
  publicación nueva se escribe en una ruta interceptada del `@modal`, como la capa de ADR-052.
- **Redacción diaria (`modules/editorial`, ADR-066):** el código arma el encargo (tipo, enfoque y
  fecha del calendario), la IA redacta un borrador por comunidad en la operación diaria, el código lo
  limpia y el equipo lo publica desde `/admin/redaccion` como la cuenta editorial. Nada se publica
  sin aprobación.

## Seguridad

- Cabeceras base en `next.config.ts` (nosniff, DENY de iframes, Referrer-Policy, Permissions-Policy,
  HSTS en producción) y sin `X-Powered-By`. CSP estricta con nonce por petición en TODO el HTML:
  `src/proxy.ts` genera el nonce y pone la política (`src/lib/csp.ts`) en la petición y la respuesta
  de cada página, con o sin sesión (ADR-029); `/media` conserva su CSP de sandbox y `/api/*` no lleva
  CSP de página. `src/instrumentation-client.ts` corre en el navegador antes que la app y deja a Zod
  sin JIT (`Function()` violaría la CSP en producción).
- Autorización en servicios; `proxy.ts` solo hace redirecciones optimistas.
- Validación con Zod en cada frontera; límite de intentos en auth, IA y subidas.
- **Límite de frecuencia propio** (`server/rate-limit.ts`, tabla `rate_limit_buckets`): el `rateLimit`
  de Better Auth solo cubre el router HTTP `/api/auth/*`, y las Server Actions llaman `auth.api.*`
  directo, así que cada acción sensible limita antes de trabajar. Ventana fija por llave desde el
  primer intento; conteo y decisión en una sola sentencia
  (`INSERT … ON CONFLICT … DO UPDATE … RETURNING`) con el reloj de PostgreSQL: exacto con concurrencia
  y varias instancias. Llaves con espacio de nombres (`signin:ip:<ip>`, `post:user:<uuid>`,
  `signin:email:<sha256>`): los correos se guardan como hash e IPv6 se agrupa por /64.
  `rateLimitMany` revisa en orden y se detiene en la primera que falla (la IP va primero para que una
  IP bloqueada no gaste el cupo por cuenta de sus víctimas); una regla sin llave (sin IP confiable) se
  omite. `limitOrError` da el mensaje ("Demasiados intentos. Intenta de nuevo en N minutos."). Las
  cubetas vencidas se borran de forma oportunista (un lote a lo más cada minuto por proceso). No se
  reutiliza `rate_limits`: Better Auth borra de ahí toda fila más vieja que su ventana más larga
  (60 s) sin mirar la llave.
- **IP del cliente** (`server/client-ip.ts`, `TRUSTED_PROXY_HOPS`): nunca se confía en
  `X-Forwarded-For` sin configurar. Con 0 (por omisión, Next expuesto directo) no hay IP: el App Router
  no expone el socket y Next solo escribe la IP del socket en `X-Forwarded-For` si el cliente no mandó
  esa cabecera, así que no se distingue de una falsa; los límites por IP se omiten y quedan los de
  correo/usuario (mejor que una cubeta compartida que bloquearía a todos). Con N, la IP es la N-ésima
  entrada desde la derecha (lo que agregaron los N proxies); cadena más corta o valor inválido → sin
  IP. Solo es seguro si el origen no se alcanza sin pasar por esos proxies. Better Auth usa la misma
  IP: lee solo `x-vendeia-client-ip` (`authIpAddressOptions`), que `withClientIpHeader` y
  `withClientIpRequest` reescriben siempre (descartan el valor del cliente) antes de `auth.api.*` y del
  handler de `/api/auth`. En producción se avisa una vez en el log si no hay IP confiable.
- Variables de entorno validadas al arrancar; los errores nunca imprimen valores (prueba incluida).
- Subidas: validación por firma de bytes, límite de tamaño, re-codificación (elimina GPS/EXIF),
  nombres aleatorios, sin SVG.
- Cadena de suministro: versiones exactas, lockfile, cuarentena de 24 h, dependencias mínimas.

## Privacidad

Consentimiento versionado (términos, aviso de privacidad, personalización); solo datos generados dentro
de la plataforma; ubicación pública a nivel ciudad/estado; personalización desactivable; exportar y
borrar datos antes del lanzamiento público; retención de eventos crudos limitada (propuesta: 180 días
y luego agregados).

**Volver a aceptar** (`identity/consent-refresh.ts`). Al subir `LEGAL_VERSIONS.terms` o
`LEGAL_VERSIONS.privacyNotice`, quien aceptó una versión anterior (o nunca aceptó) ve arriba de las
páginas de la red social (`AppShell`) un aviso que no bloquea, con ligas solo a los documentos que
cambiaron. «Aceptar» (`acceptUpdatedLegalAction`, 10 intentos por hora por persona) manda el tipo y
la versión que el aviso mostró; el servidor agrega filas de `UserConsent` solo de lo pendiente cuya
versión vigente es la mostrada, con un candado por persona (dos pestañas no repiten filas; al día no
escribe nada: el historial solo crece). Si una versión cambió con la pestaña abierta, no se registra
una versión que la persona no vio: responde `stale` y el aviso se vuelve a pintar con la vigente.
«Ocultar por ahora» lo esconde solo en esa pestaña mientras siga abierta (sessionStorage, con las
versiones en la llave: una versión nueva lo vuelve a mostrar). Con versiones con forma de fecha, solo
una ANTERIOR a la vigente pide aceptar. Si la consulta falla, el aviso no se muestra y la página sigue.
Hoy el Studio y `/admin` no lo muestran (usan otra estructura).

**Pendiente.** Los plazos máximos de conservación de la actividad (incluidas las impresiones
visibles) y de los reportes, fotos de comprobante y bitácora de moderación: hoy no se borran solos y
el aviso de privacidad los marca como pendientes; fijarlos es decisión legal y luego una tarea de la
operación diaria.

## Preparado, no implementado

AI Sales Agent (requiere mensajería comprador–vendedor), Autopiloto (métricas diarias por creativo,
límites del vendedor, bitácora de acciones), creadores y afiliados (atribución lista, `CreatorProfile`
y comisiones después), publicidad interna (P7), app móvil (`/api/v1`), video (`MediaProcessor`),
búsqueda semántica y por foto (pgvector).
