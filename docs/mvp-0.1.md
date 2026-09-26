# MVP 0.1 — Documento de producto

Responde a los 11 puntos del documento de visión e incorpora las mejoras detectadas durante el diseño.
Complementa a `product-principles.md` (qué no se negocia) y `architecture.md` (cómo se construye).

## 0. Hipótesis y alcance

**Experimento del piloto:** 100 vendedores. Pregunta: ¿la IA puede ayudar a un pequeño vendedor a
conseguir ventas sin saber publicidad? Flujo: producto → IA → contenido → difusión → venta.

**Métrica principal:** beneficio generado por vendedor (ventas − costo del producto − comisiones −
gasto declarado en promoción), calculado por código (P2).

**Mejora clave sobre la visión original — la demanda no espera a V2.** Un vendedor sin compradores no
vende. El MVP ataca la demanda desde el día 1 con dos motores:

1. **Links compartidos (P1):** cada producto tiene página pública (sin login), vista previa rica y kit
   para WhatsApp/Instagram/Facebook. Los vendedores del piloto traen a sus propios clientes.
2. **Comunidades por nicho con contenido precargado:** humor, gaming, tecnología, comida, música,
   deportes, mascotas, moda, hogar, autos, belleza, emprendimiento… Quien llega elige sus comunidades y
   encuentra contenido desde el primer minuto; así conocemos sus gustos poco a poco.

**V1 = feed + comunidades + productos + IA para vendedores + checkout (simulado en V0.1).**

## 1. Pantallas

Navegación móvil (máximo 5 pestañas): **Inicio · Descubrir · Crear (＋) · Comprar · Perfil**.
"Videos" vive dentro de Inicio/Descubrir y la IA del vendedor dentro de Crear y del Studio, para no
saturar la barra (el documento de visión proponía 7 secciones).

| Pantalla             | Contenido                                                                                                                              | Fase     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Registro / Login     | Email + contraseña, consentimiento de términos y aviso de privacidad                                                                   | 1.3      |
| Onboarding           | Nombre de usuario, foto opcional, elegir comunidades (mín. 3)                                                                          | 1.4      |
| Inicio "Para ti"     | Feed con posts, productos integrados y chips comprables; like/comentar/guardar                                                         | 1.5      |
| Descubrir            | Búsqueda, comunidades, tendencias, creadores                                                                                           | 1.5–1.6  |
| Comunidad            | Portada, unirse, feed del nicho                                                                                                        | 1.5      |
| Crear (hoja)         | Publicación · Producto · ✨ Vende con IA                                                                                               | 1.5–1.8  |
| Publicación          | Detalle, comentarios, producto asociado                                                                                                | 1.5      |
| Producto (pública)   | Galería, precio, vendedor, ubicación, disponibilidad, envío, garantía, compartir                                                       | 1.6      |
| Comprar              | Categorías, búsqueda, filtros                                                                                                          | 1.6 / S2 |
| Carrito / Checkout   | Una orden por vendedor, pago simulado, confirmación                                                                                    | S2       |
| Perfil               | Publicaciones, productos (si vende), seguidores, activar "Vender"                                                                      | 1.4      |
| Ajustes y privacidad | Personalización on/off, descargar/borrar datos                                                                                         | 1.4 / S4 |
| Studio (vendedor)    | Resumen (beneficio, ventas, pedidos, productos, visitas, conversión), Productos, Contenido, Vende con IA, Campañas, Pedidos, Analítica | 1.7      |
| Centro de decisiones | Propuestas del motor de automejora: aprobar, rechazar, revertir                                                                        | S2–S3    |

## 2. Recorridos

- **Comprador que llega por un link:** WhatsApp → página del producto (sin login) → ve contenido
  relacionado y la comunidad → "Comprar" → registro rápido → checkout → confirmación → sigue al
  vendedor o a la comunidad.
- **Comprador orgánico:** registro → elige comunidades → "Para ti" → interactúa → el Commerce Engine
  detecta intención → producto → compra.
- **Vendedor:** registro → Crear → Vende con IA → "Tengo 50 AirPods Pro 2, me costaron $2,400, los
  vendo a $3,499" → propuesta (cifras calculadas por código) → "Crear producto con esta propuesta" (P3)
  → publicar + post automático → kit para compartir → ventas → el Studio muestra su beneficio.
- **Creador (V3):** publica un video con producto etiquetado → comisión por venta atribuida
  (ej.: 5 % de $3,499 = $174.95).

## 3. Qué IA necesitamos

