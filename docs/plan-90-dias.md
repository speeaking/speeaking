# Plan de 90 días: operar sola, atraer gente y cerrar los huecos de seguridad

Fecha: 2026-09-26 · Autoría: producto y crecimiento. Integra 4 informes (autonomía, crecimiento, mejoras y
SEO), la revisión escéptica que los corrigió (49 puntos) y la evidencia de la auditoría de seguridad
guardada en `.data/security`.
Estado: **propuesta**. Nada de este documento cambia código ni decisiones aceptadas hasta que el
fundador lo apruebe. Cada cambio se hará por fases y pasará `pnpm check`, `pnpm build` y
`pnpm test:e2e`.

**Cómo leerlo**

- **[n]** es una fuente consultada; la lista está en la sección 9. Si la fuente es secundaria o no se
  volvió a verificar, se dice ahí.
- **[supuesto]** es un número mío para planear. Se reemplaza con datos reales en cuanto existan.
- **[estimación]** o **[cálculo]** es aritmética explícita a partir de fuentes o supuestos.
- **Tipo de cambio de trabajo:** 18 MXN por dólar, el valor por defecto de `ai.budget`. Hay que comparar
  con el FIX de Banxico al pagar.
- **Calendario:** el día 1 es el lunes 28 de septiembre de 2026, el día 30 cae el 27 de octubre, el 60 el
  26 de noviembre y el 90 el 26 de diciembre. «Semana 1» va del 28 de septiembre al 4 de octubre.

---

## 1. Resumen para el fundador

1. **Dónde estamos.** El producto funciona en tu PC: 653 pruebas unitarias y 79 E2E en verde. Pero no
   tiene historial (0 commits), servidor, respaldos, correo ni pagos reales, y la IA todavía es simulada.
2. **Seguridad.** Lo básico está bien: no hay inyección SQL, no se reprodujo XSS, nadie puede ver pedidos
   ajenos y las cookies están protegidas. Pero hay **6 bloqueos antes de publicar**:
   - la pasarela simulada aprobaría pagos en producción;
   - el inicio de sesión desde la pantalla no tiene límite de intentos;
   - hay una redirección abierta después de iniciar sesión;
   - se puede registrar una cuenta por HTTP sin aceptar términos;
   - el gasto de IA no tiene control por persona;
   - la configuración de producción acepta `http://localhost`.
3. **«Operar sola» todavía no es posible ni conveniente.** Faltan tareas programadas, métricas honestas y
   moderación. Meta a 90 días: que la operación te pida **≤ 5 horas a la semana** en aprobaciones, con el
   IA CEO en modo observador (propone y tú apruebas) hasta que haya tráfico suficiente.
4. **Cómo atraer gente.** Una zona y tres nichos: comida casera, moda y belleza de emprendedoras, y
   mascotas. Reclutamos en persona y 1 a 1. Los compradores llegan sobre todo por el link que cada
   vendedor manda por WhatsApp.
5. **Cobro en el piloto.** El comprador paga directo al vendedor (transferencia o contra entrega),
   VendeIA no toca el dinero y la comisión es 0 %. Los pagos reales llegan después del visto bueno
   fiscal; no son meta de estos 90 días.
6. **Metas del escenario base [supuesto]:**
   - vendedores activados: 15 al día 30, 55–60 al día 60 y 100 al día 90;
   - ≈ 2,200 personas registradas al día 90;
   - ≥ 40 % de los vendedores con al menos una venta confirmada en 30 días.
7. **Costo mínimo de 90 días [estimación]:** ≈ US$590–660 (≈ $10,600–11,900 MXN) de infraestructura
   e IA con topes. Aparte van la marca, el asesor legal y fiscal y el dominio (sin cotizar), y el
   crecimiento: $0, $30,000 o $150,000 MXN según el escenario.
8. **Esta semana:**
   - commit y respaldo fuera de la PC;
   - borrar los datos y contraseñas de prueba que dejaron las auditorías;
   - pedir 3 cotizaciones a despachos (entidad, privacidad y fiscal);
   - elegir zona y nichos;
   - 10 entrevistas con vendedores.
9. **Fases.**
   - Días 1–30: base segura y 15 vendedores fundadores de tu red.
   - Días 31–60: piloto local hasta ≈ 60 vendedores.
   - Días 61–90: llegar a 100 y decidir con datos.
10. **Necesito 17 decisiones tuyas** (sección 8). Las 6 urgentes: cuánto tiempo puedes dedicar, zona y
    nichos, modo de cobro, presupuesto, tope de gasto y entidad legal.

---

## 2. Qué falta para que la plataforma opere sola

### 2.1 Hoy frente a la meta del día 90

| Área                | Hoy (evidencia)                                                                                                                     | Meta al día 90                                                                                                 | Cómo se mide                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Código e historial  | 0 commits, sin CI; todo en una PC con Windows                                                                                       | Repositorio privado, CI (revisión automática en cada cambio) con `check`, `build` y E2E, reversión con un clic | 100 % de los cambios pasan CI                              |
| Hosting             | Solo local; `STORAGE_DRIVER` acepta únicamente `local` (`src/server/env-schema.ts`)                                                 | Vercel Pro + Neon (con _pooler_) + R2; staging protegido con contraseña                                        | Monitor externo de disponibilidad; alerta si cae           |
| Respaldos           | No hay                                                                                                                              | Respaldo gestionado de Neon + `pg_dump` semanal cifrado + simulacro de restauración mensual                    | Última restauración verificada hace < 30 días              |
| Tareas programadas  | `expireStaleCheckouts` solo corre cuando alguien abre carrito, checkout o pedidos, en lotes de 50                                   | Cron cada 5 min y tareas diarias (métricas, retención, limpiezas), registradas en `JobRun`                     | 0 tareas atrasadas sin alerta                              |
| Métricas            | Cuentan las vistas del dueño y de robots; cada carga registra 10 impresiones aunque solo se vea 1; no hay clics ni «No me interesa» | Impresiones visibles, dueño y robots excluidos, visitantes únicos, eventos firmados por el servidor            | Vistas propias = 0; % de tráfico de robots excluido        |
| Moderación          | Solo se puede moderar tocando la BD                                                                                                 | Reportar, cola, ocultar, rol de equipo con 2FA, apelación                                                      | % de casos resueltos en ≤ 24 h hábiles                     |
| IA                  | Simulada. Con un modelo real, P2 se rompe (H2). El guardián de presupuesto es global                                                | Claude detrás de `AIProvider`, evaluación de 60 casos, cuotas por persona, costo completo                      | Costo por vendedor; 0 cifras de dinero generadas por la IA |
| Motor de automejora | Tablas sin código; `PlatformDecision` tiene 0 filas                                                                                 | Modo observador: analista diario, Centro de decisiones y `applySettingChange()`                                | Tiempo de decisión; % de propuestas aprobadas              |
| Comercio            | Pago simulado; reserva de 30 min                                                                                                    | Cobro directo del vendedor (B1) con el estado «Esperando pago al vendedor» y doble confirmación                | % de ventas con doble confirmación                         |
| Correo              | Solo en consola; no se puede recuperar la contraseña                                                                                | Resend: verificación, recuperar contraseña, avisos de pedido                                                   | Correos entregados; recuperaciones exitosas                |
| Contenido           | 48 piezas, solo en desarrollo; en producción la semilla las omite (`prisma/seed.ts`, l. 369)                                        | Contenido publicado en producción con su fecha real, prioridad en los 3 nichos del piloto                      | % de visitantes por link que ven ≥ 5 piezas                |
| Soporte             | No existe                                                                                                                           | Correo de soporte, botón «Tengo un problema» en cada pedido y bitácora                                         | Casos por cada 100 pedidos; respuesta ≤ 24 h hábiles       |
| Legal y fiscal      | Borradores sin la identidad ni el domicilio del responsable                                                                         | Entidad decidida, aviso de privacidad completo, términos del vendedor, contratos de encargado (DPA)            | Lista legal al 100 % antes de abrir a la zona              |
| Observabilidad      | `console.error`                                                                                                                     | Sentry, monitor de disponibilidad y alertas de negocio                                                         | Alertas probadas con un simulacro                          |

### 2.2 Problemas en el código que bloquean la autonomía

| #   | Problema                                                                                                                                     | Evidencia                                                                                                                                           | Corrección                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1  | Todo vive en una PC sin commits                                                                                                              | Memoria del proyecto; `.data/postgres`                                                                                                              | Commit inicial, repositorio privado y respaldo **esta semana**                                                                                   |
| H2  | P2 se rompe con un modelo real: la IA devuelve `suggestedDailyBudgetCents` y ese número alimenta el punto de equilibrio                      | `src/modules/ai/service.ts` (`proposalEconomics`), `sale-proposal.ts`                                                                               | El presupuesto y el rango de prueba los calcula `catalog/pricing`; la IA solo redacta el porqué                                                  |
| H3  | El costo privado del vendedor se mandaría al proveedor de IA                                                                                 | `SaleProposalRequest.costCents`                                                                                                                     | No enviar el costo; como mucho, si el margen es positivo o negativo                                                                              |
| H4  | El guardián de IA es un tope global de US$50: una sola persona o un bot puede agotarlo para todos (ver 4.1, S4)                              | `DEFAULT_AI_BUDGET` en `src/modules/ai/budget.ts`; suma sin filtrar por persona en `service.ts`                                                     | Cuotas por persona, disyuntor diario global y prioridad a los flujos de venta (sección 6.2)                                                      |
| H5  | El guardián cuenta como ingreso cualquier asiento positivo del libro                                                                         | `amountCents: { gt: 0 }` sin filtrar `kind` (`service.ts`)                                                                                          | Gastos con signo negativo, filtro por tipo de ingreso y una prueba                                                                               |
| H6  | Costo de IA incompleto: una salida inválida se cobra pero no se registra, y un modelo sin precio lanza error **después** de pagar la llamada | `service.ts` (rama `INVALID_OUTPUT`) y `cost.ts`. Simulación en `.data/security/ai-unmetered-A`: se facturaron US$22.98 y el guardián registró US$0 | Registrar tokens y costo en todo resultado, campos de caché, precios con fecha y una prueba de que todo modelo configurado tiene precio          |
| H7  | La comisión del procesador se subestima (3.5 % fijo)                                                                                         | `estimatedPaymentFeeBps: 350` en `src/modules/commerce/fees.ts`                                                                                     | `paymentFeeCents(monto, método)` = % + cuota fija + IVA, por método; transferencia y contra entrega = 0                                          |
| H8  | Los checkouts vencidos solo se liberan cuando alguien visita ciertas páginas                                                                 | `checkout.ts`                                                                                                                                       | Cron cada 5 min que procese todos los lotes                                                                                                      |
| H9  | No hay un camino controlado para cambiar ajustes                                                                                             | Nadie escribe en `PlatformSetting` ni en `PlatformDecision`                                                                                         | Un único `applySettingChange()` que exija la decisión, clasifique el riesgo con código y guarde el valor anterior                                |
| H10 | Almacenamiento local, incompatible con hosting sin disco persistente                                                                         | `local-storage.ts`                                                                                                                                  | Adaptador R2 detrás de `StorageProvider`                                                                                                         |
| G1  | La pasarela simulada se usaría en producción                                                                                                 | `src/server/providers/payments/index.ts` siempre devuelve `MockPaymentProvider`                                                                     | Que el arranque falle en producción con el simulador; solo se permite con `DEMO_MODE`, aviso permanente y staging con contraseña; más una prueba |
| G2  | La semilla podría meter vendedores «demo» en producción                                                                                      | `prisma/seed.ts` decide solo con `NODE_ENV`                                                                                                         | Exigir `SEED_DEMO=1` y rechazar si la BD no está en localhost                                                                                    |
| G3  | En producción, las 12 comunidades arrancarían vacías                                                                                         | `seed.ts`, l. 369                                                                                                                                   | Script de publicación editorial con fecha real (decisión 11)                                                                                     |
| G4  | Producción acepta `APP_URL` vacío (usa `http://localhost:3000`) o con `http`                                                                 | `env-schema.ts`, l. 9; `.data/security/verify-A-env-prod`                                                                                           | Exigir `https` y un dominio que no sea localhost en producción, y `sslmode` en la BD                                                             |

