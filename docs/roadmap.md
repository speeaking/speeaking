# Roadmap

Estados: ✅ hecho · 🟡 parcial · ⏳ pendiente. Cada fase cierra con typecheck, lint, formato, pruebas,
build y revisión de rutas/UX; si algo falla se corrige antes de avanzar.

**Verificación vigente (ronda de autonomía, cerrada el 2026-09-26):**

- Pruebas unitarias y de componentes (`pnpm test`): 1,945 pasan · 0 fallan (178 archivos; las de base de datos corren en serie).
- Pruebas E2E (`pnpm test:e2e`, móvil y escritorio): 147 pasan · 8 omitidas (de un solo tamaño) · 1 inestable bajo carga en la corrida completa (`product-edit`), que pasa 4/4 sola; se blindó la espera y volvió a pasar.
- `pnpm typecheck`, `pnpm lint` y `pnpm format:check`: verde.
- `pnpm build`: verde.
- Corrida: 2026-09-26 (hora de México) · commit «feat: motor de automejora…» (ver `git log`).

Verificación anterior (2026-09-26, tras la auditoría y sus correcciones): 1,214 pruebas unitarias y
de componentes, 119 pruebas E2E (móvil y escritorio; 7 omitidas por ser de un solo tamaño),
typecheck, lint, formato y build de producción en verde. Seguridad: ver
`security/auditoria-2026-09-26.md`.

## Sprint 1 — Fundación ✅

| Fase | Entregable                                                                                                                                 | Estado |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 1.0  | Git, Next 16, TS estricto, Tailwind, shadcn/ui (Base UI), ESLint/Prettier, Vitest, Playwright, estructura modular, docs                    | ✅     |
| 1.1  | Identidad "mercado cálido", 5 pestañas móvil / barra lateral escritorio, Studio, estados vacío/carga/error/404, PWA                        | ✅     |
| 1.2  | Clúster PostgreSQL 17 propio, Prisma 7, esquema Sprint 1 + CHECKs, seed (23 categorías, 12 comunidades, 48 posts, 8 demos)                 | ✅     |
| 1.3  | Registro, login, logout, sesiones en BD, límite de intentos, `proxy.ts`, consentimientos versionados, borradores legales                   | ✅     |
| 1.4  | Onboarding de 3 pasos (objetivos, comunidades, marcas, "¿buscas algo?", personalización), perfil público, seguir                           | ✅     |
| 1.5  | Publicar con imágenes, feed "Para ti" (RecommendationEngine + Commerce Engine v0), likes, comentarios, guardados, comunidades, impresiones | ✅     |
| 1.6  | Productos con costo privado y datos P4, página pública con compartir, preguntas rápidas y relacionados, Comprar con búsqueda               | ✅     |
| 1.7  | Studio: beneficio (métrica norte), ventas, pedidos, productos, visitas, conversión, camino a la primera venta                              | ✅     |
| 1.8  | Sube y vende: proveedor simulado detrás de `AIProvider`, propuesta validada, cifras P2, guardián de presupuesto, P3                        | ✅     |

**Definición de terminado cumplida** (pruebas E2E): registrarme, iniciar sesión, crear perfil, entrar
al feed, crear publicación, crear producto, ver producto, entrar al dashboard y entrar a Sube y vende.

## Sprint 2 — Comprar (fases 7–9) 🟡

| Entregable                                                                                                                                       | Estado |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Carrito, direcciones, checkout con `PaymentProvider` simulado, una orden por vendedor                                                            | ✅     |
| Stock atómico con reserva de 30 min, pagos idempotentes, libro de ingresos de la plataforma                                                      | ✅     |
| Pedidos del comprador y del vendedor (enviar / entregar)                                                                                         | ✅     |
| Preguntas rápidas deterministas (P4)                                                                                                             | ✅     |
| Edición de productos en el Studio: texto, precio, existencias, fotos, datos P4 y costo privado (solo para su dueño)                              | ✅     |
| Fotos a proporción completa: collage estilo Facebook en el feed (1–4, «+N») y carrusel en la publicación y el producto                           | ✅     |
| Búsqueda global `/buscar` (comunidades, productos y publicaciones) y Comprar con la misma búsqueda: por palabras, sin acentos, SQL parametrizado | ✅     |
| Estados de carga con la forma de cada página (Comprar, producto, carrito y checkout)                                                             | ✅     |
| Índices de búsqueda (trigramas, SEC-32) ✅; búsqueda semántica y filtros de precio/ubicación ⏳                                                  | 🟡     |
| Webhook real de pagos (`/api/payments/webhook/[provider]`) al conectar Mercado Pago/Stripe                                                       | ⏳     |
| Video (`MediaProcessor` + proveedor gestionado)                                                                                                  | ⏳     |
| Moderación mínima: reportar, ocultar, rol de administración (ver Autonomía)                                                                      | ✅     |
| Centro de decisiones del motor de automejora y experimentos (ver Autonomía)                                                                      | ✅     |

