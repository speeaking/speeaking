# creators

Colaboraciones con creadores (ADR-063), etapa 1: sin dinero de por medio.

- **Quién etiqueta qué** (`rules.ts`, código puro). Cada quien etiqueta sus propios productos. El
  producto de OTRA tienda solo si esa tienda activó `acceptsCollaborations`, está activa y el
  producto está a la venta y visible. `createPostAction` (social) aplica la regla en el servidor.
- **La tienda decide y conserva el control** (`service.ts`). Studio → Colaboraciones: activa o
  desactiva, ve quién etiquetó sus productos y quita la etiqueta de cualquier publicación
  (`removeProductTag`: solo la tienda dueña; la publicación sigue sin el producto y quien publicó
  recibe un aviso).
- **«Colaboración»**: quien publica declara si recibió algo (pago, producto o comisión) y la tarjeta
  lo dice («Colaboración con <tienda>»); la tienda también puede marcarla (`markCollaboration`). No
  se desmarca. La publicidad debe identificarse (LFPC art. 32).
- **Métricas por publicación** (`metrics.ts`, puro; `service.ts` las carga con dos consultas
  agrupadas): visitas a la ficha, pruebas de «Ver cómo me veo», veces al carrito y pedidos pagados
  que llegaron DESDE la publicación (`sourcePostId`). Solo cuenta lo que coincide con el producto de
  la publicación. Solo conteos: nunca quién ni montos.
- **Pantallas.** `/creadores` (pública): cómo funciona, productos para recomendar y lo que lograron
  las publicaciones propias. `/studio/colaboraciones`: el ajuste y las publicaciones de otras
  personas. `/crear/publicacion?producto=<slug>` abre el formulario con el producto elegido.
- **Etapa 2 (después).** Comisión por venta con pagos reales; la base es `OrderItem.sourcePostId`.