### 2.3 Arquitectura de autonomía por nivel de riesgo

**Regla (extiende P2 al propio motor):**

- la IA **propone**;
- el código **mide, clasifica el riesgo, valida límites, aplica y revierte**;
- una persona **aprueba** lo de riesgo alto;
- la IA nunca decide su propio nivel de riesgo.

```
 Programador (Vercel Cron → /api/cron/*, con secreto) ──► JobRun (idempotente; alerta si no corre)
      │
 Eventos firmados · pedidos · IA · libro ──► DailyMetric (código) ──► Analista IA (lotes, solo agregados)
                                                                          │ propuestas (validadas con Zod)
                              Clasificador de riesgo + límites + paso máximo + enfriamiento (código)
                      ┌─────────────────────────┬───────────────────────────┬───────────────────────────┐
                    BAJO                       MEDIO                        ALTO
        Aplica con reversión automática   Experimento pequeño;        Centro de decisiones (tú, con 2FA):
        (solo tras el umbral de tráfico)  adoptar requiere tu OK      aprobar · rechazar · revertir
                      └──────────────────► applySettingChange() ◄───────────────────────────────────┘
                                             │ PlatformSetting v+1 · PlatformDecision APPLIED
                           Monitor de salvaguardas (cada hora) → si algo empeora: revertir + REVERTED
                           Interruptor general: platform.autonomy = off | observe | low-risk
```

| Componente              | Qué hace                                                                                                   | Datos nuevos                                                                                                     | Cuándo                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Programador             | Tareas periódicas idempotentes                                                                             | `JobRun`                                                                                                         | Días 1–30                               |
| Métricas                | Agregados diarios, métrica norte y salud                                                                   | `DailyMetric`                                                                                                    | Días 1–30 (mínimo) y 31–60 (tablero)    |
| IA CEO observador       | Analiza y propone; no aplica nada                                                                          | `PlatformDecision` + `approvedByUserId`, `evaluateAfter`, `guardrails`, `revertReason`; `PlatformSettingVersion` | Días 45–75                              |
| Experimentos            | Asignación estable **por persona**, exposición y análisis por código                                       | `Experiment`, evento `EXPERIMENT_EXPOSURE`                                                                       | Solo al cumplir el umbral (2.4)         |
| Moderación              | Filtro previo, reportes, cola y apelación                                                                  | `Report`, `ModerationCase`, `User.role`                                                                          | Días 1–30 (mínima)                      |
| Autopiloto del vendedor | Seguimiento, kit por canal y resumen semanal, dentro de los límites del vendedor; **nunca toca el precio** | `ShareLink`, `Notification`, `AutopilotAction`                                                                   | Mínimo en días 45–90                    |
| Agente de ventas        | Responde solo con datos P4                                                                                 | `Conversation`, `Message`                                                                                        | Después del día 90: necesita mensajería |

**Seguridad de la propia autonomía** (sin esto, un bot podría dirigir al IA CEO):

- **Eventos firmados.** El servidor firma cada pieza servida y solo acepta impresiones y clics de piezas
  servidas en esa sesión, con límite por sesión y por IP. El tráfico anómalo se excluye de `DailyMetric`.
- **Solo agregados para el analista.** El analista recibe números agregados. Si algún día recibe texto
  de personas (búsquedas o publicaciones), va delimitado y se trata como dato, nunca como instrucción.
  Su salida solo puede ser una propuesta validada con Zod; nunca ejecuta nada.
- **Cambios de código** llegan como pull request con pruebas y los fusiona una persona.

### 2.4 Qué decide la IA sola y qué apruebas tú

**Durante el piloto, el IA CEO solo propone.** Pasa a «riesgo bajo» (`platform.autonomy = low-risk`)
únicamente cuando se cumpla el umbral de tráfico de abajo y tú lo apruebes.

