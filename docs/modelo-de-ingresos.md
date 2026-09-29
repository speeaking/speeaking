# Modelo de ingresos: quién paga qué y cómo baja el precio con la comunidad

Fecha: 2026-09-29 · Estado: aprobado como base (ADR-044) · Dueño: dirección (IA-CEO propone, una
persona aprueba los precios)

> Regla del fundador: la plataforma se autofinancia, cada peso se reinvierte en la IA y en nuevas
> funciones, nada debe ser caro porque el costo se reparte entre todas las personas que la usan, y
> conforme entra más gente el precio baja sin que dejemos de ganar.

Todas las cifras son **[estimación]** con precios de lista consultados el 2026-09-29 (fuentes al
final). Se revisan al contratar y cada vez que cambie la tabla de costos del código
(`src/modules/ai/cost.ts`, `src/modules/billing/pricing.ts`).

## 1. Qué nos cuesta dinero (y qué no)

| Acción                                             | Costo unitario del proveedor      | Quién la dispara | Frecuencia esperada     |
| -------------------------------------------------- | --------------------------------- | ---------------- | ----------------------- |
| «¿Qué necesitas?» (interpretar una necesidad)      | ≈ US$0.0002–0.0005 por consulta   | Comprador        | Alta, barata            |
| «Crea mi look» / «Completa mi look» (combinar)     | US$0 (lo calcula el código)       | Comprador        | Alta, gratis            |
| Nombre y explicación de un look (texto)            | ≈ US$0.0003, se guarda y se reusa | Comprador        | Media, barata           |
| **«Pruébatelo»** (una imagen generada)             | **≈ US$0.034–0.075 por imagen**   | Comprador        | Media, **la cara**      |
| Texto de publicación del vendedor («Sube y vende») | ≈ US$0.001–0.01 por propuesta     | Vendedor         | Baja, barata            |
| Kit de anuncios (texto)                            | ≈ US$0.005                        | Vendedor         | Baja, barata            |
| Imágenes publicitarias (fase 3)                    | ≈ US$0.03–0.07 por imagen         | Vendedor         | Media, cara             |
| Video promocional (fase 3)                         | ≈ US$0.5–3 por clip               | Vendedor         | Baja, **muy cara**      |
| Fotos de las personas para «Pruébatelo»            | ≈ US$0.015 por GB al mes (R2)     | Comprador        | Despreciable (30 días)  |
| Infraestructura (Vercel + Neon + R2)               | ≈ US$30–40 al mes en el piloto    | Todos            | Fija, crece con tráfico |

**Conclusión:** solo dos cosas pueden desfinanciarnos: las **imágenes** (Pruébatelo y creativos) y el
**video**. Todo lo demás cuesta centavos y sirve para traer gente: se regala con cuotas.

## 2. Dónde cobramos sí o sí

| Cobro                                        | Quién paga | Cuándo                                          | Por qué es obligatorio                                         |
| -------------------------------------------- | ---------- | ----------------------------------------------- | -------------------------------------------------------------- |
| **Pruébatelo** después de las pruebas gratis | Comprador  | Desde la 4.ª prueba del mes                     | Cada imagen cuesta dinero real; sin tope nos vacían la caja    |
| **Pruebas patrocinadas**                     | Vendedor   | Cuando activa «pruebas gratis en mis productos» | Convierte más y el vendedor es quien gana con la venta         |
| **Impulsar** (P12, publicidad por resultado) | Vendedor   | Cuando haya tráfico (umbral de P12)             | Presupuesto, no planes: «si no vendes, no pagas»               |
| Imágenes y video para anuncios (fase 3)      | Vendedor   | Por generación, desde su saldo                  | Costo alto y beneficio directo para quien vende                |
| Comisión por venta                           | Vendedor   | Solo con pagos reales (hoy 0 %, ADR-024)        | Es la fuente principal cuando el dinero pase por la plataforma |

**Lo que NO se cobra** (y por qué): publicar productos, el texto de la publicación con IA, el kit de
anuncios básico, buscar, «¿Qué necesitas?», «Crea mi look» y «Completa mi look». Son baratos y traen
oferta y demanda. Van con **cuotas** (por hora, día y mes) y con el guardián de presupuesto, no con
precio.

## 3. Saldo y precio comunitario (cómo baja el precio con la gente)

Una sola idea para compradores y vendedores: un **saldo** en pesos (ADR-044, `Wallet`) del que se
descuenta cada uso que cuesta dinero, al **precio comunitario** vigente.

### 3.1 Precio comunitario de «Pruébatelo»

El precio por prueba lo calcula el código (P2) con el **volumen de pruebas de toda la plataforma en el
mes anterior** (gratis y pagadas). Más gente = más volumen = mejor precio de los proveedores y costos
fijos repartidos entre más personas = precio más bajo para todos.

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
- **Lo que ve la persona:** «Precio comunitario · nivel 1 de 4 · $3.50 por prueba. Baja a $3.00
  cuando la comunidad pase de 5,000 pruebas al mes». Transparente y honesto: el precio baja por
  la comunidad, no por un descuento inventado.
- El nivel se recalcula el día 1 de cada mes en la operación diaria; el cambio de nivel dentro de
  esta tabla **no** es una decisión nueva (la tabla ya está aprobada). Cambiar la tabla sí lo es
  (riesgo ALTO, una persona).

### 3.2 Pruebas gratis

- **3 pruebas al mes** por cuenta con perfil terminado. Costo máximo del subsidio: 3 × $1.26 =
  $3.78 MXN por persona activa al mes; con un uso realista (30 % de las cuentas usan sus 3) ≈ $1.15.
