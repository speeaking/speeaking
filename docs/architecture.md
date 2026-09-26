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

| Módulo      | Responsabilidad                                                                |
| ----------- | ------------------------------------------------------------------------------ |
| `identity`  | Registro, sesión, perfiles, activar vendedor, consentimientos                  |
| `social`    | Publicaciones, comentarios, likes, guardados, seguidores, comunidades          |
| `media`     | Subida, validación y re-codificación de imágenes; video (Sprint 2)             |
| `feed`      | RecommendationEngine, Commerce Engine, política de mezcla, impresiones         |
| `catalog`   | Productos, categorías, costo privado, datos estructurados de envío y garantía  |
| `commerce`  | Carrito, checkout, órdenes, pagos (Sprint 2)                                   |
| `ai`        | Vende con IA, generación de contenido, registro de uso y costo de IA           |
| `analytics` | `track()`, taxonomía de eventos, atribución, métricas del Studio               |
| `platform`  | Parámetros ajustables y bitácora del motor de automejora (se crea en fase 1.2) |

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

| Interfaz          | Sprint 1                                  | Después                                      |
| ----------------- | ----------------------------------------- | -------------------------------------------- |
| `AIProvider`      | `MockAIProvider` determinista             | Claude vía SDK oficial (salida estructurada) |
| `PaymentProvider` | `MockPaymentProvider` (pasarela simulada) | Mercado Pago / Stripe con reparto de fondos  |
| `StorageProvider` | Disco local (`.data/uploads`)             | S3 / Cloudflare R2                           |
| `EmailProvider`   | Consola                                   | Resend / SES                                 |
| `MediaProcessor`  | Imágenes con `sharp`                      | Video con proveedor gestionado (S2)          |

La implementación se elige por variable de entorno en `server/providers/<tipo>/index.ts`.

## Feed, comunidades y Commerce Engine

- **Comunidades por nicho** (curadas por la plataforma en V0.1): el onboarding pide elegir al menos 3.
  Cada comunidad se relaciona con categorías de producto, lo que conecta interés social con intención
  comercial.
- **RecommendationEngine** (interfaz): `getFeed({ viewerId, cursor, limit }) → { items, nextCursor }`.
  La implementación v0 es explicable: candidatos → puntuación → Commerce Engine → reglas de mezcla →
  paginación por cursor.
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
creadores, con la IA como operadora principal.

**Ciclo:** medir → detectar oportunidad → proponer (hipótesis + impacto esperado) → experimentar →
evaluar contra métricas de salud → adoptar o revertir → aprender.

| Nivel de riesgo | Ejemplos                                                                                                                      | Autonomía                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Bajo            | Pesos del feed, proporción comercial dentro de límites, orden de comunidades, rotación de creativos, horarios de notificación | Automática, con límites y reversión automática si una métrica de salud cae |
| Medio           | Nuevas comunidades, contenido semilla, variantes de onboarding, textos de la interfaz                                         | Propone y ejecuta como experimento con muestra pequeña                     |
| Alto            | Precios, comisiones, políticas, gasto de dinero, cambios de código, mensajes masivos, eliminar datos                          | Solo propone; requiere aprobación humana                                   |

**Componentes (base en Sprint 1, lógica en sprints siguientes):**

- `PlatformSetting`: parámetros versionados con esquema y límites (p. ej. `feed.policy`).
- `PlatformDecision`: bitácora de cada propuesta o cambio: quién (IA o humano), hipótesis, parámetro,
  valor anterior/nuevo, estado (propuesta, aprobada, aplicada, revertida), impacto medido.
- Experimentos (Sprint 2–3): asignación estable por usuario, métricas desde `AnalyticsEvent`.
- Analista diario (Sprint 3): un LLM lee métricas agregadas y genera propuestas en el Centro de
  decisiones; los cambios de código se proponen como pull requests con pruebas, nunca directo a
  producción.

**Salvaguardas:** métricas de salud que ningún experimento puede degradar (reportes, "no me interesa",
contenido comercial visto), interruptor de apagado, sin patrones oscuros y sin usar datos externos.

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

## Seguridad

- Cabeceras base en `next.config.ts` (nosniff, DENY de iframes, Referrer-Policy, Permissions-Policy,
  HSTS en producción) y sin `X-Powered-By`. CSP con nonces se agrega con la autenticación.
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

## Preparado, no implementado

AI Sales Agent (requiere mensajería comprador–vendedor), Autopiloto (métricas diarias por creativo,
límites del vendedor, bitácora de acciones), creadores y afiliados (atribución lista, `CreatorProfile`
y comisiones después), publicidad interna (P7), app móvil (`/api/v1`), video (`MediaProcessor`),
búsqueda semántica y por foto (pgvector).