| Parámetro                                                                                                                        | Límite en el código                 | Paso máximo | Riesgo    | Autonomía (tras el umbral)                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feed.policy.recencyHalfLifeHours`                                                                                               | 6–168                               | ±20 %       | Bajo      | Automática con reversión                                                                                                                            |
| `feed.policy.explorationShare`                                                                                                   | 0–0.5                               | ±0.05       | Bajo      | Automática con reversión                                                                                                                            |
| `feed.policy.authorWindow`                                                                                                       | 2–10                                | ±1          | Bajo      | Automática con reversión                                                                                                                            |
| `commerceSlotEvery` y `minGapBetweenCommerce`, **en cualquier dirección**                                                        | 3–12 / 2–12                         | ±1          | **Medio** | Experimento al 10 %; adoptar requiere tu aprobación. Mostrar menos comercio también reduce la exposición de los vendedores, que es la métrica norte |
| Horario de notificaciones                                                                                                        | 08:00–21:00 CDMX                    | ±1 h        | Bajo      | Automática                                                                                                                                          |
| `ai.routing` (modelo por tarea)                                                                                                  | Solo modelos que pasaron evaluación | —           | Medio     | Experimento y aprobación                                                                                                                            |
| Cuotas de IA por persona                                                                                                         | 1–500                               | ±5          | Medio     | Experimento y aprobación                                                                                                                            |
| Semilla y tope de `ai.budget`                                                                                                    | 0–10,000 / 0–100,000                | —           | Alto      | Solo propone                                                                                                                                        |
| `commerce.fees.platformFeeBps`                                                                                                   | 0–2,000                             | —           | Alto      | Solo propone                                                                                                                                        |
| Onboarding, comunidades nuevas, textos                                                                                           | —                                   | —           | Medio     | Muestra pequeña y muestreo humano                                                                                                                   |
| Precios, gasto, mensajes masivos, políticas, borrar datos, suspender cuentas, código a producción, respuestas legales o fiscales | —                                   | —           | Alto      | **Nunca automático** (ADR-019)                                                                                                                      |

**Salvaguardas en ambos sentidos [propuesta; calibrar con la línea base].** Se revierte automáticamente si,
tras la exposición mínima, pasa cualquiera de estas cosas:

- los reportes suben más de 25 % relativo;
- «No me interesa» sube más de 15 %;
- el contenido comercial visto supera el 30 %;
- la conversión baja más de 10 %;
- los errores 5xx superan el 1 %;
- **las visitas a producto por vendedor activo caen más de X %** (tú fijas X; propongo 15 % [supuesto]).

Además hay congelamiento en fechas pico: nada cambia solo durante el Buen Fin (13–17 de noviembre [38])
ni del 12 al 25 de diciembre.

**Umbral de tráfico, corregido.** Se mide en **impresiones visibles** (T5), no en piezas servidas.

- **Muestra base [cálculo].** Con un CTR base de 2.0 % [supuesto], detectar un alza a 2.4 % con 80 % de
  potencia y α = 0.05 requiere ≈ 21,100 impresiones por variante, _si fueran independientes_.
- **Corrección por persona.** Las impresiones de una misma persona no son independientes. Con ≈ 20
  impresiones por persona y una correlación dentro de la persona de 0.05 [supuesto], el efecto de diseño
  es 1 + 19 × 0.05 = 1.95. Eso da ≈ **41,000 impresiones visibles por variante** [cálculo].
- **Diseño.** Las variantes se asignan por persona y el CTR se analiza por persona o con errores
  robustos por clúster.
- **Umbral.** El IA CEO pasa a «riesgo bajo» cuando se puedan juntar 2 × 41,000 impresiones visibles en
  ≤ 14 días (≈ 5,900 al día) durante 2 semanas seguidas, además de 7 días de línea base. Si la
  correlación medida es otra, se recalcula.
- **Grupo sin cambios (5 %).** Se pospone hasta que ese 5 % alcance el tamaño de muestra por sí solo, es
  decir, ≈ 820,000 impresiones visibles en 14 días [cálculo: 41,000 ÷ 0.05]. En el piloto no aplica:
  con ~100 personas no se mide nada.

**Tu rutina semanal (meta ≤ 5 h de operación) [propuesta]:**

| Actividad                                                                     | Tiempo |
| ----------------------------------------------------------------------------- | ------ |
| Lunes: reporte semanal (qué cambió, por qué, impacto, costo de IA, cobertura) | 30 min |
| Cola del Centro de decisiones                                                 | 1 h    |
| Cola de moderación y soporte                                                  | 2 h    |
| Muestreo de contenido: 100 % en las semanas 1–6 y 30 % después                | 1.5 h  |

Esto es solo la operación. El reclutamiento es aparte (3.7).

---

## 3. Cómo atraer gente

### 3.1 La oferta «Vendedor fundador» (honesta)

**Qué incluye:**

- gratis durante el piloto y 0 % de comisión (ADR-024);
- «Vende con IA» con cuota mensual;
- acompañamiento de 15 minutos para publicar el primer producto;
- kit para compartir por WhatsApp;
- insignia real de «Vendedor fundador».

**Qué prometemos:**

> «Tu producto queda bien publicado en 10 minutos, con un link que se ve profesional y **tu margen por
> pieza calculado con tus números**.»

El margen **no incluye envío, empaque ni tu tiempo**, y la app lo dice junto a la cifra (P2: toda
estimación con sus supuestos). `unitEconomics` hoy solo resta costo y comisiones.

**Qué no prometemos:** ventas.

**Qué pedimos al vendedor:**

- 3 productos o más con los datos de entrega completos;
- compartir su link al menos una vez por semana;
- llamadas de 15 minutos en los días 14 y 30;
- ser mayor de 18 años.

**Qué no pedimos:** sus contactos.

### 3.2 Dónde: una zona y tres nichos

- **Zona.** 2–3 alcaldías o municipios contiguos donde tú puedas estar en persona (decisión 2). La
  entrega local tiene que ser viable: el 90 % de los compradores en línea prefiere entrega a domicilio,
  según AMVO [5] (fuente secundaria).
- **Nichos:**

  | Nicho                           | Por qué                                                                     | Riesgo que hay que cuidar                                                 |
  | ------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
  | Comida casera y repostería      | Hay muchos vendedores, luce en foto, se entrega local y se vuelve a comprar | Perecedero y normativa sanitaria (preguntar al abogado)                   |
  | Moda y belleza de emprendedoras | Visual; ya venden por WhatsApp                                              | En moda, el 28 % ha devuelto algo (AMVO [5]); autenticidad declarada (P4) |
  | Mascotas                        | Consumibles y contenido fácil y honesto                                     | Bajo                                                                      |

  Las otras 9 comunidades se quedan con su contenido curado, sin contenido nuevo de IA durante el
  piloto (3.4).

**Contexto de mercado (con sus límites):**

| Dato                                                                                                                                                                                                                                                              | Fuente                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 104.9 M de personas de 6 años o más usaron internet en 2025 (86.1 %); 84.6 % usó celular y 38.1 % computadora; el 79.3 % de quienes usan celular solo tiene prepago, así que cada KB cuesta                                                                       | INEGI, comunicado 32/26 [1] |
| Presencia activa de WhatsApp: 91 %. Es la cifra más reciente y es la que se usa en todos los documentos                                                                                                                                                           | AIMX 2026 [4], secundaria   |
| **Compradores en línea.** Base conservadora ≈ 39 M [cálculo: 37.3 % × 104.9 M]. El 37.3 % viene de The CIU [2]; no lo encontré en el texto del comunicado del INEGI, así que hay que confirmarlo en los tabulados de la ENDUTIH. **Techo:** 77.2 M según AMVO [5] | [1][2][5]                   |
| TikTok Shop México: de febrero a septiembre de 2025, sus vendedores y creadores con ventas se multiplicaron por 23. No le ganamos en alcance; ganamos en publicación guiada, margen claro y comunidad local                                                       | TikTok [8]                  |

**Dolores a validar, no a presumir.** La encuesta de GoDaddy/Advanis [6] (54 % no llega al público
correcto, 52 % no convierte seguidores, 44 % batalla con el contenido) mezcla 11 países y no aísla
México.

- En las 30 entrevistas de descubrimiento se mide qué % menciona cada dolor **sin sugerírselo**.
- Si un dolor aparece en menos del 20 % [supuesto], sale del discurso.

### 3.3 Los primeros 100 vendedores

| Tipo                                    | Dónde está                             | Cómo llegarle                                                      | Conversión esperada [supuesto] |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| Vende por WhatsApp (estados y catálogo) | Tu red, grupos de colonia y de escuela | Tu red personal y referidos                                        | 20–30 %                        |
| Puesto de bazar, tianguis o feria       | Bazares de fin de semana               | En persona, acompañamiento en el momento                           | ≈ 25 %                         |
| Tienda de barrio con Instagram          | Instagram, Google Maps, la calle       | Visita o mensaje directo 1 a 1, **una sola vez**                   | 5–10 %                         |
| Grupos «Ventas [colonia]»               | Facebook                               | Solo con permiso del administrador; **nunca** fingir ser comprador | 5–10 %                         |
| Estudiante que emprende (18+)           | Ferias de emprendimiento               | Club o incubadora                                                  | Medir                          |

**Acompañamiento de 15 minutos.** El vendedor hace todo en **su** teléfono: crea su cuenta, acepta los
términos y la declaración de mayoría de edad, toma una foto con luz natural, escribe «¿Qué quieres
vender hoy?» con su costo real, revisa la propuesta, **elige él mismo** entrega, garantía, devoluciones
y forma de pago (Tr0), publica y comparte en su estado de WhatsApp.

- Nunca usamos su contraseña ni publicamos por él.
- Meta: primer producto publicado en < 10 min (`mvp-0.1.md`).

**Red personal etiquetada.** Los vendedores y compradores que lleguen con tu código de referido se
marcan. Sus ventas se reportan aparte y **no cuentan** para el criterio de éxito del 40 % (3.6).

### 3.4 Los primeros miles de compradores

**Motor principal: el link del vendedor.** Cada producto trae un kit:

- 3 textos para WhatsApp, redactados por la IA y etiquetados;
- una imagen vertical con precio y ciudad;
- un link con `?r=<código aleatorio>` y el canal.

Quien abre el link ve el producto, la comunidad y «Unirme a [nicho]».

**Escenario de registros [supuesto].** Calculado para las **8 semanas del piloto abierto (semanas 5–12)**.
Las semanas 1–4 aportan pocas decenas porque el sitio abre por invitación en la semana 3.

|                                               | Conservador | Base        | Optimista   |
| --------------------------------------------- | ----------- | ----------- | ----------- |
| Vendedores activos en promedio                | 40          | 60          | 80          |
| Veces que comparte cada uno por semana        | 2           | 3           | 4           |
| Visitas por cada compartido                   | 10          | 20          | 30          |
| Visitas que se registran                      | 3 %         | 5 %         | 8 %         |
| Registros por links en 8 semanas              | ≈ 190       | ≈ 1,440     | ≈ 6,140     |
| Otros canales (creadores, eventos, contenido) | 300         | 800         | 1,500       |
| **Total acumulado al día 90**                 | **≈ 500**   | **≈ 2,200** | **≈ 7,600** |

Esto reemplaza las dos metas distintas de los informes: **2,200 es la meta del día 90**, no de la
semana 8. Llegar a 5,000 requiere el escenario optimista o el presupuesto de $50k.

**Comunidades con contenido desde el primer día** (antes del día 10; decisión 11):

- **Qué se publica.** Las piezas curadas se publican en producción con su **fecha real**, sin maquillar
  fechas, y se suman ≈ 20 piezas por nicho del piloto [supuesto], revisadas al 100 %.
- **Calendario semanal por nicho:**
  - lunes: tip o receta original;
  - miércoles: debate;
  - viernes: «Hecho en [zona]», con 3 vendedores fundadores elegidos con un criterio publicado
    («no pagaron por aparecer»);
  - domingo: «Lo nuevo de la semana».
- **Límite al contenido asistido por IA.** Como mucho 3 piezas por semana por nicho del piloto
  [supuesto], con etiqueta. Nada nuevo en las otras 9 comunidades. Una pieza diaria por comunidad, aun
  etiquetada, fingiría una actividad que no existe.
- **Métrica de honestidad.** «% de impresiones de contenido de personas reales». Meta: subir cada
  semana y ≥ 30 % al día 90 [supuesto].

**Otros canales:**

- **Creadores nano locales**, 2–4 en total (semanas 6–8).
  - Referencia de precio: $500–3,000 MXN por colaboración, según una agencia sin metodología publicada
    [9].
  - Reseña honesta con #Publicidad visible, conforme a la guía de PROFECO [35].
  - Tarifa fija. **Nunca** pago por registro.
- **Bazar** con una «estación Vende con IA» y un QR por puesto (`?ref=qr&evento=bazar-nov`), en la semana
  6, antes del Buen Fin.
- **Grupos de WhatsApp y Facebook** solo donde ya estás, con tu nombre, con permiso del administrador y
  como mucho 1 publicación por semana.
- **Cuentas propias de Instagram y TikTok:** 3 videos por semana con vendedores reales que dieron
  permiso. Cero seguidores comprados.
- **Referidos:**
  - vendedor invita a vendedor: más cuota de IA y una sesión de fotos, con un máximo de 5 invitaciones;
  - persona invita a persona: se muestra un conteo real, sin dinero en el piloto;
  - **nunca**: importar contactos, invitaciones marcadas por defecto, rachas o cuentas regresivas falsas.

### 3.5 Guiones (corregidos)

**En persona, en un bazar (30 s):**

> «Hola, ¿qué tal la venta hoy? Soy Issac. Estoy armando una app en [zona] donde la gente entra a ver
> contenido de comida, mascotas o moda y ahí descubre vendedores de su zona. Con una foto y lo que te
> costó, una IA te arma la publicación y te muestra **tu margen por pieza con tus números**. Busco 100
> vendedores fundadores: gratis y sin comisión durante el piloto. No te prometo ventas, pero sí que tu
> producto quede bien publicado. ¿Lo hacemos juntos en 10 minutos?»

**Mensaje directo 1 a 1 (una sola vez):**

> «Hola [nombre], vi tus [pasteles] y se ven increíbles. Soy Issac, de [marca], una red en [ciudad] para
> descubrir comida casera de la zona. Invito a 100 vendedores fundadores: publicar es gratis, sin
> comisión en el piloto, y una IA te ayuda a armar la publicación y a ver tu margen por pieza. Si te
> interesa, te acompaño 10 minutos por videollamada. Si no, cero problema y no te vuelvo a escribir.»

**Al administrador de un grupo:**

> «Hola [nombre], soy Issac y soy miembro del grupo. Estoy lanzando [marca] en [zona], una app gratuita
> para que los emprendedores de aquí publiquen con ayuda de IA. Antes de publicar nada, ¿me das permiso
> para un solo post explicando el piloto? Si prefieres que no, lo respeto.»

**Seguimiento** (solo con consentimiento y con cifras reales):

- **Día 1:** el texto listo para compartir.
- **Día 3:** «Tu producto tuvo N visitas de otras personas». Si fueron 0, se dice así y se da una acción
  concreta.
- **Día 7:** llamada.
- **Días 14 y 30:** entrevista corta.

**Correos de marketing** (solo a quien aceptó, con casilla sin marcar). La plantilla lleva:

- nombre, domicilio y teléfono o correo del proveedor **y los datos de contacto de la PROFECO**
  (LFPC, art. 17);
- baja en un clic.

### 3.6 Definiciones y métricas

- **Vendedor activado:** al menos 1 producto activo con foto y datos P4 elegidos por él, y compartido al
  menos una vez en 72 h.
- **Venta confirmada:** doble confirmación. El vendedor marca «pagado» y el comprador marca «recibido», o
  pasan 7 días desde la entrega sin disputa. La métrica norte se reporta **con y sin** pedidos no
  confirmados.
- **Beneficio por vendedor:** ventas confirmadas − costo − comisiones (incluida la del medio de pago
  que usó, H7) − gasto declarado en promoción. Lo calcula el código (P2) y se muestra con la nota «no
  incluye envío, empaque ni tu tiempo».
- **Origen de cada pedido:**
  - % que llegó por feed, comunidad o búsqueda (descubierto en la plataforma), frente al % que llegó por
    el link del propio vendedor;
  - pedidos de tu red personal, aparte.

  Si todo llega por el link del vendedor, la hipótesis «la IA ayuda a vender sin saber publicidad» **no
  se prueba**.

- **Criterio de éxito del piloto** (`mvp-0.1.md`): ≥ 40 % de los vendedores con al menos 1 venta
  confirmada en 30 días, **excluyendo** las ventas a tu red personal, y beneficio mediano > 0.

### 3.7 Calendario 30/60/90 con metas semanales

| Semana (fechas)   | Foco                                                                                      | Vendedores activados (acum.) | Conversaciones (acum.) | Registros (acum., base) | Hitos                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------- | ---------------------------- | ---------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| 1 (28 sep–4 oct)  | Higiene, decisiones urgentes, entrevistas                                                 | 0                            | 10                     | 0                       | Commit y respaldo; zona y nichos; 3 cotizaciones legales                           |
| 2 (5–11 oct)      | Bloqueos de seguridad, B1, correo; entrevistas                                            | 0                            | 30                     | 0                       | 30 entrevistas de descubrimiento; aviso de privacidad con responsable identificado |
| 3 (12–18 oct)     | Producción **por invitación**; contenido de los 3 nichos                                  | 5                            | 60                     | 20                      | Prueba de carga; primeros 5 fundadores en persona                                  |
| 4 (19–25 oct)     | IA real con cuota tras la evaluación; entidad decidida                                    | 15                           | 110                    | 60                      | **Antes del vendedor 11:** entidad y aviso final                                   |
| 5 (26 oct–1 nov)  | Abrir a la zona; Día de Muertos (contenido)                                               | 22                           | 170                    | 150                     | Tablero semanal en marcha                                                          |
| 6 (2–8 nov)       | Primer bazar; creadores 1–2                                                               | 30                           | 240                    | 300                     | E1, E2 y E5 empiezan                                                               |
| 7 (9–15 nov)      | Buen Fin (sin descuentos inventados); congelar cambios automáticos                        | 42                           | 310                    | 500                     | Guías para comparar precios, sin inventar descuentos                               |
| 8 (16–22 nov)     | Creadores 3–4; IA CEO observador                                                          | 55                           | 380                    | 750                     | Revisión del día 60                                                                |
| 9 (23–29 nov)     | Referidos entre vendedores                                                                | 65                           | 460                    | 1,050                   | E7 empieza                                                                         |
| 10 (30 nov–6 dic) | Segundo evento                                                                            | 75                           | 540                    | 1,400                   | —                                                                                  |
| 11 (7–13 dic)     | Guadalupe y posadas (contenido de regalos «en tu presupuesto», calculado por el servidor) | 88                           | 620                    | 1,800                   | —                                                                                  |
| 12 (14–20 dic)    | Cierre y evaluación                                                                       | 100                          | 700                    | 2,200                   | Decidir: ¿segunda zona o cuarto nicho?                                             |

**Tablero semanal** (las metas son mías, no promedios de la industria):

| Métrica                                                                 | Semana 4 | Semana 8        | Semana 12                                        |
| ----------------------------------------------------------------------- | -------- | --------------- | ------------------------------------------------ |
| Vendedores con ≥ 1 venta confirmada en 30 días (sin tu red)             | medir    | ≥ 30 %          | ≥ 40 %                                           |
| Beneficio mediano por vendedor activo                                   | medir    | > 0             | > 0 y creciendo                                  |
| % de pedidos descubiertos en la plataforma                              | medir    | medir           | reportar (sin meta: es lo que queremos aprender) |
| Activación en la 1.ª sesión (onboarding + ≥ 5 piezas vistas + 1 acción) | ≥ 40 %   | ≥ 50 %          | ≥ 50 %                                           |
| Regresan D1 / D7                                                        | medir    | ≥ 25 % / ≥ 12 % | ≥ 30 % / ≥ 15 %                                  |
| K de compradores (invitaciones × conversión)                            | medir    | ≥ 0.15          | ≥ 0.25                                           |
| Contenido comercial visto (salud)                                       | ≤ 30 %   | ≤ 30 %          | ≤ 30 %                                           |
| % de impresiones de contenido de personas reales                        | medir    | subir           | ≥ 30 %                                           |
| Casos de soporte por cada 100 pedidos; respuesta ≤ 24 h hábiles         | medir    | medir           | ≥ 90 % a tiempo                                  |
| Costo por vendedor activado y por persona activada, por canal           | medir    | medir           | bajar                                            |
| Costo de IA por vendedor activo                                         | medir    | medir           | ≤ US$1.10 (con la cuota)                         |
| Tus horas reales por semana, por actividad                              | anotar   | anotar          | anotar                                           |

**Tu tiempo es el cuello de botella [cálculo con los supuestos de los informes]:**

| Actividad                                                      | Horas por semana |
| -------------------------------------------------------------- | ---------------- |
| ≈ 58 conversaciones por semana (700 en 12 semanas, 10 min c/u) | ≈ 10             |
| Acompañamientos de 15 min                                      | ≈ 2              |
| Llamadas de los días 7, 14 y 30                                | ≈ 6              |
| Revisión de contenido                                          | 3.5              |
| Operación (2.4)                                                | 5                |
| Revisar en staging los cambios de los agentes [supuesto]       | ≈ 5              |
| Trámites legales (10–20 h en total en los días 1–45)           | 2.5–5            |
| **Total**                                                      | **≈ 34–37**      |

Si no puedes dedicar ≈ 35 h por semana, la meta honesta es 50 vendedores en 12 semanas, o contratar al
promotor del escenario de $50k (decisión 1).

### 3.8 Experimentos (corregidos)

| #   | Hipótesis                                                                                 | Diseño correcto                                                                                                                                                                      | Cómo se decide                                             |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| E1  | El bazar trae más vendedores activados por hora que los mensajes directos o los grupos    | Registro por canal y por hora de tu tiempo                                                                                                                                           | Nos quedamos con los canales que rinden ≥ 2 veces          |
| E2  | Imagen vertical con precio + texto de IA trae más visitas por compartido que el link solo | Variante **al azar en cada link**, guardada en `ShareLink`; nunca alternando por semana (se confunde con la quincena y el Buen Fin)                                                  | Visitas por compartido; análisis por vendedor              |
| E3  | «Unirme a [comunidad]» convierte más que «Registrarme»                                    | **Mínimo 3,800 visitas por variante antes de concluir** [cálculo: 5 % → 6.5 %, potencia 80 %]. El escenario conservador (≈ 6,400 visitas en 8 semanas) no alcanza para dos variantes | Si no se llega al mínimo, el resultado es «no concluyente» |
| E4  | Elegir 1 comunidad (con sugerencias) activa más que exigir 3                              | **Cambia ADR-022**: primero se registra como ADR nuevo o `PlatformDecision` de riesgo medio y solo aplica a llegadas con `?unirse=`                                                  | Activación y regreso en la 1.ª semana                      |
| E5  | El reporte semanal por correo mantiene publicando al vendedor                             | Grupo con reporte contra grupo sin reporte, al azar por vendedor                                                                                                                     | Vendedores que publican en las semanas 2–4                 |
| E6  | Un creador con código propio trae más personas activadas por peso                         | Por creador                                                                                                                                                                          | Costo por persona que vuelve en la 1.ª semana              |
| E7  | Los fundadores invitan a otros vendedores                                                 | Conteo por vendedor                                                                                                                                                                  | Si ≥ 0.3 vendedores traídos por vendedor, se escala        |

---

## 4. Mejoras priorizadas

### 4.1 Seguridad: cómo estamos hoy

Resumen de la evidencia reproducida en `localhost` que dejó la auditoría de seguridad (`.data/security`,
sobre todo `pentest/evidence.md`, `ai-future/VERIFY-A-RESULT.md` y los archivos `*.out*`). Verifiqué
en el código S1, S3, S4 (parte), S5 y H6. La severidad es mi clasificación. Si la auditoría de seguridad
entrega un informe aparte, ese informe manda en los detalles.

**Lo que está bien (se probó y resistió):**

- recorrido de rutas en `/media`;
- acceso a pedidos, pagos o productos ajenos (el servidor lo niega);
- CSRF (cookies `SameSite=Lax`);
- _clickjacking_ (`X-Frame-Options: DENY`);
- SQL parametrizado;
- XSS almacenado no reproducido (React escapa);
- GPS y EXIF eliminados de las fotos;
- errores de inicio de sesión genéricos;
- `/media` con CSP `sandbox`.

**Bloquean el despliegue público (Ola 0):**

| #   | Hallazgo                                                                                                                                                                                                                        | Por qué importa                                                                                          | Corrección                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| S1  | La pasarela simulada se usaría en producción (G1). La prueba de concepto terminó en un pedido «Pagado» y el vendedor vio «Marcar enviado» sin cobro real                                                                        | El vendedor enviaría sin cobrar                                                                          | Arranque que falla + `DEMO_MODE` + prueba                                                                                       |
| S2  | El inicio de sesión y el registro desde la pantalla no tienen límite de intentos: las Server Actions llaman `auth.api.*` directo y no pasan por el limitador de Better Auth (30 de 30 intentos sin bloqueo)                     | Adivinar contraseñas                                                                                     | Limitador propio en las acciones, por IP y por correo, con espera creciente                                                     |
| S3  | Redirección abierta: `safeRedirectPath("/.//sitio")` devuelve `//sitio` porque valida antes de normalizar (`src/lib/safe-redirect.ts`)                                                                                          | _Phishing_ con nuestro dominio                                                                           | Validar después de normalizar + pruebas con las 13 variantes de la evidencia                                                    |
| S4  | IA: tope global compartido; el límite de 20/h tiene una carrera (pasaron 40 solicitudes en paralelo); cuentas sin correo verificado y que no son vendedoras pueden usarla; las salidas inválidas se cobran y no se cuentan (H6) | Con IA real, una persona o un bot apaga la IA de todos en días                                           | Controles de la sección 6.2                                                                                                     |
| S5  | La configuración de producción acepta `APP_URL` vacío o con `http` (cookie de sesión sin `Secure`) y no exige SSL hacia la BD (G4)                                                                                              | Robo de sesión; vistas previas rotas                                                                     | Validación en `env-schema.ts`                                                                                                   |
| S6  | Por la API HTTP de Better Auth se puede crear una cuenta **sin aceptar términos ni aviso** (0 consentimientos guardados), guardar un nombre de 5 MB (la página de inicio pesó 10 MB) y una `image` con `javascript:`            | Incumple el consentimiento versionado; página caída para esa persona; riesgo si algún día se usa esa URL | Deshabilitar los endpoints que la UI no usa, exigir consentimiento en el _hook_ de registro, límites de longitud y validar URLs |