### Rediseño del inicio («Revista» + lo mejor de «Plaza») ✅

Detalle en [`design/rediseno-revista.md`](design/rediseno-revista.md).

| Fase                                                                                                  | Estado |
| ----------------------------------------------------------------------------------------------------- | ------ |
| F0 · Paleta rosa mexicano, tinte por comunidad (AA) y `CommunityAvatar`                               | ✅     |
| F1 · Barra superior y columna izquierda de escritorio (única entrada a Sube y vende en «Para vender») | ✅     |
| F2 · PostCard v2 con contadores honestos y tarjeta de producto P4                                     | ✅     |
| F3 · Variantes al pintar (portada, tipográfica, estándar)                                             | ✅     |
| F4 · Columna derecha con datos reales (debates, comunidades en movimiento, lo que buscas)             | ✅     |
| F5 · Compositor (la fila de burbujas se retiró el 2026-09-30, ADR-050)                                | ✅     |
| F6 · Visitantes: bienvenida, invitaciones en contexto y `?unirse=`                                    | ✅     |
| F6b · «Gente de tus comunidades»: datos, ajuste de privacidad, columna y carrusel en el feed          | ✅     |
| F7 · Novedades por comunidad («N nuevas»)                                                             | ✅     |

## Sprint 3 — IA real (fases 11–12) 🟡

Hecho (ADR-034): adaptador `openai_compatible` (modelo abierto pagado por uso en un servidor externo,
sin SDK), modelo por tarea con `ai.routing`, cuotas por persona (10 al día, 30 al mes), evaluaciones
(`pnpm ai:eval`), kit de anuncios y analista diario del motor de automejora (plantilla; la IA solo
redactaría). Pendiente: llaves reales, primera evaluación aprobada por tarea con el modelo elegido y
variantes de contenido. Hoy todo corre con la IA simulada (en producción solo con
`ALLOW_SIMULATED_AI=true`, ADR-038).

## Autonomía (CEO-IA) 🟡

Motor de automejora (ADR-019, ADR-033, ADR-037), confianza y moderación (ADR-036), IA por tarea
(ADR-034, ADR-038) y área del equipo (ADR-035). La IA propone; el código mide, aplica dentro de
límites y revierte; adoptar lo de riesgo medio y aprobar lo de riesgo alto requiere a una persona.
Pagos, precios, comisiones y gasto quedan fuera de su alcance.

| Entregable                                                                                                               | Estado |
| ------------------------------------------------------------------------------------------------------------------------ | ------ |
| Rol ADMIN en el perfil, páginas de `/admin` con la página 404 de una ruta inexistente y script `make-admin`              | ✅     |
| Métricas diarias (`DailyMetric`), analista con estadística determinista y propuestas con nivel de riesgo                 | ✅     |
| Modos `observer` / `low_risk`, congelamiento en fechas pico, umbral de tráfico y `applySettingChange` con reversión      | ✅     |
| Experimentos con asignación por persona y salvaguardas con reversión automática                                          | ✅     |
| Centro de decisiones: `/admin/resumen`, `/admin/decisiones`, `/admin/experimentos`                                       | ✅     |
| Operación diaria: `pnpm ops:daily` y `/api/cron/daily` con `CRON_SECRET`, cada paso en `JobRun`                          | ✅     |
| Riesgo de falsificación por reglas, reportes, comprobante del vendedor y cola `/admin/moderacion`                        | ✅     |
| IA por API compatible con OpenAI, `ai.routing`, evaluaciones, `/admin/ia` y kit de anuncios                              | ✅     |
| El arranque en producción falla con IA simulada salvo `ALLOW_SIMULATED_AI=true`                                          | ✅     |
| Impresiones visibles (T5) aceptadas solo si la pieza se sirvió y salvaguardas con prueba estadística (ADR-037)           | ✅     |
| El motor decide solo con personas con sesión (umbral, salvaguardas, analista y experimentos; ADR-037)                    | ✅     |
| Detectar robots y tráfico anómalo de cuentas (plan §2.3; el tráfico sin cuenta ya no mueve decisiones)                   | ⏳     |
| Aviso de privacidad y términos 2026-09-27 y aviso para volver a aceptarlos al cambiar de versión                         | ✅     |
| Plazos máximos de conservación de actividad, reportes y comprobantes (marcados como pendientes en el aviso)              | ⏳     |
| Interruptor de la IA sin plantillas: con la ruta al simulador en producción, avisar o publicar a mano (ADR-038)          | ⏳     |
| Programar la operación diaria en el hosting (Vercel Cron o cron del VPS, ver `architecture.md` → Operación)              | ⏳     |
| 2FA y reautenticación reciente para ADMIN (antes de abrir a la zona)                                                     | ⏳     |
| Llaves reales de IA, primera evaluación aprobada por tarea y nombre legal y país del proveedor en el aviso de privacidad | ⏳     |
| Proveedor de correo: verificación de cuenta (SEC-10), recuperar contraseña y avisos de pedido                            | ⏳     |
| Registro de 5xx, monitor de salvaguardas cada hora, `Narrator` con IA y alerta si la operación diaria no corre           | ⏳     |

