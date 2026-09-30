# Modelo de ingresos: quién paga qué y cómo baja el precio con la comunidad

Fecha: 2026-09-29 (revisado el mismo día, ADR-046) · Estado: aprobado como base (ADR-044, ADR-046) ·
Dueño: dirección (IA-CEO propone, una persona aprueba los precios)

> Reglas del fundador: la plataforma se autofinancia, cada peso se reinvierte en la IA y en nuevas
> funciones, nada debe ser caro porque el costo se reparte entre todas las personas que la usan,
> conforme entra más gente el precio baja sin que dejemos de ganar, y **quien compra no paga por ver
> cómo le queda algo: eso lo paga quien vende**, porque es quien gana con la venta.

Todas las cifras son **[estimación]** con precios de lista consultados el 2026-09-29 (fuentes al
final). Se revisan al contratar y cada vez que cambie la tabla de costos del código
(`src/modules/ai/cost.ts`, `src/modules/billing/pricing.ts`).

## 1. Qué nos cuesta dinero (y qué no)

| Acción                                             | Costo unitario del proveedor      | Quién la dispara | Frecuencia esperada     |
| -------------------------------------------------- | --------------------------------- | ---------------- | ----------------------- |
| «¿Qué necesitas?» (interpretar una necesidad)      | ≈ US$0.0002–0.0005 por consulta   | Comprador        | Alta, barata            |
| «Crea mi look» / «Completa mi look» (combinar)     | US$0 (lo calcula el código)       | Comprador        | Alta, gratis            |
| Nombre y explicación de un look (texto)            | ≈ US$0.0003, se guarda y se reusa | Comprador        | Media, barata           |
| **«Ver cómo me veo»** (una imagen generada)        | **≈ US$0.034–0.075 por imagen**   | Comprador        | Media, **la cara**      |
| Texto de publicación del vendedor («Sube y vende») | ≈ US$0.001–0.01 por propuesta     | Vendedor         | Baja, barata            |
| Kit de anuncios (texto)                            | ≈ US$0.005                        | Vendedor         | Baja, barata            |
| Producto destacado (publicidad)                    | US$0 (solo lugar en pantalla)     | Vendedor         | Media, **margen puro**  |
| Mensajes privados                                  | ≈ US$0 (texto en la base)         | Todos            | Alta, gratis            |
| Imágenes publicitarias (fase 3)                    | ≈ US$0.03–0.07 por imagen         | Vendedor         | Media, cara             |
| Video promocional (fase 3)                         | ≈ US$0.5–3 por clip               | Vendedor         | Baja, **muy cara**      |
| Fotos de las personas para «Ver cómo me veo»       | ≈ US$0.015 por GB al mes (R2)     | Comprador        | Despreciable (30 días)  |
| Infraestructura (Vercel + Neon + R2)               | ≈ US$30–40 al mes en el piloto    | Todos            | Fija, crece con tráfico |

**Conclusión:** solo dos cosas pueden desfinanciarnos: las **imágenes** («Ver cómo me veo» y
creativos) y el **video**. Todo lo demás cuesta centavos y sirve para traer gente: se regala con
cuotas. Y hay una cosa que no cuesta nada y sí se cobra: el **lugar en pantalla** (destacados).

## 2. Dónde cobramos sí o sí (y a quién)

| Cobro                                        | Quién paga   | Cuándo                                               | Por qué es obligatorio                                              |
| -------------------------------------------- | ------------ | ---------------------------------------------------- | ------------------------------------------------------------------- |
| **«Ver cómo me veo»** sobre sus productos    | Vendedor     | Cada prueba, después de las de cortesía de su tienda | Cada imagen cuesta dinero real y quien vende es quien gana con ella |
| **Producto destacado**                       | Vendedor     | Por día, por adelantado                              | Es publicidad: la columna derecha y las sugerencias son ese espacio |
| **Impulsar** (P12, publicidad por resultado) | Vendedor     | Cuando haya tráfico (umbral de P12)                  | Presupuesto, no planes: «si no vendes, no pagas»                    |
| Imágenes y video para anuncios (fase 3)      | Vendedor     | Por generación, desde su saldo                       | Costo alto y beneficio directo para quien vende                     |
| Comisión por venta                           | Vendedor     | Solo con pagos reales (hoy 0 %, ADR-024)             | Es la fuente principal cuando el dinero pase por la plataforma      |
| Apoyos voluntarios (ADR-048)                 | Quien quiera | Mientras el proyecto se formaliza                    | No compran nada; liga externa; cubren servidores y cortesía         |