**Medios (Olas 0–1):**

- **S7.** No hay CSP en las páginas HTML (`next.config.ts` lo deja pendiente).
- **S8.** Seguir, unirse y dar like no tienen límite (40 de 40). Las vistas y las impresiones anónimas se
  inflan con simples GET, lo que envenena el Studio y al IA CEO. Se corrige con los eventos firmados (2.3)
  y límites por acción.
- **S9. Acaparamiento de stock.** Una cuenta reservó las 25 piezas de un producto con 3 checkouts y lo
  dejó «Agotado» 30 minutos, de forma repetible. Corrección: tope de unidades por checkout y de checkouts
  pendientes por persona.
- **S10.** El vendedor ve la dirección completa del comprador en pedidos **cancelados o rechazados**.
  Corrección: mostrarla solo en pedidos confirmados (minimización).
- **S11.** La llave del limitador sale de `X-Forwarded-For` sin proxies de confianza. Corrección:
  configurarlo según el hosting elegido.
- **S12. Subidas:**
  - pasó una ráfaga de 80 contra el límite de 60/h;
  - las imágenes de 40 Mpx suben la latencia de otras peticiones a 2–4 s;
  - las imágenes subidas y no usadas quedan públicas.

  Corrección: límite de píxeles, límite por IP y limpieza de huérfanas con cron.

**Bajos (Ola 2):**

- **S13.** El token de sesión aparece en el JSON de `get-session` y `list-sessions`. Se mitiga con CSP
  (S7) y deshabilitando endpoints.
- **S14.** Enumeración de correos en el registro («User already exists»).
- **S15.** Los IDs UUIDv7 revelan la fecha de creación de las cuentas.
- **S16. Privacidad:**
  - las búsquedas anónimas se guardan con el texto completo, que puede incluir temas de salud;
  - eventos de IA sin `userId` se pueden reidentificar con `responseId`;
  - la intención de búsqueda influye en el feed, pero Ajustes dice «No has declarado gustos ni
    búsquedas» y no permite borrarla.

  Corrección: retención corta, truncar o agregar búsquedas y transparencia en Ajustes.

- **S17.** Aviso de seguridad `GHSA-ggr8-5vv4-36mx` en `deepmerge-ts`, vía herramientas de Prisma. Es de
  bajo riesgo; se actualiza respetando la cuarentena de 24 h.

**Higiene de las auditorías (esta semana):**

- Correr `pnpm db:clean-e2e` para las cuentas `e2e.sec.*` y `e2e.strat.*`.
- Borrar los eventos anónimos de las fechas de las pruebas de carga (25–26 de septiembre).
- Borrar los archivos con contraseñas: `.data/strategy/test-accounts.json`, `acct*.txt`, `pw.txt`,
  `pass.txt` y otros.
- Borrar las trazas: `.data/strategy` pesa 254 MB y `.data/security` 15 MB.
- **No usar la BD de desarrollo como línea base.** Cifras como «98.3 % de los eventos son impresiones»
  están contaminadas.
- `.data/` ya está en `.gitignore`, así que nada de esto entra al repositorio. Aun así, sí entraría en
  un respaldo de la PC.

**Antes del primer despliegue público:** un procedimiento de incidentes de una página. Dice quién decide,
trae la plantilla del aviso a las personas afectadas y los pasos para rotar secretos. La LFPDPPP, art. 19,
obliga a avisar **de inmediato** si hay una vulneración significativa.

### 4.2 Lista priorizada (un solo backlog)

- **Impacto:** A = alto, M = medio, B = bajo.
- **Esfuerzo:** días-agente, un agente que deja `check`, `build` y E2E en verde [estimación].
- **Olas:**
  - **Ola 0**, días 1–21: antes del primer vendedor. Es el recorte para lanzar.
  - **Ola 1**, días 22–45: antes del vendedor 25.
  - **Ola 2**, días 45–90.
  - **Ola 3**, después del día 90.

