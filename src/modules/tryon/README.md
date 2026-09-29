# tryon

«Pruébatelo» (ADR-043, ADR-044, ADR-045): la foto de la persona con uno o varios productos, generada
por el proveedor de imágenes (`server/providers/image`). Bandera `virtualTryOn`.

- **Foto de la persona:** se sube por `/api/uploads` (validación, sin metadatos) y se registra como
  `TryOnPhoto` con consentimiento versionado (`consent.ts`, `LEGAL_VERSIONS.tryOn`). Privada: `/media`
  solo se la sirve a su dueña o dueño (ni al equipo), nunca se adjunta a nada (validación y trigger
  `private_media_link`), el recolector de huérfanas la excluye y se borra a los 30 días o antes
  desde Ajustes. Máximo 5 fotos vivas.
- **Quién paga (`funding.ts`):** patrocinio del vendedor del producto principal → pruebas gratis
  del mes (3, con tope diario global del subsidio) → saldo de la persona. El cobro y la fila del
  resultado van en la misma transacción que la reserva de la solicitud de IA; si el proveedor
  falla, se devuelve.
- **Caché:** `TryOnResult.cacheKey` = SHA-256 de (foto, productos con sus fotos, versión del
  prompt, modelo): el mismo pedido reutiliza el resultado sin cobrar.
- **Tarea (`task.ts`):** prompt en inglés sin datos personales; el simulador compone la foto con
  miniaturas de las prendas y una franja «Simulación de ejemplo».
- **Retención:** `deleteExpiredTryOnMedia` es un paso de la operación diaria (`tryon-retention`).
- Cuotas propias: 10 por hora y 30 por día por persona, además de las generales de IA.

Páginas: `/probar?producto=…` o `/probar?look=…` (estudio) y `/probar/[id]` (resultado con el
aviso «Simulación generada con IA»). Ajustes → «Mis fotos de prueba».

Eventos: `TRY_ON_GENERATED` (`metadata.funding`, `metadata.cached`).