## Sprint 5 — Estilista, Pruébatelo y autofinanciamiento ✅ (2026-09-29)

Marca **Estreno** (ADR-041), diseño sereno (ADR-042), núcleo de IA con banderas (ADR-043), saldo y
precio comunitario (ADR-044) y Pruébatelo con privacidad de fotos (ADR-045). Detalle del cobro en
[`modelo-de-ingresos.md`](modelo-de-ingresos.md).

| Entregable                                                                                                         | Estado |
| ------------------------------------------------------------------------------------------------------------------ | ------ |
| Marca Estreno en toda la interfaz y los documentos; «Sube y vende» con redirección desde la ruta anterior          | ✅     |
| Diseño sereno: una acción principal por pantalla, `soft` neutro, tintes suaves, sin lima                           | ✅     |
| Banderas `ai.features` (20 funciones, 9 encendidas) con interruptores en `/admin/ia` y bitácora                    | ✅     |
| Proveedor de imágenes por interfaz (simulador + adaptador compatible con OpenAI), precios por imagen con fecha     | ✅     |
| Guardián de presupuesto con `funding` (subsidiado vs. pagado), tope diario de Pruébatelo, cuotas por función       | ✅     |
| «¿Qué necesitas?» (reglas + modelo), «Crea mi look», «Completa mi look», cambiar piezas, comprar look              | ✅     |
| Pruébatelo: foto privada con consentimiento, hasta 4 prendas, caché, retención de 30 días, Ajustes → Mis fotos     | ✅     |
| Saldo: cartera, movimientos, recargas simuladas, precio comunitario, `/precios`, patrocinio del vendedor en Studio | ✅     |
| Semilla de moda con 12 productos y fotos con licencia; categorías de moda por hueco                                | ✅     |
| Prueba E2E `stylist.spec.ts` (visitante, ficha, look → foto → simulación → carrito, saldo)                         | ✅     |
| Recargas con procesador real (webhook) y textos legales del saldo                                                  | ⏳     |
| Modelo de imagen real (`AI_IMAGE_MODEL`) evaluado con fotos reales antes de encender en producción                 | ⏳     |
| Evaluación (`pnpm ai:eval`) para `shopping_intent` y modelo de texto aprobado                                      | ⏳     |
| Studio: «N personas buscan algo como esto» por producto (matching, `buyerMatching`)                                | ⏳     |

## Sprint 6 — Quien vende paga, «Ver cómo me veo» en un paso y publicidad 🟡 (2026-09-29)

Corrección de rumbo del fundador (ADR-046): red social primero, quien compra no paga por verse con
una prenda, la columna derecha es publicidad y cada beneficio para tiendas se cobra desde un saldo.

