# catalog

Productos, categorías, costo privado (`ProductCost`, nunca enviado al navegador) y datos verificables de
entrega, garantía, devoluciones y autenticidad (P4, ADR-007). Fase: 1.6.

## Límites (SEC-15)

`limits.ts` (`checkCatalogLimit`): crear productos 30/h y 150/día por cuenta (60/h por IP); cada
intento cuenta, también los inválidos. Compartir un producto (`share-actions.ts`) usa el mismo límite
que compartir una publicación (`social/limits.ts`, 60/h por IP y por cuenta).

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

## Buscadores (ADR-073)

- `seo.ts`: título, descripción y datos estructurados de la ficha (envío nacional, devoluciones y
  lugar de venta), siempre a partir de los datos verificables, nunca de la IA.
- `places.ts`: el estado escrito por el vendedor se lee como uno de los 32 canónicos. Las páginas
  «Comprar en …» (`/comprar/en/[estado]` y `/comprar/[categoria]/en/[estado]`) existen solo con al
  menos `MIN_PRODUCTS_FOR_PLACE_PAGE` (6) productos a la venta de tiendas activas. Con menos dan
  404 y no entran al sitemap.