**Quien compra no paga nunca** por probarse ropa, armar looks, buscar, publicar, comentar ni
mandar mensajes. Es una red social: la gente entra a compartir y a ver; el dinero lo ponen las
tiendas, que son quienes venden gracias a esa gente. Lo gratis va con **cuotas** (por hora, día y
mes) y con el guardián de presupuesto, no con precio.

**Lo que tampoco se cobra a quien vende** (y por qué): publicar productos, el texto de la
publicación con IA y el kit de anuncios básico. Son baratos y traen oferta.

## 3. Saldo de la tienda y precio comunitario

Una sola idea para quien vende: un **saldo** en pesos (ADR-044, `Wallet`) del que se descuenta cada
uso que le trae ventas, al **precio comunitario** vigente. Sin planes ni suscripciones que venzan:
el saldo se gasta cuando trabaja.

### 3.1 Precio comunitario de «Ver cómo me veo»

El precio por prueba lo calcula el código (P2) con el **volumen de pruebas de toda la plataforma en
el mes anterior** (de cortesía y pagadas). Más gente = más volumen = mejor precio de los proveedores
y costos fijos repartidos entre más tiendas = precio más bajo para todas.

| Nivel | Pruebas al mes en toda la plataforma | Precio por prueba (IVA incluido) | Margen bruto sobre el costo [estimación] |
| ----- | ------------------------------------ | -------------------------------- | ---------------------------------------- |
| 1     | menos de 5,000                       | $3.50 MXN                        | ≈ 64 %                                   |
| 2     | 5,000 o más                          | $3.00 MXN                        | ≈ 58 %                                   |
| 3     | 50,000 o más                         | $2.50 MXN                        | ≈ 50 %                                   |
| 4     | 500,000 o más                        | $2.00 MXN                        | ≈ 37 %                                   |

- Costo de referencia: US$0.07 por imagen ≈ **$1.26 MXN** a 18 pesos por dólar (el tipo de cambio de
  `ai.budget.mxnPerUsd`). Con el modelo «lite» (US$0.034) el margen sube; con FASHN (US$0.075) baja
  un poco. La tabla se diseñó con el caro.
- **Piso de seguridad:** el precio nunca baja de **1.5 × el costo unitario** de la tabla de costos.
  Si un proveedor sube de precio y el piso queda por encima del nivel, se cobra el piso y el equipo
  recibe una decisión de riesgo ALTO para revisar la tabla. Nunca vendemos por debajo del costo.
- **Lo que ve la tienda:** «Precio comunitario · nivel 1 de 4 · $3.50 por prueba. Baja a $3.00
  cuando la comunidad pase de 5,000 pruebas al mes». Transparente y honesto.
- El nivel se recalcula el día 1 de cada mes en la operación diaria; el cambio de nivel dentro de
  esta tabla **no** es una decisión nueva (la tabla ya está aprobada). Cambiar la tabla sí lo es
  (riesgo ALTO, una persona).

### 3.2 Quién paga cada prueba (en este orden)

1. **La tienda del producto principal**, si tiene «Ver cómo me veo» activo, saldo y tope del día.
2. **Las pruebas de cortesía de esa tienda**: Estreno pone las primeras **10 pruebas de cada tienda**
   (`STORE_TRIAL_TRY_ONS`), para que el botón funcione desde el primer día y quien vende vea el
   resultado antes de poner saldo. Costo máximo del subsidio: 10 × $1.26 = **$12.60 MXN por tienda,
   una sola vez**; con 100 tiendas, $1,260. Sale del presupuesto de IA (`ai.budget`) y tiene su
   propio tope diario (`tryOnDailyCapUsd`, US$5 al día en el piloto ≈ 70 pruebas al día).
