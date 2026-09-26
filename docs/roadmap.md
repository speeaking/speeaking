# Roadmap

Estados: ✅ hecho · 🟡 parcial · ⏳ pendiente. Cada fase cierra con typecheck, lint, formato, pruebas,
build y revisión de rutas/UX; si algo falla se corrige antes de avanzar.

Verificación vigente (2026-09-25, tras el rediseño): 653 pruebas unitarias y de componentes, 79 pruebas E2E
(móvil y escritorio; 7 omitidas por ser de un solo tamaño), typecheck, lint, formato y build de producción en verde.

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
| 1.8  | Vende con IA: proveedor simulado detrás de `AIProvider`, propuesta validada, cifras P2, guardián de presupuesto, P3                        | ✅     |

**Definición de terminado cumplida** (pruebas E2E): registrarme, iniciar sesión, crear perfil, entrar
al feed, crear publicación, crear producto, ver producto, entrar al dashboard y entrar a Vende con IA.

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
| Índices de búsqueda (trigramas) o búsqueda semántica y filtros de precio/ubicación                                                               | ⏳     |
| Webhook real de pagos (`/api/payments/webhook/[provider]`) al conectar Mercado Pago/Stripe                                                       | ⏳     |
| Video (`MediaProcessor` + proveedor gestionado)                                                                                                  | ⏳     |
| Moderación mínima: reportar, ocultar, rol de administración                                                                                      | ⏳     |
| Centro de decisiones del motor de automejora y experimentos                                                                                      | ⏳     |

### Rediseño del inicio («Revista» + lo mejor de «Plaza») ✅

Detalle en [`design/rediseno-revista.md`](design/rediseno-revista.md).

| Fase                                                                                                  | Estado |
| ----------------------------------------------------------------------------------------------------- | ------ |
| F0 · Paleta rosa mexicano, tinte por comunidad (AA) y `CommunityAvatar`                               | ✅     |
| F1 · Barra superior y columna izquierda de escritorio (única entrada a Vende con IA en «Para vender») | ✅     |
| F2 · PostCard v2 con contadores honestos y tarjeta de producto P4                                     | ✅     |
| F3 · Variantes al pintar (portada, tipográfica, estándar)                                             | ✅     |
| F4 · Columna derecha con datos reales (debates, comunidades en movimiento, lo que buscas)             | ✅     |
| F5 · Burbujas de comunidades y compositor                                                             | ✅     |
| F6 · Visitantes: bienvenida, invitaciones en contexto y `?unirse=`                                    | ✅     |
| F6b · «Gente de tus comunidades»: datos, ajuste de privacidad, columna y carrusel en el feed          | ✅     |
| F7 · Novedades por comunidad («N nuevas»)                                                             | ✅     |

## Sprint 3 — IA real (fases 11–12) ⏳

Adaptador real de `AIProvider` (propuesta: Claude vía SDK oficial con salida estructurada), generación
de contenido y variantes, cuotas por plan, evaluación de calidad de propuestas, analista diario del motor
de automejora.

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