- El subsidio sale del presupuesto de IA (`ai.budget`) y tiene su propio **tope diario**
  (`tryOnDailyCapUsd`, US$5 al día en el piloto ≈ 70 pruebas gratis al día). Al agotarse, las gratis
  se pausan hasta el día siguiente («Hoy se acabaron las pruebas gratis; con saldo puedes seguir») y
  las **pagadas siguen**: las financia el saldo, no el subsidio.
- Las pruebas **patrocinadas** por un vendedor son gratis para quien compra y las paga el vendedor
  a precio comunitario. Se usan antes que las gratis de la persona (le cuidan sus 3 del mes).

### 3.3 Recargas de saldo

| Recarga | Bono de saldo  | Pruebas al nivel 1 |
| ------- | -------------- | ------------------ |
| $39     | —              | 11                 |
| $99     | +5 % ($4.95)   | 29                 |
| $199    | +10 % ($19.90) | 62                 |

- El bono se registra aparte (`PROMO` en el libro del saldo): no es ingreso.
- Hoy la recarga usa el `PaymentProvider` **simulado** (ADR-032): no se cobra nada y el saldo se marca
  como simulado. Con Mercado Pago/Stripe se acredita solo por webhook con firma verificada.
- Comisión del procesador ≈ 4 % + IVA por recarga [supuesto; confirmar al contratar]. Con la recarga
  mínima de $39 la comisión queda por debajo del 8 %.
- El saldo no es dinero: no se transfiere ni se retira en efectivo; se devuelve el saldo no usado si
  la persona lo pide dentro de los 5 días hábiles siguientes a la recarga (términos, pendiente del
  abogado). IVA incluido en los precios; factura (CFDI) a quien la pida [pendiente del contador].

### 3.4 Vendedores: presupuesto, no planes

- **Pruebas patrocinadas:** el vendedor activa «pruebas gratis en mis productos» con un **tope diario**
  (mínimo $20 MXN). Cada prueba sobre sus productos se descuenta de su saldo a precio comunitario. Ve
  cuántas pruebas hubo y cuántas terminaron en carrito o compra.
- **Impulsar (P12):** presupuesto con tope diario y cobro por resultado, sin planes de IA. Se activa
  con tráfico.
- **Creativos con imagen y video (fase 3):** por generación, con precio comunitario propio y un tope
  interno de generaciones por producto (nunca video para todos los productos «por si acaso»).

Nada de «compras 50 generaciones»: el vendedor piensa «le doy presupuesto a la plataforma y ella
encuentra compradores».

## 4. Cómo se reinvierte cada peso

1. **Lo pagado cubre su propio costo por construcción:** una prueba pagada se cobra antes de generarse
   (se descuenta del saldo de forma atómica) y su costo real queda en `AIResponse.costMicrosUsd`.
2. **El excedente alimenta el subsidio y las funciones nuevas:** el presupuesto de IA del mes es
   semilla + un porcentaje de los ingresos del mes anterior (ADR-020, `ai.budget`). Recomendación al
   tener ingresos por saldo: subir `revenueSharePercent` de 20 a 50 (decisión del fundador, riesgo
   ALTO), porque el costo de lo pagado ya está cubierto y el margen puede ir entero a más pruebas
   gratis, más creativos y las fases 3–5 de la IA.
3. **Cobertura:** el resumen del equipo (`/admin/ia`) muestra ingresos por IA ÷ costo de IA, separando
   lo subsidiado (`funding = PLATFORM`) de lo pagado (`USER_PAID`, `SELLER_PAID`).

## 5. Cifras de referencia del piloto (100 vendedores, 2,000 compradores activos) [estimación]

| Concepto                                                    | Al mes                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Pruebas gratis usadas (2,000 × 30 % × 3)                    | 1,800 → ≈ $2,270 MXN de costo                                                 |
| Pruebas pagadas (10 % de compradores recargan $39)          | 200 recargas → $7,800 MXN de ingreso; ≈ 2,200 pruebas → ≈ $2,770 MXN de costo |
| Pruebas patrocinadas (20 vendedores × $20 al día × 15 días) | $6,000 MXN de ingreso; ≈ 1,700 pruebas → ≈ $2,150 MXN de costo                |
| Texto (propuestas, kits, necesidades, looks)                | ≈ $900 MXN                                                                    |
| Infraestructura                                             | ≈ $700 MXN                                                                    |
| **Ingresos − costos directos**                              | **≈ +$5,000 MXN** (sin sueldos ni legal)                                      |

Con estas cifras la IA se paga sola desde el piloto y el margen financia las pruebas gratis. El riesgo
real no es el uso normal sino el **abuso**: por eso las cuotas por persona (hora, día, mes), el tope
diario del subsidio y el candado atómico del saldo existen antes que cualquier precio.

## 6. Fuentes

1. OpenRouter, «Nano Banana 2 (Gemini 3.1 Flash Image Preview)»: salida de imagen a US$60 por millón
   de tokens (≈ US$0.067 por imagen de 1024×1024); Flash Lite Image ≈ US$0.034 por imagen.
   https://openrouter.ai/google/gemini-3.1-flash-image-preview · consultado 2026-09-29.
2. fal.ai, catálogo de Virtual Try-On 2026: FASHN v1.6 US$0.075 por generación; Kling Kolors v1.5
   US$0.07; image-apps-v2 virtual try-on US$0.04; IDM-VTON solo uso no comercial.
   https://fal.ai/learn/tools/best-virtual-try-on-apis-2026 · consultado 2026-09-29.
3. OpenRouter, precios de modelos de texto (Gemini 2.5 Flash Lite US$0.10/0.40, Qwen3.5-9B
   US$0.10/0.15 por millón de tokens). https://openrouter.ai/api/v1/models · consultado 2026-09-27.
4. Infraestructura: `docs/plan-90-dias.md` §6.1 y ADR-040.
