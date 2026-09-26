# Auditoría de seguridad de VendeIA — 2026-09-26

> Alcance: aplicación propia de VendeIA (`E:\vendeia`), corriendo en desarrollo en `http://localhost:3000`
> (Next.js 16.3 App Router, React 19.2, Prisma 7 + PostgreSQL 17, Better Auth 1.7.5, almacenamiento local).
> Auditoría autorizada por el dueño. Pruebas estáticas (lectura de código) y dinámicas de solo prueba contra
> `localhost`; base de datos consultada en modo lectura. No se modificó ningún archivo de `src/`, `prisma/`,
> `tests/`, `scripts/`, `docs/` (salvo este archivo) ni configuración. Los PoC y sus salidas viven en
> `E:\vendeia\.data\security\` (ignorado por git). Las cuentas de prueba usan `e2e.sec.<aleatorio>@example.com`
> y se limpian con `pnpm db:clean-e2e`.

---

## 1. Resumen ejecutivo

VendeIA está bien construida en los fundamentos que más suelen fallar: **no encontramos inyección SQL, XSS ni
IDOR** en los flujos revisados. Todas las consultas crudas están parametrizadas, React escapa el contenido, y la
autorización por dueño se aplica de forma consistente en Server Actions, route handlers y consultas. Eso es
mérito real y poco común en un MVP.

El riesgo no está en el código de negocio, sino en **la frontera entre "listo para producción" y "todavía es un
piloto simulado"**. Cuatro cosas destacan:

1. **La pasarela de pago simulada no tiene ningún freno para producción.** Si este build se despliega tal cual,
   cualquier comprador marca su propio pedido como _Pagado_ sin pagar, y el vendedor ve "Pagado" sin ninguna
   señal de que fue simulado. Es intencional para V0.1 y está documentado, pero **nada falla al arrancar** si se
   despliega por error. Es el hallazgo número uno.

2. **El límite de intentos de login y registro no protege a los usuarios reales.** El `rateLimit` de Better Auth
   solo cubre las rutas HTTP `/api/auth/*`, que la interfaz nunca usa. Todo el login y el registro reales pasan
   por Server Actions que llaman `auth.api.*` directamente y **eluden por completo el limitador**. En producción,
   fuerza bruta y creación masiva de cuentas quedan sin freno. Lo confirmamos en vivo: 110 intentos de login por
   la interfaz, cero bloqueos.

3. **Subir imágenes puede tumbar el servidor.** El tope de 10 MB solo mira `Content-Length`; con
   `Transfer-Encoding: chunked` el cuerpo se lee entero en memoria antes de rechazarlo. Reproducido: un cuerpo de
   300 MB consumió ~600 MB de RAM antes del 422.

4. **La autonomía que preguntas ("que todo esto funcione solo") depende de piezas que aún son simulacros:**
   pagos, IA y correo son _mocks_. Antes de que funcionen de verdad hay que cerrar los guardianes que hoy están
   ciegos: el presupuesto de IA tiene una condición de carrera y no cuenta las llamadas fallidas (fuga de dinero
   el día que se conecte un proveedor real), y no existe verificación de correo ni recuperación de cuenta.

Fuera de eso, hay un conjunto sólido de riesgos **medios de privacidad y abuso** que sí conviene cerrar antes de
atraer gente real: el vendedor recibe el domicilio y teléfono de compradores que nunca pagaron; los eventos
"anónimos" se pueden re-identificar; falta CSP; y varias acciones sociales y de comercio no tienen límite de
frecuencia (spam, acaparamiento de inventario).

**Postura general:** el núcleo es seguro para seguir desarrollando. **No está listo para un lanzamiento público
ni para pagos reales.** La lista de bloqueadores para producción está en la sección 6. Ninguno de los hallazgos
es una toma de cuenta remota, RCE ni fuga masiva de datos hoy; son fallas de configuración de despliegue,
control de tasa y minimización de datos.

**Conteo:** 1 crítica, 3 altas, 15 medias, ~14 bajas, resto informativas/endurecimiento.

---

## 2. Alcance y metodología

Auditoría en **diez especialidades**, cada una con revisión estática exhaustiva y, donde aportaba, pruebas
dinámicas contra `http://localhost:3000` con cuentas de prueba, más una **verificación adversarial**: cada
hallazgo pasó por un segundo revisor que intentó refutarlo, re-corrió los PoC y ajustó la severidad. Los
hallazgos "refutados" (anexo A) y "revisados y correctos" (sección 5) salen de ese contraste.

Especialidades: **autenticación** (authn), **autorización** (authz), **inyección** (SQLi/XSS/redirección),
**subida de archivos** (uploads), **comercio y pagos** (commerce), **privacidad y cumplimiento** (LFPDPPP),
**abuso y límites de tasa** (abuse), **configuración y cadena de suministro** (config), **pentest dinámico**
(pentest) y **superficie de IA presente y futura** (ai-future).

- **Estático:** lectura de las 28 Server Actions (`use server`), route handlers (`/api/auth/[...all]`,
  `/api/feed`, `/api/uploads`, `/media/[...key]`), esquema Prisma, `src/server/*`, `next.config.ts`, `src/proxy.ts`
  y trazas dentro de `node_modules/better-auth@1.7.5` y `@better-auth/core`.
- **Dinámico:** PoC en `E:\vendeia\.data\security\` (redirección abierta, bypass del rate limit por Server
  Action, DoS de subida por chunked, pixel-flood del threadpool, auto-aprobación de pago simulado, filtración del
  grafo de seguidos, exposición de domicilio en pedido cancelado, carrera del presupuesto de IA, etc.).
- **Base de datos:** consultas de solo lectura (`BEGIN READ ONLY`) contra el clúster de desarrollo en
  `localhost:5434`.
- **Producción:** dónde la task lo permitía, se razonó el comportamiento con `NODE_ENV=production` sin construir
  ni reiniciar el servidor (pagos mock, cookies, cabeceras, resolución de IP).

Los hallazgos duplicados entre especialidades se **fusionaron por causa raíz** (un solo ítem conserva todos los
`sourceIds`). El orden es por severidad verificada y luego por explotabilidad.

---

## 3. Tabla de hallazgos

| Ref    | Severidad | Estado        | Reproducido    | Título                                                                                                       |
| ------ | --------- | ------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| SEC-01 | Crítica   | Confirmado    | Sí             | Pasarela de pago simulada activa sin freno en producción: pedidos "pagados" sin pago                         |
| SEC-02 | Alta      | Confirmado    | Sí             | Login y registro sin límite de intentos: las Server Actions eluden el rateLimit de Better Auth               |
| SEC-03 | Alta      | Confirmado    | Sí             | `/api/uploads` bufferiza cuerpos sin tope (chunked) → DoS por memoria de toda la app                         |
| SEC-04 | Alta      | Confirmado    | Sí             | Redirección abierta post-login: `safeRedirectPath` acepta `/.//dominio`                                      |
| SEC-05 | Media     | Confirmado    | Sí             | Acaparamiento de inventario: checkouts pendientes ilimitados reservan stock                                  |
| SEC-06 | Media     | Confirmado    | Sí             | Sin Content-Security-Policy (ni COOP/CORP) en las páginas HTML                                               |
| SEC-07 | Media     | Confirmado    | Sí             | El rate limit y la IP de sesión confían en `X-Forwarded-For` sin proxies de confianza                        |
| SEC-08 | Media     | Confirmado    | Sí             | El vendedor ve nombre, domicilio y teléfono de compradores que nunca pagaron                                 |
| SEC-09 | Media     | Confirmado    | Sí             | API HTTP de Better Auth abierta: registro sin consentimiento y `name`/`image` sin validar                    |
| SEC-10 | Media     | Confirmado    | Sí             | Sin verificación de correo, recuperación ni gestión de sesiones: squatting y bloqueo permanente              |
| SEC-11 | Media     | Confirmado    | Sí             | Enumeración de cuentas por el registro (mensaje y tiempo distintos)                                          |
| SEC-12 | Media     | Confirmado    | Sí             | Límite de 60 subidas/h con carrera (TOCTOU) que además ignora las subidas fallidas                           |
| SEC-13 | Media     | Confirmado    | Sí             | Pixel-flood: imágenes de pocos KB y ~40 Mpx bloquean el threadpool de libuv                                  |
| SEC-14 | Media     | Confirmado    | Sí             | Subidas huérfanas nunca se borran y quedan públicas con caché inmutable de 1 año                             |
| SEC-15 | Media     | Confirmado    | Sí             | Escrituras sociales y `/api/feed` sin límite de frecuencia (spam, amplificación de caché)                    |
| SEC-16 | Media     | Confirmado    | Sí             | Eventos "anónimos" re-identificables por metadata (checkoutId/orderId/responseId, tiempo)                    |
| SEC-17 | Media     | Confirmado    | Sí             | "Gente de tus comunidades" revela a quién sigue una persona concreta                                         |
| SEC-18 | Media     | Confirmado    | Sí             | Suplantación editorial: cualquiera se llama "Equipo VendeIA" con `equipo.*`/`vendeia.*`                      |
| SEC-19 | Media     | Confirmado    | Sí (mecanismo) | Presupuesto de IA: carrera, costos no contabilizados y pool global (latente hasta proveedor real)            |
| SEC-20 | Media     | Confirmado    | Sí (parcial)   | Métricas del vendedor manipulables: shares/vistas/impresiones anónimas y atribución sin verificar            |
| SEC-21 | Baja      | Confirmado    | Sí (mecanismo) | `env-schema` acepta `http`/`localhost` en producción: cookies sin `Secure`, base sin TLS                     |
| SEC-22 | Baja      | Confirmado    | Sí             | Node.js 22.16.0 sin parches de seguridad de 2026; `engines` permite runtimes vulnerables                     |
| SEC-23 | Baja      | Confirmado    | Parcial        | Robustez de checkout: doble envío, checkout huérfano, aprobación tardía, zona local, overflow int32          |
| SEC-24 | Baja      | Confirmado    | Traza          | `SellerStatus = SUSPENDED` no se aplica en ninguna acción ni consulta                                        |
| SEC-25 | Baja      | Sin verificar | Traza          | `advanceOrderAction` no valida `to`; no existe cancelación ni reembolso tras PAID                            |
| SEC-26 | Baja      | Confirmado    | Sí             | Derechos ARCO prometidos en el aviso pero no implementados (exportar/borrar)                                 |
| SEC-27 | Baja      | Confirmado    | Sí             | Rechazar personalización no desliga la actividad previa; historial de búsqueda no borrable                   |
| SEC-28 | Baja      | Confirmado    | Sí             | Salida de IA solo validada en forma: afirmaciones P4 falsas, CLABE, urgencia, cifras como "Calculado"        |
| SEC-29 | Baja      | Confirmado    | Sí             | `AIRequest.input` guarda texto libre con posible PII, sin retención; aviso omite al proveedor de IA          |
| SEC-30 | Baja      | Sin verificar | No             | Contraseñas sin verificación contra listas filtradas                                                         |
| SEC-31 | Baja      | Confirmado    | Sí             | Cursor de feed con timestamp fuera de rango provoca 500 (Invalid Date)                                       |
| SEC-32 | Baja      | Sin verificar | No             | Búsqueda `LIKE '%x%'` sin índice: escaneo completo por petición (DoS de crecimiento)                         |
| SEC-33 | Baja      | Confirmado    | Sí             | Los `userId` públicos (UUIDv7) revelan la fecha/hora exacta de creación de la cuenta                         |
| SEC-34 | Baja      | Sin verificar | No             | El aviso de privacidad omite datos y transferencias que el sistema sí trata                                  |
| SEC-35 | Baja      | Confirmado    | Sí             | El optimizador `/_next/image` acepta cualquier ruta local en vez de solo `/media/**`                         |
| SEC-36 | Baja      | Sin verificar | Sí             | `sharp` pasa por librsvg/libtiff antes del filtro de formato (superficie nativa)                             |
| SEC-37 | Baja      | Confirmado    | Sí             | Cadena de suministro: Next 16.3.7 pendiente, CLI de Prisma con advisories, endurecer pnpm                    |
| SEC-38 | Baja      | Sin verificar | No             | Filas sin tope (consentimientos/intenciones) y argumentos de Server Actions sin validar                      |
| SEC-39 | Info      | Confirmado    | Parcial        | Gobernanza sin roles/aprobación, BD como superusuario, seed reclamable, ledger bruto                         |
| SEC-40 | Info      | Mixto         | Parcial        | Endurecimientos varios: token de sesión en claro, guard de Studio, errores 500, CSRF de uploads, dev en `::` |

Los ítems **refutados** están en el **anexo A**.

### 3.0 Resultado del retest (2026-09-26)

Un pentester independiente repitió los PoC contra la app corregida (`.data/security/retest/`).

| Estado                                    | Hallazgos                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cerrados** (retest en vivo)             | SEC-01, 02, 03, 04, 05, 06, 07 (mecanismo), 08, 09, 12, 13, 14, 15, 16, 17, 18, 19, 20, 31, 32, 35                                                                                                                                                                                                                                   |
| **Cerrados por el lead** (tras el retest) | SEC-21: en producción `APP_URL` debe ser https y la base remota debe usar `sslmode=require/verify-*` (loopback permitido para probar el build en local); cookies `Secure` con https (`advanced.useSecureCookies`). SEC-22: `engines.node` sube a `>=22.23.2 <23 \|\| >=24`; **hay que actualizar Node en la máquina** (hoy v22.16.0) |
| **Parciales**                             | SEC-10 (tope absoluto de 90 días por sesión cerrado; verificación y recuperación de correo necesitan proveedor de correo), SEC-11 (mismo mensaje y tiempo; el cierre real llega con la verificación de correo), SEC-23 (doble envío, interbloqueo y huérfanos cerrados; reembolsos y validación de zona local pendientes)            |
| **Pendientes de fase posterior**          | SEC-26 (exportar/borrar cuenta), SEC-39 (roles de administración y aprobación para el motor de automejora)                                                                                                                                                                                                                           |

Compromisos documentados que dejó la corrección:

- El límite de inicio de sesión por correo (5 en 15 min) deja que un tercero bloquee 15 min el acceso de un correo conocido. Es deliberado contra el relleno de credenciales; revisar con datos reales.
- Un cursor del feed de más de 7 días responde 400; el feed lo toma como el final de la lista (sin reintentos automáticos).
- Variables nuevas: `TRUSTED_PROXY_HOPS` (fijarla según la topología real antes de producción), `PAYMENT_PROVIDER` y `ALLOW_SIMULATED_PAYMENTS` (no fijarla en producción salvo piloto cerrado).
- Tareas programadas que hay que agendar al desplegar: `expireStaleCheckouts`, `scripts/cleanup-orphan-media.ts` y la limpieza de entradas de IA vencidas.

### 3.1 Estado de la corrección (2026-09-26)

La corrección se hizo por frentes en paralelo. Esta tabla la mantiene el frente de privacidad (CSP,
analítica, sugerencias, IA y aviso); los ítems de otros frentes se consolidan con su reporte. Leyenda:
**Corregido** (con prueba de regresión y, si se reprodujo por HTTP, E2E o PoC re-ejecutado),
**Parcial** (queda riesgo residual documentado), **Riesgo aceptado** (documentado en un ADR),
**Pendiente de consolidar** (lo reporta otro frente).

Una revisión adversarial posterior del frente (`.data/security/privacy-review/`) encontró que el id
UUIDv7 de los eventos anónimos deshacía el truncado de la hora (SEC-16) y que el guardián de IA dejaba
pasar frases comunes (SEC-28); ambos quedaron corregidos con pruebas. Las filas anónimas guardadas
antes conservan su UUIDv7; en una base con datos, una limpieza única:
`UPDATE analytics_events SET id = gen_random_uuid() WHERE "userId" IS NULL AND "createdAt" = date_trunc('hour', "createdAt");`

| Ref    | Estado                  | Qué cambió                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Evidencia                                                                                                                                                                                                                           |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-06 | Corregido               | CSP con nonce por petición en `src/proxy.ts` (`src/lib/csp.ts`), `strict-dynamic`, `object-src`/`base-uri 'none'`, `frame-ancestors 'none'`, `form-action`/`connect-src 'self'`; COOP y CORP `same-origin`. Modo de aplicación, no `Report-Only`. `style-src 'unsafe-inline'` como riesgo aceptado (ADR-029). Verificado contra `pnpm dev` (con `'unsafe-eval'`); falta correr la misma E2E contra `pnpm build && pnpm start`. El 404 HTML de `/api/*` sale sin CSP (página estática, sin datos del usuario).                                                                                                                 | `src/lib/csp.test.ts`; `tests/e2e/security-headers.spec.ts` (cero violaciones en todas las páginas, móvil y escritorio; un `onerror` inyectado no corre; nonce del cliente ignorado).                                               |
| SEC-07 | Parcial                 | `src/server/client-ip.ts` con `TRUSTED_PROXY_HOPS` y cabecera interna para Better Auth. Falta el cableado en las acciones de autenticación.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Reporte del frente base; `.data/security/xff/poc-sec07-rerun-base.out.txt`.                                                                                                                                                         |
| SEC-16 | Corregido               | `prepareEvent` sin personalización: metadata solo con llaves permitidas (sin `*Id` ni la razón del ranking), sin texto de búsqueda, hora truncada, sin la entidad en propuestas de IA y **con id aleatorio (UUIDv4)**. Revisión: el id UUIDv7 por omisión guardaba la hora al milisegundo y deshacía el truncado (PoC: 5 altas y 1 checkout re-identificados); `anonymizeUserActivity` también cambia el id. Residual: con poco volumen, entidad + hora sigue acotando (k pequeño) y el orden físico de inserción no se oculta. Las filas anónimas anteriores conservan su UUIDv7 (limpieza única en el reporte del revisor). | `analytics/event.test.ts`, `analytics/privacy.db.test.ts` (falla sin el id nuevo); `.data/security/privacy-review/reident-by-id.*`, `anon-id-versions.*`.                                                                           |
| SEC-17 | Parcial                 | Intermediarios solo seguidos mutuos que participan en sugerencias; al menos 2 distintos; la razón no dice cuántos. Residual: cuentas títere de alguien a quien la víctima sigue de vuelta; la corrección completa (consentimiento del intermediario) requiere migración (ADR-030).                                                                                                                                                                                                                                                                                                                                            | `discovery/{suggestions,queries,service}.test.ts`; PoC re-ejecutado: unilateral y mutuo con 1 intermediario ya no muestran a nadie.                                                                                                 |
| SEC-19 | Corregido               | Reserva antes de llamar: cuotas por hora y por día con `rateLimit`; presupuesto global con `pg_advisory_xact_lock` que cuenta el costo máximo de pendientes y fallidas; modelo sin precio no se llama; timeout; mensaje de respaldo. Pendiente antes de un proveedor de pago: `max_tokens` en el adaptador y correo verificado (ADR-031).                                                                                                                                                                                                                                                                                     | `ai/reservation.db.test.ts` (12 simultáneas con lugar para 3 → 3), `ai/service.test.ts`; PoC re-ejecutado: 60 en paralelo → 20 en total (antes 94).                                                                                 |
| SEC-27 | Corregido               | Antes del onboarding nada se liga; desactivar la personalización desliga toda la actividad previa en la misma transacción (con id nuevo); historial de búsqueda visible y borrable en Ajustes; `z.boolean()` en la acción. Residual menor: un evento que ya leyó «personalización activa» y se inserta justo después del cambio queda ligado (ventana de milisegundos; cerrarla es un `FOR SHARE` en `track.ts`).                                                                                                                                                                                                             | `analytics/privacy.db.test.ts`; `tests/e2e/privacy-controls.spec.ts`; PoC re-ejecutado: nada ligado a quien rechazó la personalización.                                                                                             |
| SEC-28 | Corregido               | El rango de precio y el presupuesto diario los calcula el código; guardián de contenido (contacto, pago, urgencia, afirmaciones P4, cifras) al generar y al prellenar; nombre confirmado por el vendedor; tarjetas etiquetadas «Calculado» o «Redactado por IA». Revisión: 22 de 24 frases comunes pasaban («hasta agotar existencias», «envío incluido», «meses sin intereses», «190 dólares», «deposítame»…); ahora se quitan, el texto se normaliza (NFKC, sin invisibles) y las cifras se revisan sin el nombre del producto. Es una lista de patrones: no sustituye la revisión del vendedor.                            | `ai/{output-guard,proposal-numbers,personal-data}.test.ts`, `ai/components/proposal-view.test.tsx`; `.data/security/ai-future/output-validation-rerun.out.txt`; `.data/security/privacy-review/guard-probe.{before,after}.out.txt`. |
| SEC-29 | Parcial                 | Texto guardado sin correos, teléfonos, ligas ni cuentas (también con dígitos de ancho completo o invisibles); retención de 90 días (`{ redacted: true }`); aviso bajo el campo; el aviso de privacidad explica la IA. Falta: la retención solo corre cuando alguien usa «Vende con IA» (a lo más cada hora por proceso); sin uso, el texto pasa de 90 días. Hace falta una tarea programada que llame `redactExpiredAiInputs`. Pendiente también el comentario de `AIRequest.input` en el esquema.                                                                                                                            | `ai/personal-data.test.ts`, `ai/reservation.db.test.ts` (retención), `ai/service.test.ts`.                                                                                                                                          |
| SEC-33 | Riesgo aceptado         | Los `userId` UUIDv7 siguen en DTOs públicos (feed, catálogo, sugerencias, seguir); cambiarlos toca cuatro módulos. Se revisa antes del lanzamiento público (ADR-030).                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                                                                                                                                                                                                   |
| SEC-34 | Parcial                 | El aviso lista IP y dispositivo, domicilios y teléfono, lo público e indexable, «Vende con IA», retención y encargados (alojamiento, pagos, correo, IA) con la regla de nombrarlos antes de activarlos. Falta subir `LEGAL_VERSIONS.privacyNotice` y `discoverability` a `2026-09-26`: mientras no suba, quien acepta el texto nuevo queda registrado con la versión anterior.                                                                                                                                                                                                                                                | Revisión del texto (`src/app/(legal)/privacidad/page.tsx`).                                                                                                                                                                         |
| SEC-35 | Corregido               | `images.localPatterns: [{ pathname: "/media/**", search: "" }]`, sin `remotePatterns` ni SVG.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `tests/e2e/security-headers.spec.ts` (200 en `/media`, 400 con query, íconos y SVG).                                                                                                                                                |
| Resto  | Pendiente de consolidar | Lo corrigen otros frentes (autenticación, pagos, comercio, subidas, abuso, identidad).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Sus reportes.                                                                                                                                                                                                                       |

---

## 4. Detalle por hallazgo

### SEC-01 — Pasarela de pago simulada activa sin freno en producción (Crítica)

**Estado:** Confirmado, reproducido de punta a punta. **Esfuerzo:** M.
**Fuentes:** `authz-mock-payment-self-approval-prod`, `commerce-mock-payment-in-production`,
`config-mock-payments-reachable-in-production`, `pentest-mock-payments-prod`, `abuse-mock-payments-fake-sales-metrics`.

**Ubicación:** `src/server/providers/payments/index.ts:8-11`; `src/modules/commerce/actions.ts:171-194`
(`simulatePaymentAction`); `src/app/(social)/checkout/pago/[ref]/page.tsx:14-45`;
`src/modules/commerce/checkout.ts:274-292` (`applyPaymentEvent`); `src/server/env-schema.ts:7-14` (sin variable de
proveedor); `src/app/studio/pedidos/page.tsx:49-79`.

**Escenario:** `getPaymentProvider()` hace `provider ??= new MockPaymentProvider()` **sin mirar el entorno**. En
producción, cualquier comprador confirma el checkout, cae en `/checkout/pago/mock_<ref>` y pulsa "Pagar
(simulado)" — o llama directo a `simulatePaymentAction(ref, "APPROVED")`. La única comprobación es
`buyerId === viewer.userId`, así que **el propio comprador aprueba su pago**. `applyPaymentEvent` deja
`Checkout` y `Order` en `PAID`, descuenta stock y (si `platformFeeBps > 0`) escribe COMMISSION en el ledger. El
vendedor ve "Pagado" y "Marcar enviado" **sin ninguna etiqueta de "simulado"** y envía la mercancía.

**Evidencia:** PoC end-to-end (`.data/security/verify-A-mock-payment/`, `verify-A-fake-sales-metrics/`,
`payments/poc-mock-payment.mjs`). Vendedor publica un producto de $3,499; el comprador confirma y hace `POST /`
con `Next-Action: 60a9108e…` y `["mock_…","APPROVED"]` **sin siquiera pulsar el botón**. Resultado en BD:
`payment=APPROVED`, `checkout=PAID`, `order=PAID` con `paidAt`, stock decrementado. El Studio del vendedor:
"Pagado · Marcar enviado · Tu beneficio estimado $976.53", sin mención de simulación. El control de dueño sí
funciona (una tercera cuenta no puede aprobar el pago de otro). No cambia con `NODE_ENV=production`: no hay
ninguna rama por entorno en toda la ruta; el build de `.next` ya contiene la clase mock sin comprobaciones.

**Impacto:** al desplegar tal cual, **cualquier cuenta obtiene mercancía gratis** y los vendedores la envían sin
cobrar; se falsean ventas, beneficio y conversión del Studio; con comisión > 0 se inflan asientos COMMISSION que
suben el presupuesto de IA del mes siguiente. Es manipulación total de pago (rubro crítico). Mitigante honesto:
hoy es el comportamiento de V0.1 documentado (ADR-011/023) y avisado al comprador ("pasarela simulada, no se
cobra"); no existe un riel de pago real que saltarse. La criticidad viene de que **no hay fail-safe** y de que
la vista del vendedor presenta la venta simulada como real.

**Corrección:**

1. `env-schema.ts`: `PAYMENT_PROVIDER: z.enum(["mock"]).default("mock")` y
   `ALLOW_SIMULATED_PAYMENTS: z.stringbool().default(false)`, con `superRefine` que **falle al arrancar** si
   `NODE_ENV==="production" && PAYMENT_PROVIDER==="mock" && !ALLOW_SIMULATED_PAYMENTS`. Así un piloto simulado en
   producción es una decisión consciente.
2. `getPaymentProvider()` elige el proveedor según `env.PAYMENT_PROVIDER`.
3. Primera línea de `simulatePaymentAction` y de `MockPaymentPage`:
   `if (!simulatedPaymentsEnabled()) notFound();`.
4. En `applyPaymentEvent`, **no** escribir COMMISSION cuando `payment.provider === "mock"`.
5. En `/studio/pedidos`: seleccionar `payment.provider` y mostrar "Pago simulado: no envíes mercancía",
   ocultar "Marcar enviado" y excluir ventas simuladas del beneficio.
6. Con el proveedor real, `PAID` solo por **webhook con firma verificada** + consulta servidor-a-servidor,
   nunca por una acción que dispare el navegador. Mover `paymentEvent.create` detrás del candado de estado (hoy
   cada reintento agrega una fila de auditoría).

---

### SEC-02 — Login y registro sin límite de intentos: las Server Actions eluden el rateLimit (Alta)

**Estado:** Confirmado, reproducido en vivo. **Esfuerzo:** M.
**Fuentes:** `authn-server-action-rate-limit-bypass`, `abuse-auth-ratelimit-bypassed-by-server-actions`,
`config-auth-ratelimit-not-applied-to-server-actions`.

**Ubicación:** `src/modules/identity/actions.ts:49` (`auth.api.signUpEmail`), `:82` (`auth.api.signInEmail`);
`src/server/auth.ts:33-42` (`rateLimit.customRules`); `node_modules/better-auth/dist/api/index.mjs:172`
(`onRequestRateLimit` solo en el router HTTP).

**Escenario:** En Better Auth 1.7.5 el limitador (`onRequestRateLimit`) corre **únicamente** en el
`onRequest` del router HTTP, es decir, en peticiones a `/api/auth/*`. Las llamadas directas `auth.api.*` pasan
por `toAuthEndpoints`/`dispatch`, que **nunca** ejecuta ese hook. La interfaz de VendeIA **no usa** `/api/auth/*`
(0 resultados de `createAuthClient`/`better-auth/react`/`/api/auth/` en `src/`); todo el login y registro reales
van por `signInAction`/`signUpAction`, que llaman `auth.api.*`. Por eso los `customRules` de producción (5/min
login, 3/min registro) **nunca se aplican al flujo real**.

**Evidencia:** PoC en vivo (`.data/security/ratelimit-poc/`, `config/poc-ratelimit.*`,
`finding-auth-ratelimit-bypass.txt`). 110 intentos de login fallidos por `signInAction` (con los campos
`$ACTION_*` de la mejora progresiva): 110 llegaron a la capa de auth, **0 respondieron 429**, 51.8 s sin
bloqueo, y la fila de `rate_limits` de esa IP se quedó en `count=1`. Control: un solo POST a
`/api/auth/sign-in/email` sí creó/incrementó la cubeta y, a 112 intentos, devolvió 429 desde el intento 101. Es
decir, el límite existe pero solo en una superficie que la UI no toca; el mensaje 429 de `auth-errors.ts:18` es
inalcanzable desde la interfaz.

**Impacto:** en producción, **fuerza bruta y credential stuffing sin límite** contra cualquier correo (el mínimo
de 10 caracteres no protege contraseñas reutilizadas), **creación masiva de cuentas** (que a su vez multiplica
los límites por usuario de IA 20/h y subidas 60/h), y cada intento ejecuta scrypt (costo de CPU). La protección
documentada en `architecture.md` da falsa sensación de seguridad.

**Corrección:** limitador propio en las Server Actions **antes** de `auth.api.*`, con incremento atómico sobre la
tabla `rate_limits` (o una nueva): claves `signin:ip:<ip>` (p. ej. 10/15 min), `signin:email:<correo>` (5/15 min,
independiente de IP para frenar ataques distribuidos) y `signup:ip:<ip>` (3/min). Devolver el mismo mensaje 429
genérico ya mapeado. La IP debe resolverse con la política confiable de SEC-07. Alternativa: reenviar la acción
por `auth.handler(new Request(`${APP_URL}/api/auth/sign-in/email`, …))` para pasar por el router (límite + origin
check) y reenviar `Set-Cookie` con `cookies()`. Añadir prueba E2E: 6 intentos por la UI → mensaje de límite.

---

### SEC-03 — `/api/uploads` bufferiza cuerpos sin tope (chunked) → DoS por memoria (Alta)

**Estado:** Confirmado, reproducido. **Esfuerzo:** S.
**Fuentes:** `uploads-chunked-body-unbounded`, `config-upload-body-size-content-length-only`,
`abuse-upload-body-unbounded-and-uncounted-failures`.

**Ubicación:** `src/app/api/uploads/route.ts:29-32` (tope por `content-length`), `:41` (`request.formData()`),
`:45` (`Buffer.from(await file.arrayBuffer())`); `src/modules/media/image-processing.ts:35` (chequeo real de
tamaño, ya tarde).

**Escenario:** con `Transfer-Encoding: chunked` no hay `Content-Length`, así que
`Number(null ?? 0) = 0` y el tope de 10 MB de la línea 30 no aplica. `request.formData()` lee el cuerpo completo
a memoria y `file.arrayBuffer()` lo copia de nuevo; el límite real solo se comprueba en `processImage`, cuando la
memoria ya se ocupó. Además, `/api/uploads` no está en el matcher de `proxy.ts`, así que no hay tope de cuerpo del
lado de Next. Los rechazos (422) no crean fila `Media`, así que el conteo de 60/h nunca los cuenta: se puede
repetir sin fin.

**Evidencia:** PoC (`.data/security/uploads/poc-chunked.*`, `verify-A-uploads-chunked/`). Con `Content-Length` de
11 MB → 413 inmediato. El **mismo** cuerpo enviado chunked de 12 MB → 422 (leído entero); 200 MB chunked → 422 en
~22 s con `+800 MB` de working set (~4× el cuerpo); 300 MB → `+596 MB`. 70 subidas inválidas seguidas → 70×422,
0 rechazos por límite. Un cuerpo chunked de 2–3 GB, o unos pocos de 500 MB en paralelo, agotan la RAM y tumban el
proceso Node — **toda la app cae para todos**.

**Impacto:** denegación de servicio de toda la aplicación desde cualquier cuenta autoregistrada (registro
abierto), con una o pocas peticiones. En producción depende del borde: `next start` expuesto directo o detrás de
un proxy que acepte cuerpos grandes = explotable; detrás de un proxy con `client_max_body_size` bajo = mitigado.

**Corrección:** antes de leer el cuerpo, exigir `Content-Type: multipart/form-data` y un `Content-Length` finito
y positivo (`411`/`413` según corresponda). Defensa en profundidad: no usar `request.formData()` a ciegas; leer
`request.body` con un lector que cuente bytes y aborte (`reader.cancel()` + 413) al pasar `MAX_UPLOAD_BYTES`, o
`busboy` con `limits: { fileSize, files:1, fields:0, parts:1 }`. Contar los intentos (no solo los éxitos) hacia
el límite por usuario. En producción, fijar el tope también en el proxy (`client_max_body_size 11m`).

---

### SEC-04 — Redirección abierta post-login: `safeRedirectPath` acepta `/.//dominio` (Alta→Media)

**Estado:** Confirmado, reproducido. **Severidad:** Media (primitiva de phishing, no toma de cuenta). **Esfuerzo:** S.
**Fuentes:** `authn-open-redirect-dot-segments`, `injection-open-redirect-next`.

**Ubicación:** `src/lib/safe-redirect.ts:8-13`; consumidores en `src/app/(auth)/entrar/page.tsx:14`,
`registro/page.tsx:16`, `bienvenida/page.tsx:29`, `src/modules/identity/actions.ts:87`,
`onboarding-actions.ts:62`.

**Escenario:** el guardia `/^\/[/\\]/` valida la cadena **original**, pero luego `new URL()` normaliza el
segmento `.` y devuelve un `pathname` que empieza por `//`, sin re-validar. Entradas como `/.//evil.com`,
`/%2e//evil.com`, `/..//evil.com`, `/a/..//evil.com`, `/./\evil.com` devuelven `//evil.com` (referencia de red,
relativa al protocolo). `redirect("//evil.com")` emite `Location: //evil.example`, que el navegador resuelve como
`http(s)://evil.example`.

**Evidencia:** PoC unitario y HTTP (`.data/security/verifier-a-open-redirect/`,
`verify-A-open-redirect/`). Con sesión: `GET /entrar?next=%2F.%2F%2Fevil.example%2Fphish` → `307` +
`location: //evil.example/phish`. Cadena post-login para usuarios ya incorporados:
`/bienvenida?next=/.//evil.example/entrar` → proxy → `/entrar?next=…` → tras iniciar sesión, `bienvenida/page.tsx`
hace `redirect("//evil.example/entrar")` y el navegador sale del sitio. No depende de `NODE_ENV`.

**Impacto:** phishing muy creíble desde el dominio legítimo justo tras el login (una página "tu sesión expiró"
falsa que cosecha credenciales), y salida inmediata para quien ya tiene sesión (cookie de 30 días). No filtra
token hoy, pero se vuelve alta si se agrega OAuth/SSO o un token en la URL de retorno.

**Corrección:** validar el resultado **ya normalizado**:

```ts
const url = new URL(value, PLACEHOLDER_ORIGIN);
const out = `${url.pathname}${url.search}`;
if (url.origin !== PLACEHOLDER_ORIGIN || /^\/[/\\]/.test(out)) return fallback;
return out;
```

Añadir a `safe-redirect.test.ts` los casos `/.//x`, `/%2e//x`, `/%2E%2E//x`, `/..//x`, `/a/..//x`, `/./\x`
esperando `/`, y una regresión para la cadena anidada de `/bienvenida`.

---

### SEC-05 — Acaparamiento de inventario: checkouts pendientes ilimitados reservan stock (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** M.
**Fuentes:** `commerce-stock-reservation-dos`, `abuse-inventory-hoarding-pending-checkouts`,
`commerce-lazy-expiry-only-on-traffic`.

**Ubicación:** `src/modules/commerce/actions.ts:114-166` (`placeOrderAction`, sin límite);
`src/modules/commerce/checkout.ts:90-101` (descuento de stock y `SOLD_OUT`), `:157` (TTL 30 min), `:366-388`
(`expireStaleCheckouts`); `src/modules/commerce/fees.ts:26` (`CHECKOUT_TTL_MINUTES=30`).

**Escenario:** una **sola** cuenta agrega 10 piezas, confirma el checkout (descuenta stock; si llega a 0 marca
`SOLD_OUT`), el carrito se vacía y repite. No hay tope de checkouts `PENDING_PAYMENT` por comprador, ni de
unidades reservadas, ni límite de frecuencia. Al vencer, `applyPaymentEvent` devuelve el stock **al carrito del
atacante**, que vuelve a reservar con un clic. Agravante: el vencimiento es **perezoso** —
`expireStaleCheckouts` global solo corre cuando _alguien_ confirma un pedido; en un piloto de poco tráfico el
producto sigue `SOLD_OUT` mucho más de 30 min.

**Evidencia:** PoC (`.data/security/abuse/poc-stock-hoarding.*`). Una cuenta agotó un producto de 25 piezas en
~20 s sin pagar (10+10+5), tres checkouts `PENDING_PAYMENT`. El comprador legítimo ve "Agotado". El vendedor no
ve pedidos que lo expliquen (`seller-queries` excluye `PENDING_PAYMENT`). Feed, catálogo y descubrimiento filtran
`stock > 0`, así que el producto desaparece.

**Impacto:** negación de ventas dirigida a cualquier vendedor, barata de automatizar. Crece con OXXO/transferencia
(reservas más largas) y con un proveedor real.

**Corrección:** dentro de la transacción de `placeOrder`, serializar por usuario
(`pg_advisory_xact_lock(hashtext(userId))`), rechazar si ya hay ≥1–2 checkouts `PENDING_PAYMENT` vigentes, y
limitar las unidades reservadas por comprador y producto sumando los pendientes. Límite de frecuencia de
`placeOrderAction` (5/h). Job programado que ejecute `expireStaleCheckouts` cada 1–5 min. Con proveedor real,
TTL corto para métodos instantáneos y verificación de correo antes del checkout.

---

### SEC-06 — Sin Content-Security-Policy (ni COOP/CORP) en las páginas HTML (Media)

**Estado:** Confirmado. **Esfuerzo:** M.
**Fuentes:** `injection-missing-csp`, `config-csp-missing`, `pentest-missing-csp`.

**Ubicación:** `next.config.ts:8-19` (`securityHeaders`, sin CSP); `src/proxy.ts:22-34` (matcher solo de rutas
protegidas). El comentario de `next.config.ts:5` dice que la CSP se agrega "junto con la autenticación" — la
autenticación ya existe.

**Escenario / evidencia:** `curl -sI` a `/`, `/entrar`, `/comprar` devuelve `X-Content-Type-Options`,
`X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`, pero **ninguna** `Content-Security-Policy`,
`Cross-Origin-Opener-Policy` ni `Cross-Origin-Resource-Policy`. La única CSP en `src` es la de `/media`
(`default-src 'none'; sandbox`). Hoy no hay sink de XSS (React escapa; no hay `dangerouslySetInnerHTML`; el único
`href` de usuario, `credit.url`, se filtra con `safeWebUrl` a http/https), así que es **defensa en profundidad**.

**Impacto:** sin segunda barrera, cualquier XSS futuro (una regresión, una dependencia comprometida, un sink de
HTML añadido) escalaría directamente a ejecución de scripts y acciones en nombre del usuario (las cookies son
HttpOnly, pero un script puede invocar Server Actions y leer datos privados ya renderizados: direcciones,
pedidos).

**Corrección:** dos pasos.

1. **Rápido, hoy (S):** en `securityHeaders`, directivas estáticas sin nonce y sin forzar render dinámico:
   `object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:;`
   (+ `upgrade-insecure-requests` en producción).
2. **CSP completa (M):** nonce por petición en `src/proxy.ts` (guía de Next
   `content-security-policy.md`): `script-src 'self' 'nonce-<n>' 'strict-dynamic'`, `style-src 'self' 'nonce-<n>'`,
   `connect-src 'self'`, propagando el nonce por `x-nonce` a `<ThemeProvider nonce>`. Ampliar el matcher a todas
   las rutas HTML (excluyendo `_next/static`, `_next/image`, `media`, `favicon`). Alternativa sin costo de render
   dinámico: `experimental.sri` (CSP por hash). Empezar en `Report-Only` una semana. Añadir COOP `same-origin`.

---

### SEC-07 — El rate limit y la IP de sesión confían en `X-Forwarded-For` sin proxies de confianza (Media)

**Estado:** Confirmado (mecanismo). **Esfuerzo:** S.
**Fuentes:** `authn-xff-ip-trust-production`, `abuse-auth-ip-resolution-shared-bucket`,
`config-auth-ratelimit-xff-spoof`.

**Ubicación:** `src/server/auth.ts:43-47` (sin `advanced.ipAddress`);
`@better-auth/core/dist/utils/ip.mjs` (`getIP`/`getIPFromHeader`).

**Escenario:** sin `trustedProxies`, Better Auth confía en un `x-forwarded-for` de **un solo valor**. **Caso A:**
si Node queda expuesto (o tras un proxy que reenvía el XFF del cliente), el atacante manda un XFF aleatorio por
petición y obtiene una cubeta nueva cada vez → evade el límite HTTP. **Caso B:** un proxy que **agrega** valores
(Cloudflare → nginx) hace que `getIP` devuelva `null` y **todos** compartan la cubeta `no-trusted-ip|/sign-in/email`
→ 5 peticiones bloquean el login por API de toda la plataforma. Además `sessions.ipAddress` queda falsificable
(forense poco confiable).

**Evidencia:** PoC (`.data/security/xff/`, `config/poc-ratelimit.out`). Con `NODE_ENV=production`: un XFF único
`192.0.2.55` se usa como IP; dos saltos `CF, nginx` → `null` → cubeta compartida; con
`trustedProxies:["172.64.0.0/13"]` resuelve bien. En dev, seis intentos con XFF rotado crearon seis filas
separadas en `rate_limits`.

**Impacto:** hoy secundario (la UI no usa `/api/auth/*`, ver SEC-02), pero se vuelve la debilidad decisiva **en
cuanto** se aplique el límite propio de SEC-02, sobre todo si se llavea por la misma IP. Según la topología: o se
evade el límite, o se niega el login a todos.

**Corrección:** en `env-schema` añadir `AUTH_CLIENT_IP_HEADER` y `AUTH_TRUSTED_PROXIES` (CIDR), obligatorios en
producción (`superRefine`). En `auth.ts`:
`advanced.ipAddress: { ipAddressHeaders: [env.AUTH_CLIENT_IP_HEADER], trustedProxies: env.AUTH_TRUSTED_PROXIES }`.
Valores por hosting: Vercel `x-vercel-forwarded-for`; Cloudflare `cf-connecting-ip` **solo** si el origen acepta
tráfico únicamente de CF; nginx `x-real-ip` sobrescrito. Usar la **misma** resolución en el limitador de SEC-02.
Añadir un límite por correo (independiente de IP) para el login. Alertar sobre el warning "could not determine a
client IP".

---

### SEC-08 — El vendedor ve nombre, domicilio y teléfono de compradores que nunca pagaron (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** S.
**Fuentes:** `authz-seller-sees-address-of-unpaid-orders`, `privacy-seller-sees-unpaid-buyer-address`,
`commerce-seller-sees-cancelled-addresses`.

**Ubicación:** `src/modules/commerce/checkout.ts:167-168` (snapshot al crear la orden, antes del pago), `:293-302`
(rama no aprobada: `CANCELLED` sin borrar `shippingAddress`); `src/modules/analytics/seller-queries.ts:90-105`
(`status: { not: "PENDING_PAYMENT" }`, `shippingAddress: true`); `src/app/studio/pedidos/page.tsx:63-68`.

**Escenario:** el comprador escribe su domicilio en `/checkout` (se copia al crear la `Order`, antes de pagar).
El pago se rechaza, vence o se abandona → `CANCELLED`, pero el `shippingAddress` **queda intacto**.
`listSellerOrders` incluye `CANCELLED` y selecciona la dirección. El vendedor ve calle, número, colonia,
municipio, estado y CP de una compra que nunca ocurrió. Un vendedor con productos-señuelo puede **cosechar
domicilios** de quienes solo intentaron comprar.

**Evidencia:** PoC (`.data/security/privacy/poc-commerce.*`, `poc-cancelled-order-address.*`). Comprador escribe
"Calle Secreta 742…", simula pago rechazado; el Studio del vendedor muestra el domicilio con etiqueta
"Cancelado". En BD: `status=CANCELLED`, `paidAt=NULL`, `shippingAddress` con teléfono. (El teléfono no se pinta
en la UI pero se conserva sin plazo.) No depende del proveedor mock: con un PSP real, rechazos y vencimientos
pasan por la misma rama.

**Impacto:** divulgación de datos personales de contacto a un tercero sin la relación comercial que la justifica
(finalidad y minimización, LFPDPPP). El aviso de privacidad no dice que la dirección se comparte con el vendedor.

**Corrección:** (1) en la rama no aprobada de `applyPaymentEvent`,
`data: { status: "CANCELLED", shippingAddress: Prisma.DbNull }`. (2) En `listSellerOrders`, seleccionar
`shippingAddress` solo para `PAID/SHIPPED/DELIVERED` (o mapear a `null` en el DTO). (3) Migración de limpieza:
`UPDATE orders SET "shippingAddress"=NULL WHERE status='CANCELLED';`. (4) Retención: reducir a ciudad/estado N
días después de `DELIVERED`. (5) Prueba E2E: pago rechazado → el vendedor no ve la calle.

---

### SEC-09 — API HTTP de Better Auth abierta: registro sin consentimiento y `name`/`image` sin validar (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** S.
**Fuentes:** `authn-http-signup-bypasses-consent`, `privacy-signup-api-bypasses-consent`,
`config-auth-http-surface-unused`, `injection-auth-api-input-bypass`.

**Ubicación:** `src/app/api/auth/[...all]/route.ts:4` (`toNextJsHandler(auth)` sin allowlist);
`src/server/auth.ts:16-50` (sin `disabledPaths`); `src/modules/identity/actions.ts:42-64` (Zod y consentimiento
que se saltan).

**Escenario:** `POST /api/auth/sign-up/email` con `{name,email,password}` crea usuario y sesión **sin** pasar por
`signUpSchema` (nombre 2–60, `acceptTerms`) ni por el `userConsent.createMany` de TERMS/PRIVACY_NOTICE. El
esquema del endpoint solo valida `name: z.string()` e `image: z.string()`, sin límites. `POST /api/auth/update-user`
acepta `name` de longitud ilimitada e `image` con `javascript:`. La UI **nunca** usa `/api/auth/*` (0
resultados), así que toda esa superficie sobra.

**Evidencia:** PoC (`.data/security/verify-A-signup-consent/`, `verify-auth-input/`). Alta por API → 200 +
cookie; `user_consents = 0`. `update-user` con nombre de 1,000,000 de caracteres → 200; en BD `length(name)=1000000`,
`image="javascript:alert(document.domain)"`. Una página con esa sesión serializa el nombre dos veces (~10.7 MB,
~3 s de render). `user.image` **no** se renderiza hoy (los avatares salen de `Profile.avatarUrl`), así que el XSS
es latente; `user.name` solo lo ve su dueño (escapado por React).

**Impacto:** cuentas sin consentimiento versionado (incumple la regla de aceptación de términos/aviso; carga de
la prueba LFPDPPP), superficie de escritura sin validar (abuso/relleno de BD, amplificación de egress/CPU), y un
sink de XSS latente en `user.image`.

**Corrección:** allowlist en `route.ts` (hoy la UI no necesita ninguna ruta; 404 para todo salvo lo que se use al
agregar verificación/OAuth), o `disabledPaths: ["/sign-up/email","/sign-in/email","/update-user","/change-email",
"/change-password","/delete-user","/request-password-reset","/reset-password","/link-social","/list-accounts",
"/revoke-sessions", …]` (solo afecta al router; `auth.api.*` sigue). Defensa: `databaseHooks.user.create.before`/
`update.before` que apliquen el Zod de nombre y fuercen `image` a `null`; cap de columna `@db.VarChar(60)`.
Grabar el consentimiento en el mismo flujo que la creación. Recordar que cerrar el HTTP **desactiva** los
`customRules` → hay que aplicar SEC-02.

---

### SEC-10 — Sin verificación de correo, recuperación ni gestión de sesiones (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** M.
**Fuentes:** `authn-email-verification-disabled-squatting`, `authn-no-session-management-recovery`.

**Ubicación:** `src/server/auth.ts:21-32` (`requireEmailVerification:false`, `autoSignIn:true`, sin
`sendResetPassword`, `expiresIn: 30*DAY`, `updateAge: DAY`); `src/app/(social)/ajustes/page.tsx` (sin cambio de
contraseña ni sesiones).

**Escenario:** (a) **Squatting:** cualquiera registra `ana@gmail.com` (no suyo), entra al instante y opera con
ese correo; cuando la verdadera Ana intenta registrarse recibe "ya tienes cuenta" y **no hay flujo de
restablecer** para recuperarla. (b) **Cuenta comprometida irremediable:** si se filtra una contraseña, la víctima
no puede cambiarla, ver sesiones ni cerrarlas desde `/ajustes`; la sesión del atacante dura 30 días deslizantes
sin tope absoluto. (c) **Pre-account-takeover** futuro si se agrega OAuth con vinculación implícita por correo.

**Evidencia:** PoC (`.data/security/last-email-verif.txt`, `verify-session-mgmt.*`). Alta con correo arbitrario →
200 + `set-cookie … Max-Age=2592000`, `emailVerified:false`. `request-password-reset` → 400
`RESET_PASSWORD_DISABLED`; `send-verification-email` → 400. Corrección de un dato: los endpoints
`change-password`/`revoke-other-sessions`/`list-sessions` **sí** existen por HTTP (funcionan con curl), solo falta
interfaz — "solo por BD" está sobredicho. Nota grave: quien tenga la contraseña puede
`POST /api/auth/change-password {…, revokeOtherSessions:true}` y expulsar a la víctima, que sin reset queda sin
recuperación.

**Impacto:** suplantación por correo y bloqueo permanente del dueño; cuenta comprometida no remediable; deuda de
seguridad al activar OAuth. Bloqueador para lanzamiento con cuentas de vendedor.

**Corrección:** crear `src/server/providers/email` (consola en dev, Resend/SES en prod). En `auth.ts`:
`requireEmailVerification:true`, `sendResetPassword`, `revokeSessionsOnPasswordReset:true`,
`emailVerification.sendOnSignUp`. Páginas `/restablecer` y `/verificar-correo`. `/ajustes/seguridad` con cambiar
contraseña (`revokeOtherSessions:true`), listar y cerrar sesiones. Tope absoluto de sesión (p. ej. 90 días
comparando `session.createdAt`) y `freshAge` para acciones sensibles. Job que borre cuentas
`emailVerified=false` de >7 días sin actividad. Antes de OAuth, fijar `account.accountLinking` para vincular solo
con correos verificados.

---

### SEC-11 — Enumeración de cuentas por el registro (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** M.
**Fuentes:** `authn-signup-enumeration`, `privacy-email-enumeration-signup`, `pentest-signup-enumeration`.

**Ubicación:** `src/modules/identity/auth-errors.ts:4-7`; `src/server/auth.ts:25-27`;
`node_modules/better-auth/dist/api/routes/sign-up.mjs:162,199-211`.

**Escenario:** con `autoSignIn:true` y `requireEmailVerification:false`, un registro con correo existente devuelve
422 `USER_ALREADY_EXISTS` (UI: "No pudimos crear la cuenta con ese correo. ¿Ya tienes cuenta?") y **sin** calcular
el hash scrypt, así que además responde **notablemente más rápido**. El login sí es genérico (mensaje idéntico +
hash de relleno). Combinado con SEC-02, se prueban listas completas sin límite.

**Evidencia:** PoC (`.data/security/signup-enum-poc.*`, `signup-enum-action-poc.*`). Correo nuevo: 200 en
~0.6 s; duplicado: 422 en 0.04–0.09 s. El mensaje y el tiempo, cada uno por su cuenta, revelan si la cuenta
existe. 8 sondas seguidas por la Server Action: 8×200, nunca "Demasiados intentos". Efecto lateral: cada sonda a
un correo inexistente **crea** una cuenta real sin verificar.

**Impacto:** filtra qué correos tienen cuenta (dato personal LFPDPPP), alimenta credential stuffing dirigido y
phishing.

**Corrección:** al conectar el EmailProvider, `requireEmailVerification:true` (Better Auth responde genérico y
hace hash en duplicados) + `onExistingUserSignUp` (avisa al dueño real) + UI siempre "Revisa tu correo".
Importante: con la respuesta genérica el duplicado devuelve un `user.id` sintético no-UUID → el
`userConsent.createMany` contra columna `@db.Uuid` fallaría; grabar consentimientos en
`databaseHooks.user.create.after` (solo en inserciones reales). Mientras tanto, aplicar el límite de SEC-02 al
registro y cerrar el alta por HTTP (SEC-09).

---

### SEC-12 — Límite de 60 subidas/h con carrera (TOCTOU) que ignora los fallos (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** S.
**Fuentes:** `uploads-rate-limit-toctou`.

**Ubicación:** `src/app/api/uploads/route.ts:34-39` (count) y `:50-61` (create).

**Escenario:** el `db.media.count` corre **antes** de que cualquier petición llegue a `db.media.create`, así que
N subidas en paralelo ven el mismo conteo (<60) y todas pasan. Los intentos fallidos (422) nunca crean fila, así
que el trabajo caro (bufferizar, decodificar con sharp) no cuenta. El límite es solo por usuario, sin límite por
IP, y el registro no exige verificación.

**Evidencia:** PoC (`.data/security/uploads/poc-race.*`, `verifier-a/race-verify.*`). 80–89 subidas aceptadas en
una ráfaga de 80–90 paralelas contra un límite de 60; 25 inválidas previas sin consumir cupo.

**Impacto:** incumple el límite documentado (ADR-021); amplifica la DoS de CPU/memoria (SEC-03, SEC-13) y el
abuso de almacenamiento (SEC-14).

**Corrección:** reservar el cupo de forma atómica **antes** de leer el cuerpo: transacción con
`pg_advisory_xact_lock(hashtext(userId))` que cuente (todos los estados, usando `MediaStatus`) y cree la fila
`PROCESSING`, luego procesar y marcar `READY`/`FAILED` (sin borrar, para que siga contando). Alternativa: tabla
`upload_quota(user_id, window_start, count)` con `INSERT … ON CONFLICT DO UPDATE … RETURNING`. Añadir límite por
IP y exigir onboarding completo (y, más adelante, correo verificado).

---

### SEC-13 — Pixel-flood: imágenes de ~40 Mpx bloquean el threadpool de libuv (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** M.
**Fuentes:** `uploads-pixel-flood-threadpool`.

**Ubicación:** `src/modules/media/image-processing.ts:8` (`MAX_INPUT_PIXELS=40_000_000`), `:50-62` (pipeline sin
concurrencia ni timeout); `src/app/api/uploads/route.ts:45`.

**Escenario:** un PNG RGBA de 16 bits de 6320×6320 (39.9 Mpx) pesa ~465 KB pero obliga a sharp a decodificar los
40 Mpx completos (PNG no admite shrink-on-load), ocupando un hilo del threadpool (4 por defecto). Con 4+ en
paralelo, cualquier `fs.readFile` (p. ej. `/media/*`), scrypt (login) o DNS queda en cola.

**Evidencia:** PoC (`.data/security/uploads/poc-pixels.*`, `poc-threadpool.*`). Una subida: 4.65 s, ~188 MB. 6 en
paralelo: 11.2 s. Latencia de `GET /media/…webp`: base ~45 ms → durante 6 subidas de 40 Mpx: 4218/2780/548 ms.
El archivo final siempre se recorta a 1600 px, así que aceptar 40 Mpx no aporta calidad.

**Impacto:** con unas pocas cuentas gratuitas se degrada o congela el servidor: lecturas de disco, hash de
contraseñas, login e imágenes suben de decenas de ms a varios segundos. Amplificación ~10,000× trabajo vs bytes.

**Corrección:** semáforo por proceso (`p-limit(2)`) alrededor de `processImage` con 503+Retry-After si la cola
crece; `sharp.concurrency(1)` y subir `UV_THREADPOOL_SIZE`; `.timeout({ seconds: 8 })` al pipeline; bajar
`MAX_INPUT_PIXELS` a ~25 Mpx para formatos sin shrink-on-load y rechazar PNG de 16 bits
(`metadata.depth !== 'uchar'`). A mediano plazo, procesar en un worker/cola fuera del proceso web (ADR-010).

---

### SEC-14 — Subidas huérfanas nunca se borran y quedan públicas con caché inmutable de 1 año (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** M.
**Fuentes:** `uploads-orphan-public-hosting`, `privacy-media-retention-no-deletion`, `uploads-no-revocation`.

**Ubicación:** `src/app/api/uploads/route.ts:26-27,47-62`; `src/app/media/[...key]/route.ts:9-17`;
`src/modules/catalog/service.ts:121-126`; `src/modules/media/components/image-uploader.tsx:86-95`.

**Escenario:** cualquier cuenta (sin onboarding, sin aceptar términos, sin verificar correo) sube imágenes que
nunca adjunta. Cada una queda en disco (~1.73 MiB con ruido a 1600 px) y **pública** en
`/media/images/AAAA/MM/<uuid>.webp` con `Cache-Control: public, max-age=31536000, immutable` y **sin** CORP, así
que se puede enlazar desde cualquier sitio. No existe recolector de huérfanas (`storage.delete` solo en scripts).
El flujo normal también las genera (quitar una foto solo la saca de la UI; `updateProduct` conserva las filas).
`/media` sirve cualquier clave en disco sin consultar BD, así que borrar la cuenta (cascada de `Media`) **no**
borra los archivos, y el retiro por moderación no surte efecto en caches.

**Evidencia:** PoC (`.data/security/uploads/poc-storage.*`, `verifier-a/orphan-verify.*`). Subida no adjuntada →
GET anónimo cross-origin → 200 con caché inmutable, sin CORP. `grep storage.delete src` → 0. En BD, 82/122 media
huérfanas.

**Impacto:** (1) agotar disco/coste; (2) **hosting gratuito** de contenido ilícito o phishing bajo el dominio de
la marca, sin moderación ni forma de encontrarlo; (3) hotlinking; (4) retención indefinida de imágenes personales
y derecho de cancelación impracticable.

**Corrección:** crear `Media` con `status: PROCESSING` antes del `put`; job diario que borre (storage + fila) las
no adjuntadas de >48 h; `/media` sirve en público solo lo adjunto (o prefijo `tmp/<ownerId>/…` privado hasta
adjuntar); `Cross-Origin-Resource-Policy: same-site` en `/media`; exigir `requireOnboardedViewer` en
`/api/uploads`; cuota total por usuario; bajar `immutable` a caché corta con purga de CDN; al borrar
cuenta/publicación, borrar los archivos.

---

### SEC-15 — Escrituras sociales y `/api/feed` sin límite de frecuencia (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** M.
**Fuentes:** `abuse-no-ratelimit-social-writes`, `pentest-no-ratelimit-actions`.

**Ubicación:** `src/modules/social/actions.ts` (like/save/comment/post), `follow-actions.ts:23`,
`community-actions.ts:16`, `src/modules/commerce/actions.ts` (addToCart/buyNow), `src/app/api/feed/route.ts`.

**Escenario:** ninguna de estas Server Actions ni `/api/feed` tiene límite; solo exigen sesión. Una cuenta puede
publicar miles de posts (2000 caracteres, misma imagen reutilizada — `PostMedia` no verifica reutilización) en
cualquier comunidad aunque no sea miembro, y miles de comentarios idénticos. El feed toma candidatos de los
últimos 400 posts por `publishedAt`, así que basta desplazar el contenido legítimo. `follow`/`join` en bucle
dispara `revalidatePath('/(social)', 'layout')` por llamada (amplificación de caché) y filas de analítica.

**Evidencia:** PoC (`.data/security/abuse/social-ratelimit-A/`). 40 follow + 40 join + 40 like por la interfaz:
120×200, 0 bloqueos; `follow`/`join` tardan ~0.7–1.0 s cada uno por el `revalidatePath` del layout, que además
registra ~4 IMPRESSION por re-render (inflación de impresiones). El registro sin verificación abarata cuentas
Sybil.

**Impacto:** spam masivo que desplaza el contenido real, crecimiento de BD, presión de caché/CPU y (cuando
existan notificaciones) bombardeo de correos/push.

**Corrección:** helper compartido `enforceRateLimit(key, {window, max})` con upsert atómico sobre `rate_limits`,
aplicado por acción con cuotas (post 10/h y 50/día; comentario 30/h + cooldown 10 s por post; like/save 300/h;
follow 100/h; join 30/h; producto 30/día), cuotas menores para cuentas <24 h. Rechazar comentarios idénticos
consecutivos. En `createPostAction`, exigir membresía de la comunidad. Reemplazar `revalidatePath('layout')` por
revalidaciones acotadas o `router.refresh()`. Límite por IP en `/api/feed`. Antes de producción,
`requireEmailVerification`.

---

### SEC-16 — Eventos "anónimos" re-identificables por metadata (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** M.
**Fuentes:** `privacy-anonymized-events-reidentifiable`.

**Ubicación:** `src/modules/analytics/event.ts:29-42` (solo anula `userId`/`anonymousId`);
`src/modules/commerce/checkout.ts:212` (`metadata.checkoutId`), `:353` (`orderId`);
`src/modules/ai/service.ts:131` y `catalog/actions.ts:120` (`responseId`);
`src/app/(legal)/privacidad/page.tsx:53-54`.

**Escenario:** con personalización desactivada, `prepareEvent` guarda `userId=NULL` pero conserva
`metadata` (con `checkoutId`/`orderId`/`responseId`), `query` en texto crudo, `entityId` y `createdAt` al
milisegundo. Cualquiera con acceso a la analítica une `analytics_events.metadata->>'checkoutId'` con
`checkouts.buyerId` (o `responseId → ai_responses → ai_requests.userId`) y recupera a la persona. Incluso sin
metadata, `entityId` + `createdAt` casan contra `checkouts.createdAt` (los UUIDv7 llevan timestamp).

**Evidencia:** consulta de solo lectura (`.data/security/privacy/verifier-a-reident.*`, `db-evidence-commerce.txt`).
Uniendo eventos con `userId`/`anonymousId` NULL a checkouts/orders/ai_responses se recuperó el correo de cuentas
con `personalizationEnabled=false`; 159/159 `AI_PROPOSAL_GENERATED` anónimos llevan un id enlazable.

**Impacto:** la anonimización es solo nominal; el tratamiento para finalidades secundarias sigue ligado a la
persona pese a su negativa (LFPDPPP: tratamiento contrario a lo informado; el aviso promete "anónima y
agregada"). Solo alcanzable con acceso interno a la BD/BI, por eso Media.

**Corrección:** en `prepareEvent` con `anonymize=true`, lista blanca de metadata (descartar cualquier `*Id`),
truncar `createdAt` a la hora, descartar `query` (o hash/categoría), y para comercio de personas sin
personalización usar contadores agregados en vez de filas por evento. Los eventos `AI_PROPOSAL_*` del vendedor
tienen `entityId` = su propio producto (no anonimizables): agregarlos por día o acotar el alcance del aviso.
Prueba: `prepareEvent({metadata:{checkoutId}}, false).metadata` sin ids.

---

### SEC-17 — "Gente de tus comunidades" revela a quién sigue una persona concreta (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** S.
**Fuentes:** `privacy-follow-graph-leak-suggestions`.

**Ubicación:** `src/modules/discovery/queries.ts:220-234` (`countFollowedByFollowing`);
`src/modules/discovery/service.ts:172-219`; `src/modules/discovery/suggestions.ts:104-107`.

**Escenario:** el atacante M sigue **solo** a la víctima V. `getPeopleSuggestions(M)` agrupa los follows con
`followerId ∈ {V}`, así que cada cuenta que V sigue (descubrible) se vuelve candidata con `count=1`, y el inicio
pinta "La sigue 1 persona que sigues". M sabe exactamente a quién sigue V. Con "Quitar" repetido se **enumera** la
lista de seguidos de V. Que V desactive "Aparecer en sugerencias" no lo impide: ese ajuste solo filtra a V como
objetivo, no como intermediario.

**Evidencia:** PoC Playwright (`.data/security/privacy/poc-social.*`). V sigue a T1–T4; M sigue solo a V. T1–T3
aparecen en las sugerencias de M con la razón "La sigue 1 persona que sigues"; T4 (`discoverable=false`, control)
no. El código ya excluye "me gusta" por esta misma razón, pero no los follows.

**Impacto:** reconstrucción del grafo de seguidos de una persona identificable (relaciones personales, tiendas de
la competencia). La persona afectada no tiene control; el aviso no advierte que expone sus seguidos.

**Corrección:** la protección fuerte es **consentimiento del intermediario**: nuevo ajuste
`Profile.useFollowsForSuggestions` (por omisión off) en el `where` de `countFollowedByFollowing`. Además
`having: { followingId: { _count: { gte: 2 } } }` (k≥2 intermediarios distintos), no dar el número exacto cuando
sea pequeño, y actualizar el aviso. (Nota: (a) umbral de longitud y (b) k≥2 por sí solos se saltan con cuentas
títere; por eso hace falta (c).)

---

### SEC-18 — Suplantación editorial: cualquiera se llama "Equipo VendeIA" (Media)

**Estado:** Confirmado, reproducido. **Esfuerzo:** S.
**Fuentes:** `ai-future-editorial-impersonation`.

**Ubicación:** `src/modules/identity/schemas.ts:27-38,56-59` (`RESERVED_USERNAMES` con coincidencia exacta);
`src/modules/identity/onboarding-schema.ts:46` (displayName libre); `src/modules/identity/seller-actions.ts:10`
(nombre de tienda libre); `prisma/seed.ts:369-372` (en producción no crea cuentas editoriales).

**Escenario:** el registro con `equipo.soporte`/`Equipo VendeIA` pasa: `RESERVED_USERNAMES` solo compara
coincidencia **exacta**, y `equipo.soporte`/`vendeia.oficial` no coinciden. En producción el seed no crea las
cuentas editoriales, así que `equipo.gaming`, `equipo.moda`, etc. quedan libres para apartarlas. `displayName` y
el nombre de tienda son texto libre. Con esto se publica o comenta "soporte oficial: paga por transferencia…".

**Evidencia:** PoC (`.data/security/ai-future/setup.mjs`, `profile-*.html`). `/u/equipo.soporte` →
"Equipo VendeIA (@equipo.soporte)"; en comentarios no se puede distinguir de una cuenta editorial real (el DTO de
comentarios no lleva `isEditorial`). En feed sí hay diferencia (avatar de comunidad + badge).

**Impacto:** suplantación de la plataforma en contexto de comercio (phishing, desvío de pago fuera de la app) y
apartado permanente de los usernames editoriales de producción.

**Corrección:** reservar por **prefijo/subcadena normalizada** (NFD, sin acentos, leetspeak 0→o/1→i, quitar `._`):
rechazar segmentos/subcadenas `equipo`, `vendeia`, `soporte`, `oficial`, `admin`, `staff`, `moderador`. Helper
`isPlatformImpersonation(text)` en `displayName` y nombre de tienda (en el esquema del servidor). Tabla
`reserved_usernames` que bloquee `equipo.<slug>` para toda comunidad, o crear las cuentas editoriales antes del
lanzamiento. Añadir `isEditorial` al DTO de comentarios y su badge. Pruebas unitarias de los casos rechazados.

---

### SEC-19 — Presupuesto de IA: carrera, costos no contabilizados y pool global (Media, latente)

**Estado:** Confirmado (mecanismo; el impacto monetario es latente hasta un proveedor de pago). **Esfuerzo:** M.
**Fuentes:** `ai-future-budget-guard-race`, `abuse-ai-budget-guard-race-and-uncounted-failures`,
`pentest-ai-budget-dos`, `ai-future-global-budget-dos`, `ai-future-unmetered-failed-calls`.

**Ubicación:** `src/modules/ai/service.ts:28-54` (count/aggregate), `:81-100` (create posterior), `:104-140`
(fallos sin `AIResponse`); `src/modules/ai/budget.ts`; `src/server/auth.ts:27` (`requireEmailVerification:false`);
`src/modules/ai/actions.ts:41` (solo `requireOnboardedViewer`).

**Escenario:** tres defectos en el mismo guardián. (a) **Carrera:** `assertWithinBudget` cuenta las `AIRequest` y
luego, en otra operación, crea la fila; N llamadas en paralelo leen el mismo conteo (<20) y todas pasan. (b)
**Costos no contados:** el gasto solo se suma desde `AIResponse.costMicrosUsd`, que solo se crea en el camino
exitoso; en `INVALID_OUTPUT` (inducible desde `text`), `PROVIDER_ERROR` o timeout, los tokens facturados **no**
suman al presupuesto. (c) **Pool global:** el tope mensual es un único agregado sin filtrar por usuario, y con
comisión 0 % el límite = semilla (US$50); con registro sin verificar, muchas cuentas (o una sola por la carrera)
lo agotan y **todos** los vendedores reciben "La IA alcanzó su presupuesto".

**Evidencia:** PoC (`.data/security/ai-future/race-ai-limit.*`, `verify-A-ai-budget/`, simulación con proveedor de
pago `billing-sim`). 100 llamadas en paralelo → 100 `SUCCEEDED` contra un límite de 20; la siguiente secuencial →
`RATE_LIMITED`. En simulación con proveedor que cobra: `INVALID_OUTPUT` facturó US$22.98 con guardián en
US$0.00. Hoy el proveedor es mock (costo 0), por eso el dinero es latente; la carrera es real hoy (llamadas y
escrituras sin freno).

**Impacto:** el día que se conecte un proveedor real (lo que preguntas para que "funcione solo"): denegación de
la función principal de venta para todos y fuga de dinero directa por encima del tope. Es **bloqueador previo** a
cablear cualquier proveedor de pago.

**Corrección:** reservar de forma atómica **antes** de validar: transacción con
`pg_advisory_xact_lock(hashtext('ai:'||userId))` que cuente (incluyendo PENDING) y cree la `AIRequest`; reservar
el costo máximo estimado (`maxTokens × precio`) y sumar reservas al presupuesto; registrar `usage`/costo también
en `INVALID_OUTPUT`/`PROVIDER_ERROR` (añadir `costMicrosUsd` a `AIRequest`). Cuota mensual y diaria por usuario
además de la horaria; reservar parte del presupuesto para vendedores con ventas; exigir correo verificado (y
perfil `ACTIVE`) antes de un proveedor de pago; `max_tokens` y timeout en el adaptador; validar que
`provider.model` tenga precio al arrancar (no en cada llamada).

---

### SEC-20 — Métricas del vendedor manipulables (shares/vistas/impresiones/atribución) (Media→Baja)

**Estado:** Confirmado (parcial). **Esfuerzo:** M.
**Fuentes:** `abuse-anonymous-product-view-and-impression-spam`, `abuse-anonymous-share-events-inflate-seller-metrics`,
`authz-analytics-attribution-spoofing`, `commerce-sourcepost-attribution-spoof`,
`ai-future-proposal-accepted-unverified`.

**Ubicación:** `src/modules/social/interaction-actions.ts:10-22`, `src/modules/catalog/share-actions.ts:8-19`
(sin sesión, sin dedupe, sin verificar que la entidad exista); `src/app/(social)/producto/[slug]/page.tsx:62-73`
(PRODUCT_VIEW por cada GET, `?ref`/`?from` sin validar); `src/app/api/feed/route.ts:46` (10 IMPRESSION por página);
`src/modules/analytics/seller-queries.ts:36-52` (SHARE sin filtro de fecha; `where` sin `entityType`);
`src/modules/commerce/cart.ts:43-48` y `catalog/actions.ts:118-122` (`sourcePostId`/`proposalId` sin verificar).

**Escenario:** acciones públicas sin dedupe ni límite permiten inflar "Compartidos", "Visitas" y "Conversión" del
Studio, atribuir compras a cualquier publicación (`sourcePostId` cualquiera), y registrar `AI_PROPOSAL_ACCEPTED`
con cualquier `proposalId`. Amplificador de carga: las consultas del dashboard filtran por `type + entityId` sin
`entityType`, así que no usan el índice compuesto y recorren todos los PRODUCT_VIEW de la plataforma.

**Evidencia:** PoC (`.data/security/abuse/poc-share-inflation.*`, `poc-view-impression-spam.*`). 25 shares
anónimos → 25 filas para un producto real; 5 shares para un id inexistente → 5 filas. 5 GET a
`/producto/…?from=<uuid>` → 5 PRODUCT_VIEW con `sourcePostId` inventado. `EXPLAIN` confirma escaneo del índice
`(type, createdAt)` sin `entityType`.

**Impacto:** integridad de datos: dashboards de vendedores y métricas de producto (atribución P5, utilidad de IA
P3) falsificables; crecimiento no autenticado de `analytics_events`; degradación del dashboard de todos los
vendedores. Si en el futuro la atribución paga comisiones, se vuelve fraude de comisiones.

**Corrección:** deduplicar por `(actor, entidad, canal, día)` con `anonymousId` en cookie firmada + hash de IP;
verificar que la entidad exista/sea visible antes de `track`; validar `sourcePostId`
(`post.findFirst({id, productId, status:'PUBLISHED'})`) y `proposalId`
(`aIResponse.findFirst({id, request:{userId}})`, único por producto); en `seller-queries` añadir
`entityType:'PRODUCT'` y `createdAt >= since`, y contar actores distintos; límite por IP en `/api/feed` y en las
acciones de tracking; muestreo de IMPRESSION anónimas.

---

### SEC-21 — `env-schema` acepta `http`/`localhost` en producción: cookies sin `Secure`, base sin TLS (Baja)

**Estado:** Confirmado (mecanismo). **Esfuerzo:** S.
**Fuentes:** `config-env-schema-production-defaults`, `authn-app-url-insecure-default-production`.

**Ubicación:** `src/server/env-schema.ts:8-13`; `src/server/auth.ts:18` (`baseURL: env.APP_URL`);
`node_modules/better-auth/dist/cookies/index.mjs:22-39`.

**Escenario:** `APP_URL` tiene `.default("http://localhost:3000")` sin refinamiento por `NODE_ENV`. Si se
despliega sin definir `APP_URL`, o con `http://`, Better Auth decide `Secure`/`__Secure-` por
`baseURL.startsWith("https://")`, así que la cookie de sesión sale **sin `Secure`** y puede viajar en claro
(primera visita antes de HSTS, subdominio sin TLS). `DATABASE_URL` sin `sslmode` conecta sin TLS a una base
gestionada. El arranque no falla.

**Evidencia:** PoC (`.data/security/verify-A-env-prod/check.*`, `config/env-prod-check.ts`). Con
`NODE_ENV=production`: sin `APP_URL` → aceptado con `cookie secure=false`; con `http://vendeia.mx` → aceptado,
`secure=false`; con `https://` → `__Secure-…`, `secure=true`. Mitigante: `next.config.ts:16-18` ya envía HSTS en
producción, así que la ventana es estrecha (MITM activo + navegación a `http://` + cookie sin HSTS aún).

**Corrección:** `superRefine` solo en producción: `APP_URL` explícita y `https` (excepción loopback para CI que
corre `pnpm start`); `DATABASE_URL` con `sslmode=verify-full` si el host no es loopback; opcional, secreto de
baja entropía. En `auth.ts`, `advanced.useSecureCookies: new URL(env.APP_URL).protocol==="https:" || NODE_ENV==="production"`.
Casos en `env.test.ts`.

---

### SEC-22 — Node.js 22.16.0 sin parches de 2026; `engines` admite runtimes vulnerables (Baja)

**Estado:** Confirmado. **Esfuerzo:** S.
**Fuentes:** `config-node-runtime-outdated`.

**Ubicación:** `package.json:5-7` (`engines.node ">=22.12.0"`), `.nvmrc` (`22`), `.npmrc` (sin `engine-strict`).

**Escenario/evidencia:** `node --version` → v22.16.0 (mayo 2025). Faltan tres tandas de parches de seguridad de
2026 (marzo/junio/julio; 22.x parcheado = v22.23.2). Verificación honesta: la mayoría de los CVE citados (HTTP/2,
TLS de cliente, `headersDistinct`) **no son alcanzables** hoy — `next start` sirve HTTP/1.1, no hay `fetch`
saliente (proveedores mock). Alcanzables: HashDoS de V8 al parsear JSON de entrada, y smuggling detrás de ciertos
proxies. Es higiene de operaciones/cadena de suministro, no una vulnerabilidad de la app.

**Corrección:** actualizar el runtime local a ≥22.23.2 (o 24 LTS parcheada); `engines` a
`">=22.23.2 <23 || >=24.x"` (no limitar a `<23`); fijar la imagen de producción por digest; chequeo en CI que
compare `process.version`; suscribirse a nodejs-sec.

---

### SEC-23 — Robustez de checkout: doble envío, huérfano, aprobación tardía, zona local, overflow (Baja)

**Estado:** Confirmado (traza; PoC de zona local). **Esfuerzo:** M (agregado).
**Fuentes:** `commerce-double-submit-duplicate-checkout`, `commerce-orphan-checkout-without-payment`,
`commerce-late-approval-dropped`, `commerce-local-delivery-zone-bypass`, `commerce-int32-total-overflow`,
`commerce-buyer-deletion-cascade`.

**Resumen de cada sub-ítem (todos bajos hoy, importantes con proveedor real):**

- **Doble envío** (`checkout.ts:52,181-183`): dos confirmaciones simultáneas del mismo carrito crean dos
  checkouts y reservan stock dos veces (`deleteMany` sin comprobar `count`). Fix: borrar el carrito como primer
  write de la transacción y usarlo como candado (`if (removed.count !== lines.length) throw CART_CHANGED`).
- **Checkout huérfano** (`checkout.ts:187-203`): si `createPayment` o `db.payment.create` fallan tras el commit,
  el checkout queda con stock reservado para siempre (la expiración busca por `Payment`). Fix: crear el `Payment`
  dentro de la transacción; `expireStaleCheckouts` debe barrer también `PENDING_PAYMENT` sin `Payment`.
- **Aprobación tardía** (`checkout.ts:259-263`, `fees.ts:26`): un webhook APPROVED que llega tras vencer los 30
  min se ignora sin reembolso; `PaymentEventInput` no trae monto (no se valida el total). Fix: TTL por método
  (OXXO/SPEI días), `cancelPayment` en la interfaz del proveedor, y `amountCents`/`currency` en el evento.
- **Zona local** (`checkout-math.ts:16-35`): cualquier comprador elige "Entrega local" (envío $0) sin que su
  dirección coincida con las zonas; el vendedor queda con una orden imposible y **sin cancelación**. Fix:
  normalizar zonas (municipio/CP) y validar en `placeOrder`; agregar `cancelOrder(seller)` con devolución de
  stock y reembolso.
- **Overflow int32** (`pricing.ts:6`): precio máximo ($10M) × cantidad puede superar `int4` y dar 500. Fix:
  validar que los totales quepan en int32 o migrar a `BigInt`.
- **Cascada de borrado** (esquema): borrar al comprador elimina checkouts pendientes (sin devolver stock) y
  órdenes pagadas del registro del vendedor. Fix: vencer checkouts antes de borrar; `onDelete: Restrict`/`SetNull`
  y anonimizar en vez de borrar órdenes.

---

### SEC-24 — `SellerStatus = SUSPENDED` no se aplica en ninguna acción ni consulta (Baja)

**Estado:** Confirmado (traza). **Esfuerzo:** S–M.
**Fuentes:** `authz-seller-suspension-not-enforced`, `commerce-seller-suspension-not-enforced`,
`ai-future-seller-suspension-noop`.

**Ubicación:** `src/modules/identity/session.ts:43,58` (`sellerProfileId` sin mirar `status`);
`catalog/actions.ts:29`, `catalog/service.ts:31,57`, `catalog/queries.ts:150,190`, `checkout.ts:93`,
`social/queries.ts:61`.

**Escenario/evidencia:** el enum `SUSPENDED` existe pero **ningún** código lo escribe ni lo consulta (grep en
`src` sin resultados fuera de DTOs de badge). Cuando exista moderación, un vendedor suspendido seguirá creando
productos, vendiendo y usando la IA, y sus productos seguirán comprables. Los badges se contradicen
(`feed/dto.ts` usa `status==='ACTIVE'`, `social/queries.ts` usa "tiene perfil"). Hoy no explotable (no hay forma
de suspender salvo por BD); es un control latente.

**Corrección:** exponer `sellerStatus` en `Viewer`; `requireActiveSeller()` en acciones de catálogo/pedidos/IA;
`seller: { status: 'ACTIVE' }` en las consultas públicas de productos y en el `updateMany` de stock de
`placeOrder`; unificar `isSeller = status === 'ACTIVE'`. Al suspender, pausar productos en una transacción y
registrar la decisión (actor HUMAN). No condicionar la IA al estado de vendedor (es abierta por diseño).

---

### SEC-25 — `advanceOrderAction` no valida `to`; sin cancelación/reembolso tras PAID (Baja)

**Estado:** Sin verificar (traza). **Esfuerzo:** S–M.
**Fuentes:** `authz-advance-order-unvalidated-transition`, `commerce-no-cancel-refund-transition`.

**Ubicación:** `src/modules/commerce/actions.ts:196-201`; `checkout.ts:391-405`; `studio/pedidos/page.tsx:74-88`.

**Escenario:** la acción solo valida `orderId` con `z.uuid()`; `to` llega del navegador sin validar y cualquier
valor distinto de `SHIPPED` toma la rama `DELIVERED`. Se puede marcar `DELIVERED` un envío nacional sin pasar por
`SHIPPED`. No existe transición `PAID→CANCELLED` ni reembolso. La propiedad del vendedor sí se comprueba. Hoy
bajo (DELIVERED no mueve dinero); cuando DELIVERED libere pagos, el vendedor podrá cerrar pedidos que nunca
envió.

**Corrección:** `z.enum(['SHIPPED','DELIVERED'])` en la acción; tabla de transiciones por método de entrega en el
`where`; `cancelOrder(seller)` con devolución de stock y reembolso; confirmación del comprador antes de liberar
fondos.

---

### SEC-26 — Derechos ARCO prometidos pero no implementados (Baja, bloqueador legal previo al lanzamiento)

**Estado:** Confirmado. **Esfuerzo:** L.
**Fuentes:** `privacy-arco-rights-missing`.

**Ubicación:** `privacidad/page.tsx:83-88` ("podrás descargar y eliminar tus datos"); `ajustes/page.tsx:84-88`
("Muy pronto…"); `auth.ts` (`deleteUser` deshabilitado); esquema (`Order.seller`/`OrderItem.product`
`onDelete: Restrict`).

**Escenario/evidencia:** no existe acción para exportar ni borrar la cuenta, ni para borrar publicaciones,
comentarios, direcciones o fotos, ni canal ARCO. `AnalyticsEvent.userId` no tiene FK (quedaría con el id crudo
tras borrar). El aviso ya se marca como "BORRADOR: requiere revisión de un abogado". No explotable (no cruza
usuarios); es deuda de cumplimiento ya en el roadmap (Sprint 4).

**Corrección:** antes del lanzamiento público, centro de privacidad: exportación (DTO sin hash ni costo),
borrado con servicio (borrar media de storage, anular `AnalyticsEvent.userId`, borrar `Address`, anonimizar
órdenes respetando plazos fiscales, archivar productos de vendedores con ventas), acciones de borrar/editar
contenido propio, y publicar el canal ARCO. Mientras tanto, corregir el texto del aviso para no prometer lo que
no existe.

---

### SEC-27 — Rechazar personalización no desliga la actividad previa; historial de búsqueda no borrable (Baja)

**Estado:** Confirmado, reproducido. **Esfuerzo:** S.
**Fuentes:** `privacy-optout-not-retroactive-preonboarding`, `privacy-search-history-hidden-undeletable`.

**Ubicación:** `src/modules/analytics/track.ts:6-13` (sin perfil → personalización=true);
`src/modules/identity/privacy-actions.ts:11-27` (no toca `analytics_events`);
`src/modules/identity/service.ts:48-137`; `src/modules/feed/queries.ts:112-145`; `ajustes/page.tsx:61-83`.

**Escenario/evidencia:** una búsqueda antes del onboarding (`/buscar` no exige perfil) se guarda con el `userId`;
al rechazar la personalización, solo las **posteriores** se anonimizan — la previa queda ligada para siempre. Lo
mismo al desactivar desde Ajustes: el historial anterior sigue ligado. Además Ajustes dice "No has declarado
gustos ni búsquedas" aunque las búsquedas alimentan "Porque buscaste…", y no hay botón para borrarlas. PoC
(`verifier-a-optout-poc`): tras desactivar, siguen ligadas IMPRESSION 10, SEARCH 1, COMMUNITY_JOIN 3, SIGN_UP 1.

**Corrección:** en `setPersonalizationAction(false)` y en `completeOnboarding` con `personalizationEnabled=false`,
dentro de la misma transacción, `analyticsEvent.updateMany({ where:{userId}, data:{userId:null, anonymousId:null,
query:null} })`. En `track.ts`, no ligar antes de tener la decisión (o anonimizar al terminar el onboarding).
Validar `z.boolean()` en `setPersonalizationAction`. Listar y permitir borrar el historial de búsqueda en
Ajustes.

---

### SEC-28 — Salida de IA solo validada en forma (P2/P4, CLABE, urgencia, cifras como "Calculado") (Baja)

**Estado:** Confirmado, reproducido. **Esfuerzo:** M.
**Fuentes:** `ai-future-output-content-unvalidated`.

**Ubicación:** `src/modules/ai/sale-proposal.ts:9-39`; `src/modules/ai/components/proposal-view.tsx:88-125`;
`src/modules/ai/service.ts:150-162`; `src/modules/ai/proposal-defaults.ts:52-59`.

**Escenario/evidencia:** `saleProposalSchema` solo valida tipos y longitudes. Con un LLM real, la propuesta puede
traer "original con garantía Apple", una CLABE, un `wa.me`, "ÚLTIMAS 2 PIEZAS" o un `suggestedDailyBudgetCents`
enorme, y todo pasa: se prellena en título/descripción/post y el presupuesto inventado por la IA se muestra bajo
"Calculado, no estimado" (viola P2). PoC (`output-validation-poc.mts`): acepta salida hostil, presupuesto
9,007,199,254,740,991, rango min>max, y prellena la CLABE. Hoy inactivo (proveedor mock); render seguro (React
escapa).

**Corrección:** sacar `suggestedDailyBudgetCents` y el rango de precio del contrato de IA y **calcularlos en
código** (la IA solo redacta el `rationale`); `refine` `minCents<=maxCents` y `<=MAX_CENTS`; guardián de
contenido que marque/limpie URLs, correos, teléfonos, CLABE/tarjetas (`\d{16,18}`) y urgencia, y afirmaciones de
garantía/original/envío gratis no respaldadas por los campos P4; usar el `productName` confirmado por el
vendedor; etiquetar los campos redactados por IA (principio 5).

---

### SEC-29 — `AIRequest.input` guarda texto libre con posible PII sin retención; aviso omite la IA (Baja)

**Estado:** Confirmado, reproducido. **Esfuerzo:** M.
**Fuentes:** `ai-future-ai-log-pii-retention`.

**Ubicación:** `src/modules/ai/service.ts:89-97`; esquema `AIRequest.userId onDelete: SetNull`;
`privacidad/page.tsx:90-95`.

**Escenario/evidencia:** los vendedores escriben "como a un amigo": es previsible que incluyan teléfono, nombre o
dirección. Se guardan hasta 500 caracteres de `text` (más `costCents`/`priceCents`) sin TTL, y la FK `SetNull`
dejaría el texto huérfano al borrar la cuenta. Al conectar un proveedor real, el texto completo (1000) sale a un
tercero fuera de México sin que el aviso lo diga. Hoy inactivo (mock, no sale del servidor). El comentario del
esquema dice "sin datos sensibles" pero el código no sanea nada.

**Corrección:** no usar `Cascade` (rompería la contabilidad de gasto de IA); anonimizar `input` en el futuro
servicio de borrado y con un job de retención (90 días → `{redacted:true}`). Dejar de guardar `text` (ningún
lector lo usa) o guardar solo un hash. Antes del proveedor real: redactar teléfonos/correos/CLABE/tarjetas;
agregar el proveedor de IA al aviso (encargado, finalidad, transferencia internacional); aviso bajo el textarea
"No incluyas datos personales"; contrato sin entrenamiento y retención cero. Corregir los comentarios engañosos.

---

### SEC-30 a SEC-38 — Endurecimientos bajos

- **SEC-30 — Contraseñas sin verificación contra filtradas** (`authn-password-policy-no-breach-check`,
  `schemas.ts:3-4`): acepta cualquier cadena de 10–128 caracteres, incluidas triviales/filtradas. Fix: lista
  local (top 10k) en el Zod o el plugin `haveIBeenPwned` (k-anonimato; documentarlo en el aviso).
- **SEC-31 — Cursor de feed → 500** (`injection-feed-cursor-unhandled`, `abuse-feed-cursor-invalid-date-500`,
  `ranking.ts:269-281`): `{t:9e15}` → `new Date` inválido → 500 sin sesión. Fix: acotar `t ∈ [ahora-7d,
ahora+1min]` y `Number.isFinite`, o firmar el cursor con HMAC.
- **SEC-32 — Búsqueda `LIKE '%x%'` sin índice** (`abuse-search-unindexed-like-anonymous`, `search/sql.ts`):
  escaneo completo por petición, anónimo y sin límite; satura el pool con volumen. Fix: columna generada +
  índice GIN `pg_trgm` (o `tsvector` 'spanish'), términos ≥3, `statement_timeout`, límite por IP.
- **SEC-33 — UUIDv7 filtra fecha de creación** (`privacy-uuidv7-timestamp-leak`, `pentest-uuidv7-ids`): los
  `userId` públicos codifican el timestamp de alta. Fix: exponer `username` o una `publicId` v4 en DTOs públicos,
  o aceptarlo y documentarlo.
- **SEC-34 — Aviso de privacidad incompleto** (`privacy-notice-incomplete`): omite IP/dispositivo, domicilios y
  teléfono, proveedor de IA, retención y el carácter público/indexable de perfiles. Fix: completar el aviso y
  subir `LEGAL_VERSIONS.privacyNotice` con re-aceptación.
- **SEC-35 — Optimizador `/_next/image` acepta cualquier ruta local** (`config-image-optimizer-localpatterns`):
  hoy solo 400, pero conviene acotar. Fix: `images.localPatterns: [{ pathname: "/media/**", search: "" }]`,
  `dangerouslyAllowSVG:false`, `remotePatterns:[]`.
- **SEC-36 — `sharp` decodifica SVG/TIFF antes del filtro** (`config-sharp-untrusted-loaders`): `metadata()` pasa
  por librsvg/libtiff en bytes no confiables antes de la lista permitida (superficie nativa). Fix:
  `sharp.block({operation:["VipsForeignLoad"]})` + `unblock` de los cargadores usados, y verificación de firma de
  bytes antes de `sharp`.
- **SEC-37 — Cadena de suministro** (`config-next-pending-security-release`, `config-prisma-cli-transitive-advisories`,
  `config-pnpm-supply-chain-hardening`): planear Next 16.3.7 (30-sep, con `minimumReleaseAgeExclude` temporal);
  `overrides: { mysql2: "3.23.1" }` y `auditConfig.ignoreGhsas` para el advisory de `deepmerge-ts`; `pnpm prune
--prod`/`output:"standalone"` en el despliegue; `strictDepBuilds`, `trustPolicy`, `blockExoticSubdeps`,
  `pnpm audit --prod --audit-level high` en CI.
- **SEC-38 — Filas sin tope y args sin validar** (`abuse-unbounded-row-growth-consents-intents`,
  `authz-unvalidated-action-args`, `abuse-like-save-toggle-event-inflation`): `setPersonalizationAction` sin
  `z.boolean()` (500 provocable); `completeOnboarding` crea `ShoppingIntent`/`UserConsent` en cada llamada;
  `surface` sin validar. Fix: `z.boolean().safeParse`, `z.enum(Surface).catch('FEED')`, crear consentimiento solo
  al cambiar y con límite, `upsert` de la intención de onboarding.

---

### SEC-39 — Gobernanza sin roles/aprobación, BD como superusuario, seed reclamable, ledger bruto (Info)

**Estado:** Confirmado (parcial). **Esfuerzo:** M (agregado).
**Fuentes:** `ai-future-governance-authz-model`, `ai-future-db-superuser`, `ai-future-seed-email-preclaim`,
`ai-future-ai-content-unlabeled`, `ai-future-ledger-gross-revenue`, `ai-future-budget-aggregate-scan`,
`ai-future-agents-indirect-injection`.

**Resumen:** riesgos latentes del diseño futuro (Centro de decisiones, agentes de IA):

- **Sin modelo de roles ni aprobación** para `PlatformSetting`/`PlatformDecision` (no hay `decidedById`, ni doble
  aprobación, ni registro clave→nivel de riesgo). Antes de construir el Centro de decisiones: tabla de roles,
  `applySetting(key, value, decisionId)` con validación de delta y riesgo (ALTO exige aprobación humana distinta),
  y que la IA solo pueda **proponer**.
- **BD como superusuario** (`rolsuper:true`, dueño de todas las tablas): en producción, separar rol de migraciones
  del de runtime (sin SUPERUSER/CREATEROLE/BYPASSRLS); `REVOKE UPDATE, DELETE ON platform_decisions`;
  `platform_settings` de solo lectura para runtime.
- **Seed reclamable** (`@vendeia.invalid`): en staging/preview público, apartar un correo editorial antes del seed
  lo adoptaría. Bloquear dominios reservados en el registro; el seed debe exigir que el usuario existente no tenga
  `Account` y sea editorial.
- **Contenido de IA sin etiquetar** (principio 5): productos/posts creados desde una propuesta no marcan
  `isAiGenerated`/`aiProposalId`.
- **Ledger bruto**: el presupuesto de IA crece con ingresos brutos (sin restar reembolsos, filtro `amountCents>0`).
- **Agregado del presupuesto sin índice** por fecha (amplificación bajo abuso): contadores materializados o
  índice en `createdAt`.
- **Inyección indirecta futura** (Sales Agent/Analista leerán texto de vendedores/búsquedas): herramientas de
  solo lectura con DTO acotado a campos P4, salida estructurada verificada en código, umbral k≥20 en el analista.

---

### SEC-40 — Endurecimientos informativos varios (Info)

**Fuentes:** `authn-plaintext-session-token-db`, `authn-studio-pages-no-server-guard`,
`uploads-non-multipart-500`, `uploads-no-origin-check`, `uploads-prod-local-storage-same-origin`,
`uploads-misleading-errors-heic`, `config-dev-server-all-interfaces`, `pentest-agents-md-agent-injection`,
`ai-future-agents-indirect-injection` (parcial).

- **Token de sesión en claro en `sessions.token`**: mitigado por la firma HMAC de la cookie; documentar el riesgo
  y mantener `BETTER_AUTH_SECRET` fuera de respaldos; reevaluar si se agrega el plugin bearer.
- **Páginas de Studio (analítica/campañas/contenido) sin guard de servidor**: hoy estáticas; añadir
  `requireOnboardedViewer('/studio')` en `src/app/studio/layout.tsx` para protegerlas por defecto.
- **`/api/uploads` sin `Content-Type` multipart → 500**: validar y responder 415/400.
- **`/api/uploads` sin verificación de `Origin`**: hoy protegido por `SameSite=Lax`; añadir chequeo de `Origin`
  como defensa en profundidad.
- **Almacenamiento local en producción** (`STORAGE_DRIVER` solo `local`): implementar S3/R2 servido desde un
  dominio sin cookies antes de producción; refinar env-schema para fallar si falta.
- **`heif` en la lista permitida** aunque sharp precompilado solo decodifica AVIF (fotos HEIC de iPhone fallan con
  mensaje equivocado): distinguir el error de límite de píxeles y documentar HEIC.
- **`next dev` escucha en `::`** (todas las interfaces): `"dev": "next dev -H localhost"`.
- **`AGENTS.md` autogenerado instruye a los agentes** a leer `node_modules` y commitear contenido autogenerado
  (comportamiento legítimo de Next, pero superficie de manipulación de agentes vía dependencia comprometida):
  tratar esos archivos como no confiables, revisar sus diffs.

---

## 5. Lo que se revisó y está bien

Confirmado por revisión estática y, donde se indica, dinámica. Es una base sólida:

- **Inyección SQL: ausente.** Todo el SQL crudo (`search/sql.ts`, `social/unread.ts`, `catalog/queries.ts:171`,
  `scripts/clean-e2e.ts`) usa `Prisma.sql` con parámetros; nombres de tabla/columna constantes. No existe
  `$queryRawUnsafe`/`Prisma.raw`. Escape de `LIKE` correcto (`likePattern` escapa `% _ \`).
- **XSS almacenado: probado dinámicamente en cuerpo de post, comentario, título/descripción/etiquetas/zonas de
  producto, nombre visible, marcas, intención y nombre/ciudad de tienda** → 0 ejecuciones de JS. React escapa;
  no hay `dangerouslySetInnerHTML`/`innerHTML`/`eval` en `src`. OpenGraph escapa correctamente. `credit.url`
  filtrado con `safeWebUrl` a http/https.
- **Autorización por dueño consistente:** las 28 Server Actions validan sesión (`require*Viewer` o `getViewer` +
  retorno de error); IDOR de escritura no encontrado. `updateProduct`/`toggleProductStatus` bloquean por
  `seller.userId`; carrito/direcciones/pedidos filtran por `userId`/`buyerId`; `simulatePaymentAction` exige
  `buyerId===viewer`; `/media/[...key]` con `assertSafeKey` + contención de ruta (sin path traversal).
- **Manipulación de precio/cantidad: bloqueada.** `placeOrder` relee precio/costo/comisión dentro de la
  transacción tras bloquear la fila, con huella `cartKey` (CART_CHANGED). Cantidades enteras 1–10. El navegador
  nunca fija precios. Sobreventa evitada por el descuento condicionado en un solo UPDATE.
- **Fuga del costo del producto (`ProductCost`): no ocurre.** DTOs por lista blanca; no hay `SELECT *` ni
  `include` sobre producto/OrderItem hacia el comprador. El costo solo se lee en la transacción de `placeOrder` y
  en el panel del propio vendedor.
- **Subida de imágenes:** validación por contenido real con sharp, recodificación a WebP (elimina
  EXIF/GPS/XMP/ICC — probado), rechazo de SVG/HTML/TIFF/polyglots, `limitInputPixels`, claves de almacenamiento
  aleatorias generadas por el servidor, cabeceras `nosniff` + CSP sandbox en `/media`. Optimizador `/_next/image`
  rechaza URLs remotas y SVG.
- **Sesión/CSRF:** cookie `HttpOnly; SameSite=Lax`; `Secure`/`__Secure-` en producción con `https`; sign-out
  invalida en servidor; Server Actions con verificación Origin/Host de Next; `/api/auth/*` rechaza POST sin Origin
  (403); rotación de token en cada login (sin session fixation); enumeración por **login** correctamente genérica
  (mensaje + hash de relleno).
- **Secretos:** `.env*`, `/.data/`, `/.next/` ignorados; `BETTER_AUTH_SECRET` ≥32 caracteres validado al
  arrancar; sin secretos codificados fuera de fixtures; `scripts/dev-db.mts` genera secretos con `randomBytes` y
  PostgreSQL local solo en `127.0.0.1`.
- **Cabeceras:** `poweredByHeader:false`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy` en todas las rutas; HSTS en producción. Sin source maps de producción.
- **Idempotencia de pagos:** índice único `(provider, providerEventId)`, transición solo desde `PENDING`,
  asientos de comisión una sola vez.
- **`isEditorial`/`isSeller` no los fija el usuario;** endpoints peligrosos de Better Auth deshabilitados por
  defecto (`delete-user`, `change-email`, `request-password-reset` sin sender, social sin proveedores).

---

## 6. Riesgos al pasar a producción (bloqueadores)

Cambios de comportamiento con `NODE_ENV=production` y lo que hay que cerrar **antes** de un lanzamiento público o
de conectar pagos/IA/correo reales:

1. **Pagos (SEC-01):** el mock sigue activo; sin fail-safe, cualquier pedido queda "pagado" gratis. **Bloqueador.**
   Requiere el `PAYMENTS_PROVIDER` con `superRefine`, el proveedor real por webhook firmado y la etiqueta
   "simulado" en el Studio.
2. **Rate limit de auth (SEC-02 + SEC-07):** los `customRules` de producción **no** protegen el flujo real.
   Fuerza bruta y creación masiva sin freno. **Bloqueador.** Necesita el limitador propio en las Server Actions y
   `advanced.ipAddress` según el hosting.
3. **DoS de subida (SEC-03, SEC-12, SEC-13):** un usuario autoregistrado puede tumbar el proceso o degradarlo.
   **Bloqueador** si `next start` queda expuesto; mitigado tras un proxy con `client_max_body_size` bajo.
4. **Presupuesto de IA (SEC-19):** hoy inactivo (mock, costo 0). El día que se conecte un proveedor de pago, la
   carrera y los costos no contados son **fuga de dinero** y denegación de la función para todos. **Bloqueador
   previo al proveedor real.**
5. **Verificación de correo y recuperación (SEC-10, SEC-11):** sin ellas hay squatting, enumeración y cuentas no
   remediables. **Bloqueador** para cuentas de vendedor. Requiere el EmailProvider (hoy inexistente).
6. **Cookies/TLS (SEC-21):** `APP_URL` mal configurada emite cookies sin `Secure`; el arranque no falla.
   **Bloqueador de configuración.**
7. **Cumplimiento LFPDPPP (SEC-08, SEC-16, SEC-26, SEC-34):** exposición de domicilios de compras no concretadas,
   eventos "anónimos" re-identificables, derechos ARCO no implementados y aviso incompleto. **Bloqueador legal**
   antes de atraer usuarios reales.
8. **Almacenamiento (SEC-14, SEC-40):** solo existe `local`; en producción serverless las subidas se pierden y el
   contenido se sirve desde el origen con cookies. Implementar S3/R2 en dominio sin cookies.
9. **Cadena de suministro (SEC-22, SEC-37):** fijar el runtime de Node parcheado y planear el parche de Next.

---

## 7. Recomendaciones de endurecimiento priorizadas

**P0 — antes de cualquier despliegue público (hacen fallar el arranque o cierran el bypass):**

1. `PAYMENTS_PROVIDER` + `ALLOW_SIMULATED_PAYMENTS` con `superRefine` que falle en producción con mock (SEC-01).
2. Limitador propio en `signInAction`/`signUpAction` sobre `rate_limits`, con IP confiable (SEC-02, SEC-07).
3. Tope de cuerpo real en `/api/uploads` (411/413 + lector acotado) (SEC-03).
4. `superRefine` de `APP_URL`/`DATABASE_URL`/cookies en producción (SEC-21).
5. `disabledPaths`/allowlist en `/api/auth/[...all]` (SEC-09).

**P1 — antes de atraer usuarios reales:** 6. **CSP** con nonce (o directivas estáticas + SRI como primer paso) + COOP/CORP (SEC-06). 7. Corregir `safeRedirectPath` (SEC-04) — cambio de una línea + pruebas. 8. Borrar `shippingAddress` en cancelaciones y no exponerla en pedidos no pagados (SEC-08). 9. Tope de checkouts pendientes + job de expiración programado (SEC-05). 10. `enforceRateLimit` compartido para escrituras sociales, `/api/feed`, subidas y tracking (SEC-12, SEC-15, SEC-20). 11. EmailProvider + verificación + recuperación + gestión de sesiones (SEC-10, SEC-11). 12. Anonimización real de eventos (SEC-16) y opt-out retroactivo (SEC-27). 13. Reserva de sugerencias con consentimiento del intermediario (SEC-17) y reserva de usernames editoriales (SEC-18).

**P2 — antes de conectar proveedores reales (pago/IA):** 14. Reserva atómica del presupuesto de IA + costos en fallos + cuota por usuario + verificación de correo (SEC-19). 15. Webhook de pago firmado, `cancelPayment`, validación de monto, TTL por método (SEC-23). 16. S3/R2 en dominio sin cookies + job de huérfanas + CORP + retención (SEC-14, SEC-40). 17. Guardián de contenido de la salida de IA + cálculo de cifras en código (SEC-28) + retención de logs (SEC-29).

**P3 — endurecimiento y cumplimiento continuo:** 18. Aplicar `SUSPENDED` (SEC-24), validar transiciones de pedido y cancelación/reembolso (SEC-25). 19. Centro de privacidad ARCO + aviso completo (SEC-26, SEC-34). 20. Contraseñas contra listas filtradas (SEC-30), cursor de feed acotado (SEC-31), índice de búsqueda (SEC-32). 21. Roles/aprobación de gobernanza + rol de BD sin superusuario (SEC-39). 22. Runtime de Node parcheado + parche de Next + endurecer pnpm/audit en CI (SEC-22, SEC-37).

---

## Anexo A — Ítems refutados

- **`ai-future-provider-contract-injection`** — "El contrato `AIProvider` no separa instrucciones de datos ni
  acota tokens/tiempo/cancelación". Refutado en severidad: los hechos de código son correctos (el contrato no
  tiene `options`, `timeout` ni `AbortSignal`), pero no constituye una vulnerabilidad hoy — el proveedor es un
  mock sin red ni costo, y la falta de acotación de tokens/tiempo es una carencia de diseño del futuro adaptador,
  ya cubierta por la corrección de SEC-19 (max_tokens/timeout en el adaptador real). Se incorpora como nota de
  diseño en SEC-19, no como hallazgo independiente.

---

## Anexo B — Artefactos

PoC, scripts y salidas en `E:\vendeia\.data\security\` (ignorado por git), organizados por dimensión:
`authn`, `abuse`, `commerce`, `config`, `privacy`, `uploads`, `ai-future`, `payments`, y carpetas `verify-A-*`
de la verificación adversarial. Cuentas de prueba creadas: `e2e.sec.*@example.com` (patrón que
`pnpm db:clean-e2e` elimina, junto con sus archivos de storage). Recomendación: ejecutar `pnpm db:clean-e2e` para
retirar las cuentas y filas de prueba, y una limpieza puntual de las filas de analítica anónimas dejadas por los
PoC de SEC-20 (`DELETE FROM analytics_events WHERE type='SHARE' AND "userId" IS NULL AND "entityId" IN (…)`).