3. **Sin ninguna de las dos**, el botón sigue en la ficha: al tocarlo se explica que la tienda no
   tiene pruebas activas y se registra la **demanda** (`TRY_ON_REQUESTED`). Quien vende ve en su
   Studio «12 personas quisieron probarse tu ropa esta semana y no pudieron»: ese número vende el
   saldo mejor que cualquier anuncio.

Quien compra no aparece en esta lista. Las cuotas por persona (10 por hora, 30 por día) y la caché
por foto y prenda siguen: evitan el abuso, no cobran.

### 3.3 Recargas de saldo de la tienda

| Recarga    | Precio | Bono de saldo   | ≈ Pruebas al nivel 1 | ≈ Días destacado |
| ---------- | ------ | --------------- | -------------------- | ---------------- |
| Arranque   | $99    | —               | 28                   | 6                |
| Impulso    | $299   | +10 % ($29.90)  | 94                   | 21               |
| Tienda pro | $799   | +15 % ($119.85) | 262                  | 61               |

- Un solo saldo para todo: pruebas, destacados y, después, Impulsar y creativos. No son «paquetes»
  que venzan: son presupuesto. La tienda decide en qué se va (`/studio/saldo`, `/studio/campanas`).
- El bono se registra aparte (`PROMO` en el libro del saldo): no es ingreso.
- Hoy la recarga usa el `PaymentProvider` **simulado** (ADR-032): no se cobra nada y el saldo se marca
  como simulado. Con Mercado Pago/Stripe se acredita solo por webhook con firma verificada.
- Comisión del procesador ≈ 4 % + IVA por recarga [supuesto; confirmar al contratar]. Con la recarga
  mínima de $99 la comisión queda por debajo del 5 %.
- El saldo no es dinero: no se transfiere ni se retira en efectivo; se devuelve el saldo no usado si
  la tienda lo pide dentro de los 5 días hábiles siguientes a la recarga (términos, pendiente del
  abogado). IVA incluido en los precios; factura (CFDI) a quien la pida [pendiente del contador].

### 3.4 Producto destacado (la columna de publicidad)

- **Dónde aparece:** la columna derecha de escritorio (bloque «Patrocinado»), el primer lugar de
  «También te puede gustar» en las fichas de productos y una fila «Destacados» arriba de Comprar.
  Siempre con la etiqueta **Patrocinado** (Ley Federal de Protección al Consumidor, P12).
- **Precio:** **$15 MXN por día** por producto, de 3 a 30 días, por adelantado desde el saldo.
  Costo para nosotros: cero. Es el ingreso de margen puro que financia lo demás.
- **Reglas:** rotación justa entre los destacados vigentes (orden determinista por hora), nunca el
  producto propio a su dueño, nada oculto por moderación (sin devolución: la moderación es
  responsabilidad de quien publica). Quien vende ve visitas que llegaron desde un destacado.
- Referencia [estimación]: un anuncio en redes en México cuesta entre $30 y $80 MXN por cada mil
  vistas; a $15 por día, con las vistas del piloto, el destacado sale más barato por vista y no
  exige saber de campañas.

### 3.5 Vendedores: presupuesto, no planes

- **«Ver cómo me veo» activo:** interruptor con **tope diario** (mínimo $20 MXN). Cada prueba sobre
  sus productos se descuenta de su saldo a precio comunitario. Ve cuántas pruebas hubo, cuántas
  personas quisieron y no pudieron, y qué productos se prueban más.
- **Destacar:** días por producto, desde el mismo saldo.
- **Impulsar (P12):** presupuesto con tope diario y cobro por resultado. Se activa con tráfico.
- **Creativos con imagen y video (fase 3):** por generación, con precio comunitario propio y un tope
  interno de generaciones por producto.

## 4. Cómo se reinvierte cada peso

1. **Lo pagado cubre su propio costo por construcción:** una prueba pagada se cobra antes de generarse
   (se descuenta del saldo de forma atómica) y su costo real queda en `AIResponse.costMicrosUsd`.