| Capacidad                           | V0.1                                 | Después                                  |
| ----------------------------------- | ------------------------------------ | ---------------------------------------- |
| Propuesta de venta (Vende con IA)   | Proveedor simulado + salida validada | LLM real con salida estructurada         |
| Cálculos financieros                | Código determinista (nunca IA)       | Igual                                    |
| Generación de contenido y variantes | Interfaz + simulado                  | LLM real; imagen/video vía proveedores   |
| Contenido precargado de comunidades | Semillas curadas y etiquetadas       | Pipeline editorial asistido por IA       |
| Ranking del feed                    | Reglas explicables (v0)              | Modelo entrenado con eventos registrados |
| Commerce Engine (intención)         | Reglas con pesos y decaimiento       | Modelo de propensión                     |
| Motor de automejora                 | Parámetros con límites + bitácora    | Análisis diario con LLM + experimentos   |
| AI Companion (comprador)            | —                                    | V2: lenguaje natural → filtros → BD      |
| Búsqueda por foto                   | —                                    | V2+: embeddings de imagen (pgvector)     |
| AI Sales Agent                      | Datos estructurados listos (P4)      | V5: herramientas de solo lectura         |
| Autopiloto                          | Eventos + modelo de campañas         | V6: dentro de límites del vendedor       |

## 4. Algoritmo del feed y Commerce Engine

1. **Candidatos:** contenido reciente de las comunidades del usuario, cuentas que sigue, popular
   global (exploración) y productos elegibles.
2. **Puntuación v0 (explicable):** recencia con decaimiento + engagement normalizado + afinidad
   (comunidades/categorías) + seguimiento. Cada impresión guarda posición, puntuación y versión del
   algoritmo para poder entrenar modelos después.