| #       | Mejora                                                                                                                                                          | Área                   | Impacto | Esfuerzo          | Ola                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------- | ----------------- | ------------------------- |
| T1      | Commit inicial, repositorio privado, CI (`check`, `build`, E2E, migraciones), vistas previas                                                                    | Deuda técnica          | A       | 1.5               | 0                         |
| S1–S6   | Bloqueos de seguridad (4.1)                                                                                                                                     | Seguridad              | A       | 3–4               | 0                         |
| G2      | Semilla con `SEED_DEMO=1` y solo en localhost                                                                                                                   | Confianza              | A       | 0.25              | 0                         |
| T3      | Despliegue (Vercel + Neon con _pooler_ + R2), correo con Resend, recuperar contraseña, verificar correo, Sentry                                                 | Operación              | A       | 4–5               | 0                         |
| B1      | Cobro directo del vendedor con el estado «Esperando pago al vendedor» (7.2)                                                                                     | Comercio               | A       | 3–4               | 0                         |
| T5-min  | Excluir al dueño y a los robots, compartidos con fecha, visitante anónimo, eventos firmados                                                                     | Producto               | A       | 1.5               | 0                         |
| Tr0     | Sin promesas preseleccionadas + **garantía: «Sin garantía» o «≥ 90 días»** (LFPC 77) + resumen «Esto le prometes al comprador»                                  | Confianza              | A       | 0.75              | 0                         |
| ED      | Casilla «Tengo 18 años o más» al registrarse, cláusula en términos y bloqueo de «Vender» sin ella                                                               | Confianza              | A       | 0.5               | 0                         |
| T4-min  | Moderación mínima: reportar, cola, ocultar, rol con 2FA; ocultamiento automático solo para lo grave                                                             | Confianza              | A       | 3–4               | 0                         |
| SOP     | Correo de soporte, botón «Tengo un problema» en cada pedido, bitácora                                                                                           | Confianza              | A       | 1                 | 0                         |
| OG1     | Imagen para compartir de **producto** (5, punto 4) + `og:url` + `?r=`                                                                                           | Crecimiento            | A       | 2                 | 0                         |
| ED2     | Contenido en producción de los 3 nichos (script con fecha real)                                                                                                 | Producto               | A       | 1.5 + tu revisión | 0                         |
| H8      | Cron de expiración y `JobRun`                                                                                                                                   | Operación              | M       | 1                 | 0                         |
| AI1     | Claude detrás de `AIProvider` + H2, H3, H5, H6 + cuotas + evaluación de 60 casos                                                                                | IA                     | A       | 4                 | 1 (antes del vendedor 11) |
| C1      | Compra rápida desde link: directo a registro, conservar el carrito, onboarding después (con E4 y su ADR)                                                        | Comercio               | A       | 1–2               | 1                         |
| C3/H7   | Comisión por método: % + cuota fija + IVA                                                                                                                       | Comercio               | M       | 0.5               | 1                         |
| P1      | Precargar la primera imagen visible del feed (LCP móvil de 3.48 s a ≈ 2 s [estimación])                                                                         | Rendimiento            | M       | 0.1               | 1                         |
| AX1     | Botones de 44 px en la compra y checkbox de términos                                                                                                            | Producto               | M       | 0.25              | 1                         |
| P2      | Columna derecha: no calcularla en móvil; quitarla de carrito, checkout y pedidos                                                                                | Rendimiento            | M       | 0.5               | 1                         |
| S7–S12  | Seguridad media                                                                                                                                                 | Seguridad              | M       | 3                 | 1                         |
| SEO-P0  | Resto de la lista P0 de SEO (sección 5)                                                                                                                         | Crecimiento            | M       | 3                 | 1                         |
| N1      | Avisos por correo: pedido, pago confirmado y resumen semanal (con consentimiento)                                                                               | Producto               | A       | 2                 | 1                         |
| R5      | Filtro de burbujas en la URL                                                                                                                                    | Producto               | B       | 0.25              | 2                         |
| IA-CEO  | Tablero de salud + reporte semanal + IA CEO observador + Centro de decisiones                                                                                   | Autonomía              | M       | 7                 | 2 (desde el día 45)       |
| AP1     | Autopiloto mínimo: kit por canal, seguimientos D1/D3/D7, resumen                                                                                                | Creadores y vendedores | M       | 4                 | 2                         |
| S2a     | Analítica del Studio por producto (visitas únicas, carrito, ventas, origen)                                                                                     | Vendedores             | M       | 1.5               | 2                         |
| S4      | «Demanda sin oferta»: solo con ≥ 10 personas distintas y en rangos («10–20 personas»)                                                                           | Vendedores             | M       | 0.5               | 2                         |
| Tr1     | Reseñas solo tras venta confirmada; promedio solo con n ≥ 3                                                                                                     | Confianza              | M       | 1.5               | 2                         |
| P3/P4   | Zod fuera del navegador; prefetch moderado con Save-Data                                                                                                        | Rendimiento            | B       | 0.75              | 2                         |
| D1      | Regla de lint para las capas; mover lógica a servicios, empezando por comercio                                                                                  | Deuda técnica          | M       | 2                 | 2                         |
| S13–S17 | Seguridad baja                                                                                                                                                  | Seguridad              | B       | 1.5               | 2                         |
| B7      | Precio «antes»: hoy **no se expone** (`compareAtPriceCents` no aparece en formularios ni DTOs). Solo se agrega una prueba que falle si un DTO público lo expone | Confianza              | B       | 0.1               | 2                         |
| C2      | Pagos reales (split de Mercado Pago o Stripe Connect), en modo de prueba                                                                                        | Comercio               | A       | 5–8               | 3                         |
| C4/C5   | Envíos con agregador, puntos de recolección                                                                                                                     | Comercio               | M       | 4                 | 3                         |
| R2      | Mensajes comprador–vendedor (base del agente de ventas)                                                                                                         | Comercio               | A       | 3                 | 3                         |
| SA      | Agente de ventas (P12)                                                                                                                                          | IA                     | A       | 6–8               | 3                         |
| A1      | Afiliados con comisión (solo con pagos reales)                                                                                                                  | Creadores              | M       | 1                 | 3                         |
| R4      | Reels (P13)                                                                                                                                                     | Producto               | A       | 6+                | 3                         |
| SEO-P1  | Indexación pública (sección 5)                                                                                                                                  | Crecimiento            | M       | 4                 | 3                         |

**Carga de la Ola 0 [cálculo con las estimaciones de la tabla]:** ≈ 23–27 días-agente. Con 2 frentes en
paralelo son ≈ 12–14 días calendario, y tu revisión en staging es el cuello de botella (3.7). Por eso el
sitio abre **por invitación en la semana 3** y la IA real llega en la semana 4.

**Lo que no se hará en estos 90 días:** IA CEO con autonomía (salvo que se cumpla el umbral), agente de
ventas, pagos reales en producción, SEO P1, Reels e «Impulsar».

---

## 5. SEO y vistas previas al compartir

En el piloto casi todo el efecto viene de WhatsApp y Facebook. Google es un canal de meses y no se
promete tráfico. Next 16.3.6 ya entrega los metadatos a los robots de vista previa (WhatsApp,
`facebookexternalhit`, Twitterbot, Telegram), así que **no hay que tocar `htmlLimitedBots`**.

### P0: antes de que los vendedores compartan links (Olas 0–1)

1. **Excluir robots y al dueño de la analítica.**
   - Crear `src/lib/bots.ts` con la lista de `html-bots.js` más `Googlebot`, `TelegramBot` y
     `meta-externalagent`, y una prueba.
   - En `producto/[slug]`, `p/[id]`, `c/[slug]` y el inicio: leer el _user agent_ antes de `after()`.
     Si es robot o el dueño, no registrar.
   - El evento `LINK_PREVIEW` queda **solo para uso interno**. Nunca se muestra al vendedor, ni como
     «aproximado»: un robot no es una persona.
2. **Un solo helper `src/lib/seo/metadata.ts`**, con `absoluteUrl`, `snippet` y `pageMetadata`. Da
   canonical sin parámetros, `og:url` igual a la canonical, `siteName`, `locale: es_MX`, `type`, imagen
   con ancho, alto y `alt`, y `twitter: summary_large_image`.
   - **Nunca** poner canonical ni `og:url` en `layout.tsx`: todas las páginas sin metadatos propios
     dirían ser el inicio.
3. **Descripciones que nunca queden vacías,** armadas por código con datos P4, por ejemplo
   «$3,499 · Envío a todo México · Guadalajara, Jalisco», y cortadas en palabra completa.
4. **Imagen para compartir en JPEG de 1200×630.**
   - **Tamaño:** < 600 KB (límite de WhatsApp [23]); objetivo < 300 KB.
   - **Ruta:** `src/app/og/[tipo]/[id]/route.tsx` con `ImageResponse` y `sharp`, caché inmutable.
   - **Protección contra costo.** Solo se acepta un `?v=` igual al `updatedAt` vigente; si no, 301 a la
     URL canónica. Solo identificadores que existen y límite por IP. Con un `?v=` libre, cualquiera
     evitaría la caché y dispararía el costo del hosting.
   - **Orden:** primero producto (Ola 0); después publicación, comunidad y perfil (Ola 1).
   - **Contenido de la tarjeta de producto:** foto sin recortar, título, precio con `formatMoney`, una
     línea P4 y la marca. Sin urgencia ni escasez.
5. **`APP_URL` obligatorio y con `https` en producción** (S5).
6. **Interruptor de indexación `SITE_INDEXING=off` por defecto.** Manda `X-Robots-Tag: noindex` en todo
   el sitio, incluidos `/media` y `/og`. `robots.txt` queda abierto (`Allow: /`), porque bloquearlo rompe
   las vistas previas [25]. Encenderlo es una decisión de riesgo alto (sección 8).
7. **`cache()` de React** en `getPublicProduct`, `loadCommunity`, `loadPost` y `getPublicProfile`, para
   no duplicar consultas entre los metadatos y la página.
8. **`tests/e2e/seo.spec.ts`.** Con _user agent_ de WhatsApp, por cada plantilla pública revisa:
   - `og:title`, `og:description`, `og:url` y `og:image` no vacías;
   - canonical absoluta;
   - imagen `image/jpeg` de < 600 KB y ≥ 300 px de ancho.
9. **Atribución al compartir.** `?ref=compartir` también en publicaciones, `?r=<código aleatorio>` (nunca
   el nombre de usuario) y canal. Un botón «Enviar por WhatsApp» con `https://wa.me/?text=…`.

### P1: al encender la indexación (después del piloto, con dominio y textos legales finales)

10. `src/app/robots.ts` y `src/app/sitemap.ts` con `force-dynamic`. El sitemap lleva los productos
    activos, las comunidades y los perfiles con al menos un producto activo.
11. `noindex, follow` en `/entrar`, `/registro`, las páginas legales en borrador, `/comprar?q=`,
    `/p/[id]` de tipo producto (la página dueña de esa búsqueda es `/producto`) y el Studio.
12. JSON-LD `Product`/`Offer`:
    - el precio lo calcula el código;
    - `InStock` u `OutOfStock`;
    - condición del producto;
    - envío y devoluciones solo si son datos P4;
    - **sin costo** (con una prueba) y **sin `aggregateRating`** hasta que haya reseñas reales.

    Google solo admite fichas de comerciante en páginas donde se puede comprar [26].

13. `BreadcrumbList`, `WebSite` (sin `SearchAction`, que Google retiró en 2024 [27]), `ProfilePage` y
    `SocialMediaPosting` solo en publicaciones de personas.
14. H1 en `/p/[id]` y un título de inicio con la propuesta de valor, tomada de `siteConfig`.
15. Pestaña «Productos» en `/u/[usuario]`: sirve como link de tienda para la bio del vendedor.

### P2: optimización

- **Producto archivado:** página «Ya no está disponible» con `noindex` y productos relacionados, para
  que los links viejos de WhatsApp no terminen en un callejón.
- **Categorías con URL propia:** `/comprar/[categoria]`, con 301 desde `?categoria=`.
- **Velocidad medida en campo:** `useReportWebVitals` hacia eventos propios. Meta en el percentil 75:
  LCP < 2.5 s, INP < 200 ms y CLS < 0.1 [28].
- **«Así se verá en WhatsApp» en el Studio:** una vista previa con la misma tarjeta real.
- **Robots de entrenamiento de IA:** si se bloquean o no es una decisión tuya de riesgo alto.

**Cómo se mide:**

- el validador en verde en el 100 % de las plantillas;
- «visitas humanas por compartido» (el indicador de P1);
- registros con `next=/producto`;
- compras atribuidas por canal.

---

## 6. Costos estimados por etapa

Todo lo de esta sección es **[estimación]** con precios de lista consultados por los informes y
verificados por el revisor ([14]–[21]). Los precios cambian: hay que revisarlos al contratar.

### 6.1 Infraestructura mensual