| Entregable                                                                                                                                                    | Estado |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| «Ver cómo me veo» en un paso desde la ficha: foto, simulación, comprar y «Agrégale…» en un diálogo                                                            | ✅     |
| Quien vende paga: tienda → cortesía de Estreno (10 por tienda) → demanda registrada; saldo solo de tiendas                                                    | ✅     |
| Recargas Arranque / Impulso / Tienda pro; `/studio/saldo` con pruebas, demanda y movimientos                                                                  | ✅     |
| Producto destacado: días desde el saldo, bloque «Patrocinado» en la columna derecha, ficha y Comprar                                                          | ✅     |
| Columna izquierda plegable (escritorio)                                                                                                                       | ✅     |
| Mensajes privados entre personas (bandeja, hilo, no leídos, reportar)                                                                                         | ✅     |
| Apoyos voluntarios (`SUPPORT_URL`), `/apoya` con costos transparentes y `/seguridad`; borrar mi cuenta desde Ajustes; columnas pegadas a los bordes (ADR-048) | ✅     |
| Entrar con Google (código listo; se enciende con las credenciales del fundador, ADR-049); passkeys después                                                    | ✅     |
| Búsqueda por foto: describir las prendas de una foto y buscar parecidos reales (fase 4, `imageSearch`)                                                        | ⏳     |
| Centro de avisos (me gusta, comentarios, seguidores, mensajes), como la campana de Facebook                                                                   | ⏳     |

### Ecosistema de IA por fases (plan del fundador, 2026-09-29)

| Fase                                                                                                                                                           | Funciones                                                                                        | Estado                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------- |
| 1                                                                                                                                                              | Núcleo: proveedores por interfaz, banderas, prompts versionados, costo, caché, cuotas, auditoría | ✅                         |
| 2                                                                                                                                                              | ¿Qué necesitas?, Crea mi look, Pruébatelo, Completa mi look, coincidencias comprador–producto    | ✅ (matching en Studio ⏳) |
| 3                                                                                                                                                              | Sube y vende con foto, creativos con imagen, video, agente comercial                             | Banderas apagadas          |
| 4                                                                                                                                                              | Búsqueda por imagen, comprador IA, regalos, asistente general, feed personalizado                | Banderas apagadas          |
| 5                                                                                                                                                              | Negociación, tendencias, insights, antifraude, visualizadores de espacios y autos                | Banderas apagadas          |
| Carrusel de productos en el feed: patrocinados, búsqueda declarada o comunidades, más vendidos, populares, novedades (ADR-051)                                 | ✅                                                                                               |
| Detalles que se sienten: publicación en capa sobre el feed, foto que viaja a la ficha, «me gusta» que salta y vibra, doble toque, carrito como panel (ADR-052) | ✅                                                                                               |
| Página de cookies y pie legal también en teléfono (ADR-053)                                                                                                    | ✅                                                                                               |
| Editar perfil con portada propia y foto; listas de seguidores y seguidos (ADR-058)                                                                             | ✅                                                                                               |
| Comentarios en panel que sube desde abajo y mosaico de varias fotos como Facebook (ADR-057)                                                                    | ✅                                                                                               |
| Panel del vendedor: semana con tendencia, pendientes, desempeño, embudo y actividad por producto (ADR-056)                                                     | ✅                                                                                               |
| Perfil nuevo en móvil: portada con su foto, en común, pestañas Fotos y Tienda; abrirlo pasa la página (ADR-055)                                                | ✅                                                                                               |
| Reacciones además de «me gusta»: seis emojis, una por persona, resumen por publicación (ADR-054)                                                               | ✅                                                                                               |

## Sprint 4 — Crecer (fases 13–14) ⏳

Campañas conceptuales (kit de difusión + estrategia), analítica con agregados diarios, centro de
privacidad completo (descargar/borrar datos), notificaciones, verificación de correo.

## Solo preparado

AI Companion del comprador, búsqueda por foto, AI Sales Agent (datos P4 listos), Autopiloto, creadores y
afiliados (atribución `sourcePostId` lista), grupos creados por usuarios, app móvil (`/api/v1`).

**Reels (P13), después del rediseño.** Fila de reels en el feed y visor vertical a pantalla completa, con
etiqueta de precio en reels de producto y «Convierte tus fotos en un reel». Requiere un proveedor de
video gestionado (Cloudflare Stream, Mux o Bunny) y ahorro de datos en redes móviles. Historias de 24 h
van después. Ver `product-principles.md` → P13.

**Impulso pagado por resultados + vendedor IA (P12).** Se activa cuando haya flujo (umbral a definir;
propuesta: ≥ 5,000 personas activas por semana y ≥ 100 ventas orgánicas por semana). Cobro por resultado
(«si no vendes, no pagas»), siempre dentro de los espacios comerciales existentes y con etiqueta
«Patrocinado». Ver `product-principles.md` → P12.
