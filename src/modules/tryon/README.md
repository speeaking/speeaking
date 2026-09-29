# tryon

«Ver cómo me veo» / Pruébatelo (ADR-043, ADR-045, ADR-046): la foto de la persona con uno o varios
productos, generada por el proveedor de imágenes (`server/providers/image`). Bandera `virtualTryOn`.

- **Un solo paso desde la ficha (`components/try-on-dialog.tsx`, `quickTryOnAction`):** sube tu foto
  (o elige una guardada), un botón, y la simulación aparece en el mismo diálogo. Después: comprar
  (checkout o carrito), «Agrégale…» complementos reales de otros huecos (`complements.ts`, primero
  de la misma tienda) y verse con todo puesto, o ir al estudio para más fotos y looks completos.
- **Foto de la persona:** se sube por `/api/uploads` (validación, sin metadatos) y se registra como
  `TryOnPhoto` con consentimiento versionado (`consent.ts`, `LEGAL_VERSIONS.tryOn`). Privada: `/media`
  solo se la sirve a su dueña o dueño (ni al equipo), nunca se adjunta a nada (validación y trigger
  `private_media_link`), el recolector de huérfanas la excluye y se borra a los 30 días o antes
  desde Ajustes. Máximo 5 fotos vivas.
- **Quién paga (`funding.ts`): la tienda, nunca quien compra.** Orden: la tienda del producto
  principal si tiene «Ver cómo me veo» activo, saldo y tope del día → las pruebas de cortesía de esa
  tienda (`STORE_TRIAL_TRY_ONS`, las paga Estreno) → nada: el botón explica que la tienda no tiene
  pruebas activas y registra la demanda (`TRY_ON_REQUESTED`) que el vendedor ve en `/studio/saldo`.
  El cobro y la fila del resultado van en la misma transacción que la reserva de la solicitud de
  IA; si el proveedor falla, se devuelve. `TryOnResult.sellerId` guarda la tienda del producto
  principal (cortesía por tienda y estadísticas).
- **Caché:** `TryOnResult.cacheKey` = SHA-256 de (foto, productos con sus fotos, versión del
  prompt, modelo): el mismo pedido reutiliza el resultado sin cobrar.
- **Tarea (`task.ts`):** prompt en inglés sin datos personales; el simulador compone la foto con
  miniaturas de las prendas y una franja «Simulación de ejemplo».
- **Retención:** `deleteExpiredTryOnMedia` es un paso de la operación diaria (`tryon-retention`).
- Cuotas propias: 10 por hora y 30 por día por persona, además de las generales de IA.

Páginas: la ficha del producto (diálogo), `/probar?producto=…` o `/probar?look=…` (estudio para
looks completos) y `/probar/[id]` (resultado con el aviso «Simulación generada con IA»). Ajustes →
«Mis fotos de prueba». Studio → Saldo: pruebas por producto, demanda y el interruptor.

Eventos: `TRY_ON_GENERATED` (`metadata.funding`, `metadata.cached`) y `TRY_ON_REQUESTED`.