| Concepto                                                                                                                                                                                                        | Piloto (≤ 100 vendedores)                                                                               | 1,000 vendedores | 10,000 vendedores          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------- |
| Vercel Pro: US$20 con uso incluido. El plan gratuito no permite uso comercial [15]                                                                                                                              | US$20                                                                                                   | US$20 + consumo  | US$20 + consumo            |
| Neon Launch: US$0.106 por hora de cómputo y US$0.35 por GB. **La restauración a un punto en el tiempo cuesta US$0.20 por GB al mes** (no es gratis). Salida de datos: 500 GB incluidos, después US$0.10/GB [17] | ≈ US$22 [cálculo: 0.25 × 0.106 × 730 h ≈ US$19.3 + almacenamiento ≈ US$0.7 + 10 GB de historial ≈ US$2] | ≈ US$85–90       | ≈ US$360–685               |
| Cloudflare R2: 10 GB gratis, después US$0.015/GB; salida gratis [18]                                                                                                                                            | US$0                                                                                                    | ≈ US$3           | ≈ US$30 + operaciones      |
| Resend: gratis 3,000 al mes y 100 al día; Pro US$20 [19]                                                                                                                                                        | US$0–20                                                                                                 | US$20–35         | US$35–90                   |
| Sentry: gratis con 5,000 errores [20]                                                                                                                                                                           | US$0                                                                                                    | US$26            | US$80                      |
| GitHub Actions: 2,000 min gratis al mes en repositorios privados, después US$0.006/min [21]                                                                                                                     | US$0–6 [supuesto: ≈ 20 min por corrida]                                                                 | igual            | igual                      |
| Dominio y monitor de disponibilidad                                                                                                                                                                             | sin cotizar                                                                                             | —                | —                          |
| **Total sin IA ni video**                                                                                                                                                                                       | **≈ US$45–70**                                                                                          | **≈ US$155–175** | **≈ US$525–890 + consumo** |

¿Por qué Vercel + Neon + R2 (opción A)? No es por la restauración, que tiene costo, sino por las ramas de
BD para cada vista previa, el escalado a cero en un piloto con poco tráfico y porque no hay servidores
que administrar.

- **Requisito:** con Prisma 7 y `adapter-pg` hay que usar el endpoint con _pooler_ de Neon, o se agotan
  las conexiones.
- **Prueba de carga** en staging antes de la apertura por invitación y antes del primer bazar (p. ej.
  50 personas simultáneas [supuesto]).

### 6.2 IA: costo corregido y controles

**Costo por uso [cálculo con precios de Anthropic [14]]:**

- **Por propuesta con Sonnet 5:** ≈ US$0.033, con 3,500 tokens de entrada (2,500 en caché) y 3,000 de
  salida. El tokenizador nuevo genera ≈ 30 % más tokens, así que hay que medir con el conteo real.
- **Por vendedor activo al mes, sin agente de ventas** (que no existe en estos 90 días): ≈ **US$0.37**.
  - 8 propuestas = US$0.264;
  - 20 variantes con Haiku = US$0.09;
  - 15 moderaciones con Haiku = US$0.02.
- **100 vendedores:** ≈ US$37 + analista por lotes US$4.5 + contenido editorial US$2.5 ≈ **US$44 al mes**.
- **Peor caso con cuota (cada vendedor usa sus 30 propuestas):** ≈ US$1.10 por vendedor, o sea
  ≈ **US$117 al mes** con 100 vendedores.
- **El riesgo real no es el uso normal, es el abuso.** Con 20 solicitudes por hora, una sola cuenta
  puede hacer 480 al día, que cuestan US$12.5–15.6 [cálculo: 480 × 0.026–0.0325]. Eso vacía US$50 en
  ≈ 4 días. La carrera de S4 lo empeora.

**Un solo supuesto de uso (decisión 6).** Los informes usaban 50, 30 y 8. Queda así:

- **para planear:** 8 propuestas al mes por vendedor en promedio;
- **tope (cuota):** 30 al mes por vendedor y 10 al día por persona [supuestos];
- con las primeras 200 solicitudes reales se reemplaza por la mediana medida.

**Controles antes de conectar la IA real (Ola 1, antes del vendedor 11):**

1. IA solo para cuentas con correo verificado y perfil de vendedor activo.
2. Cuota diaria por persona y cuota mensual por vendedor, con una reserva atómica antes de llamar al
   proveedor (cierra la carrera).
3. Disyuntor global: como máximo el 10 % del presupuesto mensual en un día [supuesto].
4. Registrar costo en **todo** resultado, incluidos las salidas inválidas y los errores (H6).
5. Prioridad a los flujos de venta; nunca cortar a un vendedor a mitad de un flujo (`architecture.md`).
6. Límite de gasto en la consola de Anthropic **igual** a `ai.budget`.
7. La evaluación de 60 casos usa textos de los vendedores fundadores **con su permiso** o sin nombres
   ni teléfonos. Es una finalidad nueva y va en el aviso de privacidad.

**Presupuesto recomendado:**

- semilla de US$150 al mes (≈ $2,700 MXN): cubre el peor caso con cuota y las corridas de evaluación
  (≈ US$2 cada una [cálculo: 60 × 0.033]);
- mientras la comisión sea 0 %, el límite efectivo es la semilla y el tope duro no aplica.

**Cobertura de la IA, corregida.** El código destina a la IA solo el 20 % de los ingresos
(`revenueSharePercent: 20` en `budget.ts`).

- Con 10,000 vendedores y agente de ventas (≈ US$9,830 al mes ≈ $176,940 MXN), cubrir la IA con una
  comisión de 5 % requiere ≈ **$17.7 M MXN de ventas al mes** [cálculo: 176,940 ÷ 0.05 ÷ 0.20], no
  $3.54 M.
- **Cobertura total** = ingresos de la plataforma ÷ (IA + infraestructura + procesador, si lo paga la
  plataforma). A esa escala, cubrir IA + infraestructura (≈ $186,000–193,000 MXN al mes) con el 100 %
  de una comisión de 5 % requiere ≈ $3.7–3.9 M MXN de ventas al mes [cálculo]. No incluye sueldos.

### 6.3 Flujo de caja de 90 días

| Concepto                                                                                                                                        | Mínimo                                | Base                     | Acelerado                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------ | ------------------------- |
| Infraestructura (3 meses; se despliega en la semana 2)                                                                                          | US$135–210                            | igual                    | igual                     |
| IA (tope de US$150 al mes; lo realista es ≈ US$50–120 en total)                                                                                 | hasta US$450                          | igual                    | igual                     |
| **Subtotal técnico**                                                                                                                            | **≈ US$590–660 ≈ $10,600–11,900 MXN** | igual                    | igual                     |
| Crecimiento                                                                                                                                     | $0                                    | $10,000 al mes = $30,000 | $50,000 al mes = $150,000 |
| Marca en el IMPI: $2,994.62 + IVA por clase ≈ $3,474 por clase [37] (secundaria; confirmar en el IMPI). El número de clases lo define el asesor | ≈ $3,500–10,400                       | igual                    | igual                     |
| Asesoría legal y fiscal, dominio                                                                                                                | sin cotizar                           | sin cotizar              | sin cotizar               |
| **Total sin asesoría**                                                                                                                          | **≈ $14,000–22,000 MXN**              | **≈ $44,000–52,000**     | **≈ $164,000–172,000**    |

**Qué incluye cada escenario de crecimiento [supuestos para cotizar]:**

- **$10,000 al mes:**
  - 3 creadores nano a $1,500 c/u;
  - 1 bazar por $2,000;
  - kit de foto por $1,500 (una sola vez);
  - QR y tarjetas por $500;
  - prueba de anuncios por $1,500, solo para conocer el costo real por persona.
- **$50,000 al mes:**
  - promotor de campo medio tiempo por $15,000 (cotizar);
  - 6 creadores nano y 1 micro por ≈ $17,000;
  - 2 bazares y 1 feria por $6,000;
  - anuncios con techo de costo por persona activada por $10,000;
  - contingencia por $2,000.

**Acciones de dinero:**

- Fijar un **tope de gasto de 90 días** (decisión 8).
- Usar una tarjeta **separada** para la empresa.
- Preguntar al contador por la comisión cambiaria de pagar en dólares con tarjeta mexicana y por el IVA
  de servicios digitales extranjeros. Para deducir se necesitan el RFC y los CFDI de la entidad.

**Costo del procesador (solo informativo en el piloto B1).** Si el vendedor cobra con su propio link de
Mercado Pago, en un ticket de $500 le cuesta $24.88 (4.98 %) al instante o $26.62 (5.32 %) en efectivo
[10] [cálculo con IVA sobre porcentaje y cuota fija; no está claro si el IVA aplica al porcentaje]. La
transferencia y el pago contra entrega cuestan $0. La cifra de margen tiene que reflejarlo (C3/H7).

---

## 7. Riesgos y cómo mitigarlos

### 7.1 Legales y fiscales (México)

Nada de esto es consejo legal: son preguntas para el abogado y el contador, con la ley que las
fundamenta.

| Riesgo                                                           | Fundamento                                                                                                                                                          | Mitigación                                                                                                                                                                                                                                                                                                                                                    | Cuándo                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Abrir sin responsable identificado                               | LFPDPPP art. 15 fr. I: identidad y domicilio en el aviso [33]. LFPC art. 76 BIS fr. III: domicilio físico y teléfonos **antes** de la transacción [34]              | Desde el día 1, el aviso nombra a un responsable. Mientras tanto, tú como persona física con actividad empresarial, con un domicilio para notificaciones que puede ser una oficina virtual (confirmar con el abogado). **Antes del vendedor 11:** entidad decidida entre una SAS (tope de ingresos 2026: $7,678,849.94 MXN [36]) y la persona física temporal | Cotizaciones en la semana 1; decisión en la semana 4 |
| Datos de contacto del vendedor frente a su privacidad            | LFPC 76 BIS fr. III                                                                                                                                                 | Mostrar domicilio y teléfono del vendedor **en el paso de confirmación del pedido**, no en la página pública, con consentimiento del vendedor al activarse. Preguntar si un vendedor ocasional cuenta como «proveedor»                                                                                                                                        | Semana 2                                             |
| Garantía menor a la legal                                        | LFPC art. 77: si se ofrece, no puede ser menor a 90 días. Hoy el formulario propone 30 días y acepta de 1 a 3,650 (`form-defaults.ts`, l. 88; `schemas.ts`, l. 114) | Tr0: solo «Sin garantía» o «≥ 90 días», con una prueba                                                                                                                                                                                                                                                                                                        | Ola 0                                                |
| Menores de edad                                                  | Existe la comunidad Gaming y no hay control de edad                                                                                                                 | Casilla de 18+, cláusula en términos y «Vender» bloqueado sin ella                                                                                                                                                                                                                                                                                            | Ola 0                                                |
| Publicidad engañosa                                              | LFPC art. 32 [34]                                                                                                                                                   | Sin «antes/ahora» sin verificar, sin urgencia falsa; creadores con #Publicidad [35]                                                                                                                                                                                                                                                                           | Siempre                                              |
| Marketing sin consentimiento                                     | LFPC arts. 17 y 18 (REPEP) [34]                                                                                                                                     | Casilla aparte sin marcar; plantilla con datos del proveedor y de la PROFECO; baja en un clic; nunca prospección automática                                                                                                                                                                                                                                   | Antes del primer correo de marketing                 |
| Proveedores tecnológicos (Anthropic, Vercel, Neon, Resend)       | LFPDPPP art. 3 fr. XX: el encargado **no** es una transferencia [33]                                                                                                | Contrato de encargado (DPA) con cada uno y mencionarlos en el aviso. No hace falta pedir consentimiento de transferencia. Confirmar con el abogado                                                                                                                                                                                                            | Antes de abrir                                       |
| Decisiones automatizadas                                         | LFPDPPP art. 26 fr. II [33]                                                                                                                                         | Solo una persona suspende cuentas; hay apelación; la IA solo oculta de forma provisional lo grave                                                                                                                                                                                                                                                             | Siempre                                              |
| Vulneración de datos                                             | LFPDPPP art. 19                                                                                                                                                     | Procedimiento de una página (4.1)                                                                                                                                                                                                                                                                                                                             | Antes del primer despliegue público                  |
| Nuevos usos de datos (evaluación de IA, cookie de origen, `?r=`) | LFPDPPP (finalidades)                                                                                                                                               | Agregarlos al aviso; quitar datos personales de los textos de evaluación                                                                                                                                                                                                                                                                                      | Antes de usarlos                                     |
| Retenciones si VendeIA cobra por cuenta del vendedor             | LIF 2026 art. 25 fr. VI y IX: ISR de 2.5 % a personas físicas y morales, 20 % sin RFC; IVA según LIVA 18-J [29][31]                                                 | En el piloto (B1) no se cobra por cuenta de nadie. Preguntas para el contador: ¿aplican las obligaciones de información del art. 18-J fr. III de la LIVA?, ¿aplica el art. 30-B del CFF (acceso del SAT en tiempo real, vigente desde el 1 de abril de 2026 según fuentes secundarias [32])?, ¿hay un «servicio digital» gravado con comisión 0 %?            | Semanas 1–4                                          |
| Alimentos y sorteos                                              | Normativa sanitaria; posibles permisos para sorteos                                                                                                                 | Los alimentos son responsabilidad del vendedor (abogado); nada de sorteos en el piloto                                                                                                                                                                                                                                                                        | Semana 2                                             |

