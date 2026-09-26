# catalog

Productos, categorías, costo privado (`ProductCost`, nunca enviado al navegador) y datos verificables de
entrega, garantía, devoluciones y autenticidad (P4, ADR-007). Fase: 1.6.

## Editar, pausar y reactivar (Studio)

- `service.ts` (`updateProduct`, `setProductStatus`): la propiedad se comprueba en la consulta
  (`seller.userId`) y la fila se bloquea en la transacción, así el checkout no vende a la vez.
- El slug no cambia al editar. El costo (`ProductCost`) se actualiza en la misma transacción y solo
  se muestra en `/studio/productos/[id]/editar`, nunca en páginas públicas.
- Fotos: los IDs recibidos reemplazan las del producto en ese orden (la primera es la portada);
  deben estar listas y ser propias o ya del producto. Las filas de `Media` no se borran.
- Inventario: número absoluto de piezas disponibles. Si el vendedor no lo cambió (`stockShown`), no
  se escribe, para no deshacer ventas hechas mientras editaba. Si lo cambió y también cambió en la
  base mientras tanto (una compra, un apartado que venció), no se guarda nada: `STOCK_CHANGED`
  devuelve el número vigente, el formulario lo muestra y compara contra él al reintentar. Reglas de
  estado en `status.ts`: activo sin piezas → agotado, agotado con piezas → activo, pausado se queda
  pausado.
- El formulario no se envía mientras una foto se está subiendo (se guardaría sin ella).
- Pausado: la página pública sigue existiendo (enlaces compartidos) con "Pausado por el vendedor" y
  sin botón de compra; el feed, "Comprar" y los relacionados solo muestran productos activos.