2. **El excedente alimenta la cortesía y las funciones nuevas:** el presupuesto de IA del mes es
   semilla + un porcentaje de los ingresos del mes anterior (ADR-020, `ai.budget`). Recomendación al
   tener ingresos por saldo: subir `revenueSharePercent` de 20 a 50 (decisión del fundador, riesgo
   ALTO), porque el costo de lo pagado ya está cubierto y el margen puede ir entero a más pruebas de
   cortesía para tiendas nuevas, más creativos y las fases 3–5 de la IA.
3. **Cobertura:** el resumen del equipo (`/admin/ia`) muestra ingresos por IA ÷ costo de IA, separando
   lo subsidiado (`funding = PLATFORM`) de lo pagado (`SELLER_PAID`).
4. **Fondo de desarrollo (ADR-048):** del mismo reparto sale lo que paga la IA que construye la
   plataforma, en escalones conforme el mes lo cubra [estimación con precios de lista de 2026-09,
   verificar]: plan Pro ≈ US$20 al mes (≈ $360 MXN), Max 5× ≈ US$100 (≈ $1,800 MXN), Max 20× ≈
   US$200 (≈ $3,600 MXN). Con las cifras del piloto (§5) el excedente cubre el plan Pro desde el
   primer mes y el Max 5× cuando haya unas 60 tiendas activas. Orden de prioridad del dinero:
   servidores → pruebas de cortesía → fondo de desarrollo → funciones nuevas. La plataforma no paga
   la suscripción sola: aparta la cifra y el fundador la paga.

## 5. Cifras de referencia del piloto (100 tiendas, 2,000 compradores activos) [estimación]

| Concepto                                                      | Al mes                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Pruebas de cortesía (100 tiendas × 10, una sola vez)          | 1,000 → ≈ $1,260 MXN de costo el primer mes                               |
| Pruebas pagadas por tiendas (30 tiendas activas × 40 pruebas) | 1,200 pruebas → $4,200 MXN de ingreso; ≈ $1,510 MXN de costo              |
| Destacados (25 tiendas × 7 días)                              | $2,625 MXN de ingreso; costo cero                                         |
| Recargas del mes (55 tiendas; mezcla Arranque/Impulso)        | ≈ $9,000 MXN de caja (el ingreso se reconoce al usarse)                   |
| Texto (propuestas, kits, necesidades, looks)                  | ≈ $900 MXN                                                                |
| Infraestructura                                               | ≈ $700 MXN                                                                |
| **Ingresos − costos directos**                                | **≈ +$2,500 MXN el primer mes; ≈ +$3,700 después** (sin sueldos ni legal) |

Con estas cifras la IA se paga sola desde el piloto y el margen financia la cortesía de las tiendas
nuevas. El riesgo real no es el uso normal sino el **abuso**: por eso las cuotas por persona (hora,
día, mes), el tope diario del subsidio y el candado atómico del saldo existen antes que cualquier
precio.

## 6. Fuentes

1. OpenRouter, «Nano Banana 2 (Gemini 3.1 Flash Image Preview)»: salida de imagen a US$60 por millón
   de tokens (≈ US$0.067 por imagen de 1024×1024); Flash Lite Image ≈ US$0.034 por imagen.
   https://openrouter.ai/google/gemini-3.1-flash-image-preview · consultado 2026-09-29.
2. fal.ai, catálogo de Virtual Try-On 2026: FASHN v1.6 US$0.075 por generación; Kling Kolors v1.5
   US$0.07; image-apps-v2 virtual try-on US$0.04; IDM-VTON solo uso no comercial.
   https://fal.ai/learn/tools/best-virtual-try-on-apis-2026 · consultado 2026-09-29.
3. OpenRouter, precios de modelos de texto (Gemini 2.5 Flash Lite US$0.10/0.40, Qwen3.5-9B
   US$0.10/0.15 por millón de tokens). https://openrouter.ai/api/v1/models · consultado 2026-09-27.
4. Costo por mil impresiones de anuncios en redes sociales en México: rangos publicados por agencias
   en 2025–2026 (entre $30 y $80 MXN según formato y público) [estimación; confirmar con la primera
   campaña propia].
5. Infraestructura: `docs/plan-90-dias.md` §6.1 y ADR-040.
