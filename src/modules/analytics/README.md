# analytics

`track()`, taxonomía de eventos y atribución (`sourcePostId`) desde el día 1 (ADR-009); métricas del
Studio (beneficio, ventas, visitas, conversión). Fases: 1.5–1.7.

**Integridad de métricas (SEC-20).** `integrity.ts` filtra en `track` antes de guardar: impresiones,
vistas y compartidos cuentan una vez por persona (o IP) y entidad por ventana; los compartidos solo
de publicaciones o productos visibles; `sourcePostId` solo si esa publicación publicada es del
producto; `AI_PROPOSAL_ACCEPTED` solo con una propuesta propia.