3. **Commerce Engine:** calcula intención por categoría a partir de señales propias con pesos y
   decaimiento temporal (búsqueda, vistas repetidas, guardar, visitar producto, carrito). Con intención
   alta elige el producto más relevante para el siguiente espacio comercial ("Encontramos algo que
   podría interesarte"). **La intención cambia qué producto aparece, nunca rompe el tope comercial.**
4. **Reglas de mezcla:** tope comercial configurable (~1 de cada 3–4), diversidad de autores y
   comunidades, sin repeticiones.
5. **Arranque en frío:** comunidades elegidas + popular global + exploración.

## 5. Cómo se realiza una venta (V0.1)

Producto → "Comprar ahora" o carrito → login si hace falta → dirección o recoger en punto → método de
pago (simulado) → el checkout crea **una orden por vendedor** y reserva stock de forma atómica →
`PaymentProvider` simulado confirma → la orden pasa a "pagada" → el vendedor la ve en el Studio → marca
enviado/entregado. Cada paso registra eventos con la publicación de origen (atribución).

Pagos reales (después): Mercado Pago o Stripe con reparto de fondos (split) para cobrar la comisión.
**Nunca retenemos fondos de terceros.** En México, cobrar por cuenta de terceros puede implicar
retenciones de ISR/IVA y CFDI: requiere asesoría fiscal antes de activar pagos reales.

## 6. Cómo cobramos

| Fuente                   | Propuesta                                              | Cuándo             |
| ------------------------ | ------------------------------------------------------ | ------------------ |
| Comisión por venta       | % por transacción; solo si el vendedor vende           | Con pagos reales   |
| Suscripción vendedor     | $299 / $799 / $1,999 MXN al mes                        | Después del piloto |
| Promoción por resultados | Cobro por venta atribuida, no por impresiones          | Requiere P5 maduro |
| IA premium               | Generación ilimitada, agente de ventas, automatización | Después del piloto |

Recomendación para el piloto: sin costo o comisión mínima; el objetivo es demostrar beneficio.

**La IA se autofinancia (ADR-020):** su presupuesto mensual = semilla + un porcentaje de los ingresos
del mes anterior. Trayectoria: subsidiada durante el piloto → cubre su costo (cobertura ≥ 1) →
utilidades que financian crecimiento. El motor de automejora mejora la cobertura con modelos adecuados
por tarea, caché y cuotas, y propone precios basados en el valor entregado (una fracción del beneficio
generado al vendedor); los cambios de precio los aprueba un humano.

**Economía unitaria de la IA (P2 aplicado a nosotros):** una propuesta ≈ 3,000 tokens de entrada +
2,000 de salida. Con precios de lista de Anthropic (consultados 2026-06; verificar al contratar):
Claude Opus 5 ≈ US$0.065, Claude Sonnet 5 ≈ US$0.026, Claude Haiku 4.5 ≈ US$0.013 por propuesta.
300 propuestas al mes con Opus 5 ≈ US$19.50, más que un plan de $299 MXN: **las cuotas por plan y la
elección de modelo son decisiones de negocio**, y `AIRequest` registra tokens y costo desde el inicio.

## 7. Tecnología

Next.js 16 + TypeScript estricto + Tailwind 4 + shadcn/ui (Base UI) + PostgreSQL 17 + Prisma 7 +
Better Auth, con proveedores intercambiables para IA, pagos, archivos y email. Detalle y versiones
fijadas en `architecture.md` y `decisions.md`.

## 8. Privacidad y seguridad

Consentimiento versionado, personalización desactivable, solo datos propios, ubicación pública a nivel
ciudad/estado, fotos re-codificadas sin GPS, costo interno nunca enviado al navegador, autorización en
servicios, cabeceras de seguridad, dependencias fijadas con cuarentena de 24 h. Detalle en
`architecture.md`.

## 9. Métricas que dirán si funciona

- **Norte:** beneficio mediano por vendedor activo.
- **Vendedor:** tiempo a primer producto publicado (meta < 10 min), % de productos creados con IA,
  tiempo a primera venta, % de vendedores con ≥ 1 venta en 30 días.
- **Demanda:** visitas desde links compartidos, conversión visita → compra, registros desde links,
  retención D1/D7, miembros activos por comunidad, sesiones con ≥ 5 piezas vistas.
- **Salud:** % de contenido comercial visto (≤ 30 %), "no me interesa", reportes, devoluciones y quejas.
- **IA:** costo por propuesta, % de propuestas aceptadas, cambios que hace el vendedor.
- **Criterio de éxito sugerido (a validar):** ≥ 40 % de los vendedores con al menos una venta en
  30 días y beneficio mediano positivo.

## 10. Cuánto cuesta construir V1 (estimación a validar)

| Concepto               | Estimación                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Desarrollo             | Agentes de IA + tu tiempo de dirección y pruebas (sin equipo inicial)                                                       |
| Infraestructura piloto | Hosting Next.js, Postgres gestionado, almacenamiento S3/R2, email: planes iniciales, del orden de decenas de dólares al mes |
| IA                     | 100 vendedores × 50 generaciones/mes: ≈ US$325 (Opus 5), US$130 (Sonnet 5), US$65 (Haiku 4.5)                               |
| Pagos                  | Comisión del procesador por transacción (verificar tarifas vigentes)                                                        |
| Legal y fiscal         | Aviso de privacidad, términos, retenciones de plataformas: cotizar                                                          |
| Marca                  | Registro ante el IMPI cuando se defina el nombre                                                                            |

## 11. Qué construimos nosotros con IA para bajar el costo

- Todo el software (agentes que escriben código verificado por pruebas automáticas).
- El contenido semilla de las comunidades (con curaduría humana y etiquetado).
- Copies, guiones y variantes para los vendedores (es el producto mismo).
- Pruebas, QA, documentación, análisis de métricas y traducciones para la expansión.
- Borradores legales y de soporte, **siempre** con revisión humana profesional.

No delegamos por completo a la IA: decisiones legales/fiscales, pagos reales, cambios de precios o
comisiones y moderación de casos sensibles.

## Contradicciones del documento de visión y cómo se resolvieron

| Detectado                                               | Resolución                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 7 secciones en la navegación                            | 5 pestañas; Videos dentro de Inicio/Descubrir; IA en Crear y Studio                                                    |
| "Precio sugerido", "Competencia media", "Público alto"  | Hipótesis etiquetadas; la IA no tiene datos de mercado reales (P2)                                                     |
| "[LANZAR] $300/día"                                     | Sin anuncios externos en V0.1: "Lanzar" genera el kit de difusión con links atribuidos; promoción interna después (P7) |
| "¿Son originales?" respondido por la IA                 | Autenticidad declarada por el vendedor y mostrada como tal (P4)                                                        |
| "¿Aceptas transferencia? Sí"                            | Métodos de pago estructurados; el agente comparte link de checkout y nunca pide datos de pago en el chat               |
| Compradores hasta V2                                    | Demanda desde V1: links compartidos + comunidades precargadas                                                          |
| "La IA como CEO que decide sola"                        | Automejora continua dentro de límites, con aprobación humana en decisiones de alto impacto                             |
| Expansión a Colombia, Argentina, Chile, España, EE. UU. | País, moneda y locale centralizados; montos siempre con moneda                                                         |