### 7.2 Pagos (modo B1: «cobro directo del vendedor»)

**Una sola regla, compatible con los tres informes (decisión 4):**

- El método de pago es un **dato P4 estructurado**. Los datos bancarios solo aparecen **dentro del
  pedido**, nunca en público.
- El filtro sigue bloqueando CLABE o «deposítame» en comentarios y publicaciones.
- El aviso dice «Paga solo con los datos de tu pedido» (no «Nunca pagues fuera de VendeIA», que sería
  falso en B1).
- La transferencia solo se habilita para vendedores con **teléfono verificado**.
- Nuevo estado **«Esperando pago al vendedor»**, con vigencia según el método: 48 h para transferencia y
  hasta la entrega para contra entrega [supuestos]. El vendedor puede cancelar a mano. El cron de
  expiración **no** cancela estos pedidos. Afecta a `CHECKOUT_TTL_MINUTES` en `fees.ts`.
- Se registra como ADR nuevo (reemplaza parcialmente a ADR-023 durante el piloto).

| Riesgo                               | Mitigación                                                                                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La venta la declara solo el vendedor | Doble confirmación (3.6); la métrica se reporta con y sin pedidos no confirmados                                                                                              |
| Comprobantes de transferencia falsos | Aviso al vendedor: «Confirma en la app de tu banco, no con una captura». Recomendar contra entrega en las primeras compras. Tope por pedido de $3,000 [supuesto; decisión 15] |
| Pasarela simulada en producción      | S1                                                                                                                                                                            |
| Disputas sin proceso                 | «Tengo un problema» con plazos; tú decides en el piloto                                                                                                                       |
| Pagos reales antes de tiempo         | Dependen de la entidad, del visto bueno fiscal y de un PAC. Se integran en modo de prueba **después** del día 90                                                              |

### 7.3 Confianza

- **Reportes usados contra un competidor.** En un piloto de conocidos, 3 personas podrían ocultar un
  producto ajeno. El ocultamiento automático aplica solo a lo grave: estafa o artículo prohibido
  detectado por el clasificador. Lo demás va a la cola y se avisa al vendedor.
- **«Demanda sin oferta» puede revelar a alguien.** «2 personas buscaron X» identifica. Solo se muestra
  con ≥ 10 personas distintas y en rangos.
- **Apariencia de actividad falsa.** Límite al contenido asistido por IA y métrica de % de contenido de
  personas reales (3.4).
- **Descuentos inventados.** Hoy no son posibles (B7); una prueba lo mantiene así.
- **Métricas infladas en el Studio.** T5 y los eventos firmados; `LINK_PREVIEW` solo interno.

### 7.4 Operación

| Riesgo                                                | Probabilidad            | Impacto | Mitigación                                                                            |
| ----------------------------------------------------- | ----------------------- | ------- | ------------------------------------------------------------------------------------- |
| Pérdida del código o la BD (una sola PC, sin commits) | Media                   | Crítico | T1 y respaldo **esta semana**                                                         |
| Tu tiempo no alcanza (≈ 34–37 h por semana)           | Alta                    | Alto    | Decisión 1; anotar horas; bajar la meta a 50 o contratar un promotor                  |
| Abuso de IA que agota el presupuesto                  | Alta con IA real        | Alto    | 6.2                                                                                   |
| Envenenamiento de métricas del IA CEO                 | Media                   | Alto    | Eventos firmados, límites, exclusión de tráfico anómalo, modo observador              |
| Inyección de instrucciones al analista o al agente    | Media                   | Alto    | Solo agregados; texto delimitado como dato; salida validada; nunca ejecuta            |
| Costo disparado por la imagen para compartir          | Baja                    | Medio   | `v` = `updatedAt` o 301; límite por IP                                                |
| Conexiones agotadas en Postgres                       | Media                   | Alto    | _Pooler_ de Neon + prueba de carga                                                    |
| Comunidades vacías al llegar por un link              | Alta si no se hace nada | Alto    | ED2 antes del día 10                                                                  |
| Moderación que desborda                               | Media                   | Medio   | Filtro previo gratuito (OpenAI Moderation [40]), cola y tú al inicio con 24 h hábiles |
| Cambios de precio de los proveedores                  | Alta                    | Medio   | Precios con fecha y prueba; límite en la consola                                      |
| Video (P13) sin presupuesto                           | Alta                    | Medio   | Fuera de estos 90 días                                                                |

---

## 8. Decisiones que necesita el fundador

| #   | Decisión                                               | Opciones                                                                                                 | Recomendación                                                                                                                                                               | Para cuándo                         |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | **Tu tiempo**                                          | Tiempo completo (≈ 35 h por semana) · meta de 50 vendedores en 12 semanas · contratar un promotor ($50k) | Si puedes, tiempo completo 12 semanas. Si no, meta de 50 y 100 en la semana 16. Anota tus horas reales                                                                      | Esta semana                         |
| 2   | **Zona del piloto**                                    | —                                                                                                        | 2–3 alcaldías o municipios contiguos donde puedas estar en persona                                                                                                          | Esta semana                         |
| 3   | **Nichos**                                             | —                                                                                                        | Comida casera y repostería; moda y belleza de emprendedoras; mascotas                                                                                                       | Esta semana                         |
| 4   | **Modo de cobro del piloto**                           | B1 (cobro directo del vendedor) · esperar a los pagos reales                                             | B1 durante todo el piloto, con las reglas de 7.2 y un ADR nuevo                                                                                                             | Día 7                               |
| 5   | **Entidad legal**                                      | SAS en línea · tú como persona física con actividad empresarial (temporal)                               | Pedir 3 cotizaciones esta semana; decidir con el asesor antes del vendedor 11                                                                                               | Cotizaciones día 5; decisión día 25 |
| 6   | **IA: presupuesto y uso**                              | US$50 · US$150 · US$400                                                                                  | Semilla de US$150 al mes con el mismo límite en la consola; 8 propuestas al mes para planear; cuota de 30 al mes y 10 al día; IA solo para vendedores con correo verificado | Día 20                              |
| 7   | **Presupuesto de crecimiento**                         | $0 · $10k · $50k al mes                                                                                  | $10k al mes desde la semana 5, para conocer el costo real por canal; $50k solo si no puedes dedicar tiempo completo                                                         | Día 25                              |
| 8   | **Tope de gasto de 90 días y tarjeta separada**        | —                                                                                                        | Base: ≈ $52,000 MXN más la asesoría (6.3)                                                                                                                                   | Esta semana                         |
| 9   | **Proveedor de IA y umbral de evaluación**             | Claude · Gemini                                                                                          | Claude (Sonnet 5 para propuestas y Haiku 4.5 para variantes y moderación). Para aprobar: 0 cifras inventadas y ≥ 90 % de categoría correcta [supuesto]                      | Día 15                              |
| 10  | **Hosting**                                            | A: Vercel + Neon + R2 · B: Vercel + Supabase                                                             | A (6.1)                                                                                                                                                                     | Día 7                               |
| 11  | **Contenido de arranque en producción**                | Script editorial con fecha real · adelantar el contenido v1                                              | Las dos en secuencia: publicar las piezas curadas con su fecha real y sumar ≈ 20 por nicho del piloto; solo fotos de stock con licencia                                     | Antes del día 10                    |
| 12  | **Onboarding con 1 comunidad** (cambia ADR-022)        | Mantener 3 · probar 1                                                                                    | Registrarlo como decisión de riesgo medio y probarlo solo en llegadas con `?unirse=` (E4)                                                                                   | Día 35                              |
| 13  | **Umbral de reversión del comercio**                   | —                                                                                                        | Revertir si las visitas a producto por vendedor activo caen más de 15 % [supuesto]                                                                                          | Día 45                              |
| 14  | **Moderación**                                         | Tú · alguien contratado                                                                                  | Tú al inicio, 24 h hábiles, lista de prohibidos revisada por el abogado; ocultamiento automático solo para lo grave                                                         | Día 14                              |
| 15  | **Tope por pedido en B1**                              | —                                                                                                        | $3,000 MXN [supuesto]                                                                                                                                                       | Día 7                               |
| 16  | **Nombre definitivo y búsqueda en el IMPI**            | —                                                                                                        | Antes de salir de los 15 fundadores; cambiar después desperdicia la recomendación de boca en boca                                                                           | Día 21                              |
| 17  | **Encender la indexación y cobrar comisión** (hoy 0 %) | —                                                                                                        | Ninguna de las dos en estos 90 días: solo después de demostrar beneficio y de tener pagos reales                                                                            | Después del piloto                  |

---

## 9. Fuentes

Consultadas por los informes entre el 25 y el 26 de septiembre de 2026. **✓** = verificada por el revisor
escéptico o por mí. «Secundaria» = un medio que cita al estudio original.

**Mercado**

1. ✓ INEGI, _Comunicado de prensa 32/26 · ENDUTIH 2025_, 16-06-2026. Lo leí: 86.1 %, 104.9 M, 84.6 %
   celular, 38.1 % computadora, 79.3 % solo prepago.
   https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/endutih/ENDUTIH_25.pdf
2. ✓ Secundaria. The CIU, «ENDUTIH 2025: Nuevas brechas de conectividad», 2026 (97.3 % por smartphone;
   37.3 % compra en línea). https://www.theciu.com/publicaciones-2/2026/6/29/endutih-2025-nuevas-brechas-de-conectividad
3. ✓ DataReportal (Kepios, We Are Social, Meltwater), _Digital 2026: Mexico_, 2026.
   https://datareportal.com/reports/digital-2026-mexico
4. Secundaria, no verificada de nuevo. AIMX y Offerwise, _Hábitos de Usuarios de Internet en México
   2026_, vía SDP Noticias, 2026.
   https://www.sdpnoticias.com/estados/aimx-revela-habitos-digitales-de-mexicanos-en-2026-ia-redes-sociales-y-compras-online/
5. ✓ Secundaria. AMVO, _Estudio de Venta Online 2026_, vía Marketing4Ecommerce MX, 2026.
   https://marketing4ecommerce.mx/estudio-de-venta-online-2026-amvo-mexico/
6. ✓ Con límite: 11 países, no aísla México. GoDaddy y Advanis, «Redes sociales y pymes en México en
   2025», 2025. https://www.godaddy.com/resources/latam/emprender/redes-sociales-pymes-mexico-2025
7. Secundaria. UnoTV con datos de INEGI ENOE, julio de 2026.
   https://www.unotv.com/negocios/informalidad-laboral-mexico-julio-2026-56-2-34-1-millones-trabajadores-inegi/
8. ✓ TikTok Newsroom, «TikTok Shop México…», 2025. https://newsroom.tiktok.com/es-latam/tiktok-shop-evento-cdmx
9. Agencia sin metodología publicada. Shortway, «¿Cuánto cuesta contratar un influencer en México?», 2026. https://shortway.com.mx/cuanto-cuesta/contratar-influencer

**Pagos**

10. ✓ Mercado Pago México, _Link de pago_, 2026. https://www.mercadopago.com.mx/herramientas-para-vender/link-de-pago
11. ✓ Stripe, _Precios México_ (sin IVA), 2026. https://stripe.com/mx/pricing
12. Stripe Docs, _Pagos con OXXO_. https://docs.stripe.com/payments/oxxo
13. Mercado Pago Developers, _Integrar el checkout en marketplace_.
    https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/how-tos/integrate-marketplace

