# ceo

Motor de automejora («IA CEO», ADR-019, ADR-033, ADR-037). Diseño completo en
`docs/architecture.md` → Motor de automejora; límites y riesgo en `platform/tunables.ts`,
`applySettingChange` en `platform/apply.ts`. La IA propone; el código mide, clasifica el riesgo,
aplica dentro de límites y revierte. Pagos, precios, comisiones y gasto quedan fuera de su alcance.

- `metrics.ts` (+ `metric-catalog.ts`): `DailyMetric` por día de México, idempotente.
- `analyst.ts` (+ `detectors.ts`, `stats.ts`, `narrative.ts`): propuestas con estadística
  determinista; la IA solo redacta (opcional, `Narrator`).
- `autonomy-policy.ts`, `threshold.ts`: qué se aplica solo (modo, congelamientos, umbral de tráfico).
- `experiments.ts`: lanzar, detener, evaluar y concluir (adoptar siempre requiere a una persona).
- `guardrails.ts`, `monitor.ts`: salvaguardas y reversión automática. ADR-037: revertir solo ante
  un empeoramiento que supere el umbral y sea estadísticamente significativo, con ventana máxima de
  vigilancia (sin muestra: «sin datos suficientes», nunca un 0 inventado). Prueba unilateral,
  α = 0.05; la varianza de cada lado se multiplica por el MAYOR entre el efecto de diseño por persona
  del analista y la sobredispersión medida (`pearsonDispersion`: entre días en el monitor, porque
  antes contra después no cancela los días atípicos; entre personas en un experimento, para que una
  sola cuenta no baste). Con línea base en 0, un tope absoluto.
  El monitor corre a diario; vigila 14 días y a lo más 28 (`maxWatchDays`): si faltan datos, cierra
  con «sin evidencia de daño con esta muestra» (`monitor_closed` en la bitácora).
- `pipeline.ts`, `jobs.ts`, `scheduled.ts`, `cron-auth.ts`: `pnpm ops:daily` y `/api/cron/daily`
  (`Authorization: Bearer <CRON_SECRET>`; sin el secreto correcto, 404). Cómo programarla en Vercel
  Cron o en el cron de un VPS: `docs/architecture.md` → Operación.
- `service.ts`, `actions.ts`, `queries.ts`, `decision-filters.ts`, `components/`: /admin/resumen,
  /admin/decisiones y /admin/experimentos.
- `handled-elsewhere.ts`: lo que se decide en otra pantalla (`ai.routing` → /admin/ia) aparece en la
  cola solo como «Se aplica en /admin/ia» con liga; no se aprueba, rechaza ni revierte desde aquí
  (tampoco en el servicio) y las propuestas repetidas se muestran una vez. Aplicar ese mismo cambio
  en /admin/ia deja la propuesta APLICADA (y las repetidas ligadas a ella, con el motivo), y proponer
  otra vez lo mismo no crea otra (`ai/routing-decisions.ts`, con la misma `proposalKey`).
- Modo de autonomía: `observer` (por omisión) | `low_risk`. No hay «apagado»: `observer` ya no
  aplica nada solo.
- Umbral de tráfico: se mide en impresiones VISIBLES de personas con sesión y personalización (T5,
  ADR-037: ≥ 50 % de la pieza en pantalla durante ≥ 1 s, aceptada solo si la pieza se le sirvió a
  esa persona). `FEED_IMPRESSIONS_ARE_VISIBLE` (`analytics/platform-aggregates.ts`) ya es `true`;
  si alguna vez vuelve a `false`, nada se aplica ni se prueba solo, aunque el modo sea `low_risk`.
- Solo personas con sesión: el umbral, las salvaguardas (y la exposición mínima del monitor), las
  tasas del analista y los experimentos cuentan SOLO impresiones visibles de personas con sesión (y
  personalización), y sus numeradores (reportes, «No me interesa», interacciones, visitas) solo de
  esas mismas personas (`signedInFeedTotals` en `analytics/platform-aggregates.ts`); la salvaguarda
  de visitas por vendedor activo cuenta las visitas con sesión (y personalización) de cualquier
  origen, sin las anónimas. No hay detección de robots: así, un robot SIN CUENTA que inunde
  impresiones o visitas anónimas no puede forzar ni esconder una reversión (uno con cuentas sí
  cuenta: pendiente en ADR-037). Las visibles anónimas (`feed.impressions.visible.anonymous`) y
  la pieza servida (`feed.impressions.served`) son métricas descriptivas; con ellas no se decide
  nada. Las filas redefinidas (`VISIBLE_IMPRESSION_METRICS`) de antes de `VISIBLE_IMPRESSIONS_SINCE`
  (2026-09-27: el primer día COMPLETO con visibles) no se comparan (`metric-rows.ts`).

Todo lo que toca la base recibe el cliente como parámetro (sin `@/server/db`), salvo `service.ts`,
`queries.ts` y `scheduled.ts`: así corre en Next, en el script y en pruebas dentro de una transacción
que se deshace (`engine.db.test.ts`).