**Infraestructura e IA**

14. ✓ Anthropic, _Pricing_, 2026. https://platform.claude.com/docs/en/about-claude/pricing
15. ✓ Vercel, _Pricing_. https://vercel.com/pricing
16. Vercel, _Usage & Pricing for Cron Jobs_, 2026. https://vercel.com/docs/cron-jobs/usage-and-pricing
17. ✓ Con corrección. Neon, _Pricing_, 2026. https://neon.com/pricing
18. Cloudflare, _R2 pricing_. https://developers.cloudflare.com/r2/pricing/
19. ✓ Resend, _Pricing_. https://resend.com/pricing
20. Sentry, _Pricing_. https://sentry.io/pricing/
21. GitHub, _Actions billing_. https://docs.github.com/en/billing/concepts/product-billing/github-actions
22. Meta, _WhatsApp Business Platform pricing_. https://developers.facebook.com/docs/whatsapp/pricing

**SEO y vistas previas**

23. ✓ Meta for Developers, _Link Previews_ (WhatsApp).
    https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews
24. Meta, _Images in Link Shares_. https://developers.facebook.com/docs/sharing/webmasters/images
25. Meta, _Meta Web Crawlers_. https://developers.facebook.com/docs/sharing/webmasters/web-crawlers
26. Google Search Central, _Merchant listing structured data_.
    https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
27. Google Search Central Blog, «Farewell, Sitelinks Search Box», 2024.
    https://developers.google.com/search/blog/2024/10/sitelinks-search-box
28. web.dev (Google), _Web Vitals_. https://web.dev/articles/vitals

**Legal y fiscal**

29. ✓ Cámara de Diputados, _Ley de Ingresos de la Federación 2026_, DOF 07-11-2025, art. 25 fr. VI y IX.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/LIF_2026.pdf
30. Cámara de Diputados, _Ley del ISR_, arts. 113-A y 113-C. https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf
31. Cámara de Diputados, _Ley del IVA_, arts. 1o.-A BIS, 18-B y 18-J. https://www.diputados.gob.mx/LeyesBiblio/pdf/LIVA.pdf
32. Solo fuentes secundarias; el revisor no pudo leer el texto oficial. Cámara de Diputados, _Código
    Fiscal de la Federación_, art. 30-B. https://www.diputados.gob.mx/LeyesBiblio/pdf/CFF.pdf ·
    IDC Online, 20-10-2025.
33. ✓ Cámara de Diputados, _LFPDPPP_ (DOF 20-03-2025; última reforma 14-11-2025), arts. 3, 15, 19 y 26.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf
34. Cámara de Diputados, _Ley Federal de Protección al Consumidor_, arts. 17, 18, 32, 76 BIS y 77. El
    revisor verificó el 77; los arts. 17, 18 y 32 se consultaron en la compilación leyes-mx.com.
    https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf · https://leyes-mx.com/ley_federal_de_proteccion_al_consumidor/17.htm
35. PROFECO, «Profeco emite Guía de Publicidad para Influencers», 2023.
    https://www.gob.mx/profeco/prensa/profeco-emite-guia-de-publicidad-para-influencers
36. ✓ IDC Online, «SAS 2026: actualizan tope de ingresos anuales», 09-01-2026 ($7,678,849.94).
    https://idconline.mx/comercio-exterior/2026/01/09/sas-2026-actualizan-tope-de-ingresos-anuales ·
    DOF, 26-12-2025 (encontrado en la búsqueda, no lo abrí): https://dof.gob.mx/nota_detalle.php?codigo=5777134&fecha=26%2F12%2F2025
37. Secundaria; confirmar en el IMPI. ARKA Consulting, «Registro de marca IMPI 2026: costo real, pasos y
    plazos», 2026 ($2,994.62 + IVA por clase). https://arkaconsulting.com.mx/registro-marca-impi-2026

**Calendario**

38. ✓ Secundaria. El Imparcial, «El Buen Fin 2026: fechas…», 24-09-2026.
    https://www.elimparcial.com/dinero/2026/09/24/el-buen-fin-2026-fechas-y-que-comercios-participan-en-mexico/
39. AMVO, «Fechas oficiales del Hot Sale 2026». https://blog.amvo.org.mx/blog/confirmado-fechas-oficiales-y-datos-clave-del-hot-sale-2026

**Otras**

40. OpenAI, _Moderation guide_. https://developers.openai.com/api/docs/guides/moderation

**Evidencia interna (no son fuentes de mercado):**

- `docs/*.md`;
- `src/modules/ai/{budget,cost,service}.ts`, `src/modules/platform/settings.ts`,
  `src/modules/feed/policy.ts`, `src/modules/commerce/fees.ts`, `src/modules/catalog/pricing.ts`;
- `src/server/providers/payments/index.ts`, `src/lib/safe-redirect.ts`, `src/server/env-schema.ts`,
  `prisma/seed.ts`;
- `.data/security/**` y `.data/strategy/results/**`.

---

## Anexo · Cómo se aplicó cada corrección del revisor

| #   | Corrección                                                          | Dónde quedó                                                                                                                                                                     |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | La restauración de Neon cuesta US$0.20/GB-mes                       | 6.1: corregida; la opción A se justifica por las ramas y el escalado a cero                                                                                                     |
| 2   | El presupuesto no se acaba «hacia el día 14»; el riesgo es el abuso | 6.2: US$0.37 por vendedor, ≈ US$44 con 100; 480 al día = US$12.5–15.6; cuotas antes de la IA real                                                                               |
| 3   | Tres supuestos de uso distintos                                     | 6.2 y decisión 6: 8 para planear, cuota de 30 y 10 al día; mediana real con las primeras 200                                                                                    |
| 4   | Cobertura mal calculada                                             | 6.2: ≈ $17.7 M MXN al mes; fórmula de cobertura total                                                                                                                           |
| 5   | Información fiscal desactualizada en mejoras                        | 7.1: solo LIF 2026 (2.5 %, 20 % sin RFC); se eliminó el «1 % / 8 %»                                                                                                             |
| 6   | GoDaddy no es de México                                             | 3.2: «dolores a validar»; se mide en las 30 entrevistas                                                                                                                         |
| 7   | Cifras de compradores inconsistentes                                | 3.2: base ≈ 39 M, techo 77.2 M; comunicado 32/26 citado. **Sin aplicar del todo:** el 37.3 % no aparece en el texto del comunicado, así que queda como secundaria por confirmar |
| 8   | B7 sobredimensionado                                                | 4.2: fuera de la Ola 0; solo una prueba contra la exposición en DTOs                                                                                                            |
| 9   | Umbral del IA CEO en unidades infladas                              | 2.4: impresiones visibles, asignación por persona, efecto de diseño, ≈ 41,000 por variante                                                                                      |
| 10  | E2 y E3 mal diseñados                                               | 3.8: E2 al azar por link en `ShareLink`; E3 con mínimo de 3,800 por variante                                                                                                    |
| 11  | El grupo sin cambios del 5 % no sirve en el piloto                  | 2.4: pospuesto hasta ≈ 820,000 impresiones visibles en 14 días                                                                                                                  |
| 12  | Metas de registros no coinciden                                     | 3.4 y 3.7: 2,200 al día 90 (ventana de las semanas 5–12)                                                                                                                        |
| 13  | «Ganancia real» no lo es                                            | 3.1, 3.5 y 3.6: «tu margen por pieza con tus números» y sus exclusiones                                                                                                         |
| 14  | Pagar fuera: tres informes chocan                                   | 7.2 y decisión 4: una sola regla B1                                                                                                                                             |
| 15  | B1 frente a la reserva de 30 min                                    | 7.2: estado «Esperando pago al vendedor»; el cron no lo cancela                                                                                                                 |
| 16  | Pasarela simulada en producción                                     | G1, S1 y Ola 0                                                                                                                                                                  |
| 17  | Semilla demo en producción                                          | G2, Ola 0                                                                                                                                                                       |
| 18  | Comunidades vacías en producción                                    | G3, 3.4, ED2 y decisión 11 (antes del día 10)                                                                                                                                   |
| 19  | C1 y E4 cambian ADR-022                                             | 3.8 (E4) y decisión 12                                                                                                                                                          |
| 20  | Menos comercio no es riesgo bajo                                    | 2.4: riesgo medio en ambos sentidos + salvaguarda de visitas por vendedor + decisión 13                                                                                         |
| 21  | Encargado ≠ transferencia                                           | 7.1: DPA y mención en el aviso; confirmar con el abogado                                                                                                                        |
| 22  | Dato de WhatsApp                                                    | 3.2: se usa AIMX 2026 (91 %)                                                                                                                                                    |
| 23  | La empresa tiene que existir antes de abrir                         | 7.1 y decisión 5: responsable identificado desde el día 1; entidad antes del vendedor 11                                                                                        |
| 24  | Datos del vendedor frente a su privacidad                           | 7.1: en la confirmación del pedido; preguntar si cuenta como «proveedor»                                                                                                        |
| 25  | Garantía contra la LFPC 77                                          | Tr0 y 7.1                                                                                                                                                                       |
| 26  | Control de edad                                                     | ED (Ola 0) y 7.1                                                                                                                                                                |
| 27  | Correos de marketing                                                | 3.5 y 7.1                                                                                                                                                                       |
| 28  | Plan de incidentes tarde                                            | 4.1: antes del primer despliegue público                                                                                                                                        |
| 29  | Los 60 textos son un uso nuevo                                      | 6.2 (punto 7) y 7.1                                                                                                                                                             |
| 30  | Preguntas fiscales de B1                                            | 7.1                                                                                                                                                                             |
| 31  | Ventas autodeclaradas                                               | 3.6: doble confirmación; métrica con y sin                                                                                                                                      |
| 32  | Red propia frente a descubrimiento                                  | 3.3 y 3.6: origen del pedido; red personal excluida del 40 %                                                                                                                    |
| 33  | Comprobantes falsos                                                 | 7.2                                                                                                                                                                             |
| 34  | Soporte                                                             | SOP (Ola 0), 2.1 y tablero                                                                                                                                                      |
| 35  | Envenenamiento de métricas                                          | 2.3 (eventos firmados), S8 y 7.4                                                                                                                                                |
| 36  | Imagen para compartir cara y pública                                | 5, P0-4                                                                                                                                                                         |
| 37  | Inyección de instrucciones al analista                              | 2.3 y 7.4                                                                                                                                                                       |
| 38  | «Demanda sin oferta» identifica                                     | S4 (≥ 10 personas, rangos) y 7.3                                                                                                                                                |
| 39  | Reportes contra un competidor                                       | T4-min y 7.3                                                                                                                                                                    |
| 40  | _Pooler_ y prueba de carga                                          | 6.1 y 7.4                                                                                                                                                                       |
| 41  | Los 4 planes no caben en 30 días                                    | 4.2: un backlog, Ola 0 recortada; IA CEO, autopiloto, agente, SEO P1 y Reels después del día 45                                                                                 |
| 42  | Tiempo del fundador                                                 | 3.7 y decisión 1                                                                                                                                                                |
| 43  | Flujo de caja de 90 días                                            | 6.3 y decisión 8                                                                                                                                                                |
| 44  | Costos en dólares                                                   | 6.3: preguntas al contador                                                                                                                                                      |
| 45  | Pagos reales en días 61–90 poco realistas                           | 7.2: después del día 90; B1 todo el piloto                                                                                                                                      |
| 46  | Rastros en la BD de desarrollo                                      | 4.1, higiene de esta semana                                                                                                                                                     |
| 47  | `LINK_PREVIEW` no se muestra al vendedor                            | 5, P0-1                                                                                                                                                                         |
| 48  | Contenido IA diario en comunidades sin gente                        | 3.4: tope por nicho y métrica de contenido de personas reales                                                                                                                   |
| 49  | Falta la seguridad                                                  | 4.1 (con la evidencia de `.data/security`) y la Ola 0                                                                                                                           |
