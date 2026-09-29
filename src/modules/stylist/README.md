# stylist

«¿Qué necesitas?», «Crea mi look», «Completa mi look» y la coincidencia comprador–producto
(ADR-043). Detrás de las banderas `shoppingIntent`, `createLook`, `completeLook` y `buyerMatching`
(`ai/features.ts`). Regla: **la IA nunca inventa productos**; todo look lleva `productId`, precio y
vendedor reales, activos, con existencias y visibles (P2, P4).

| Archivo        | Qué hace                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `need.ts`      | Necesidad estructurada (`Need`): ocasión, estilo, presupuesto, género, momento, colores, palabras. Intérprete de reglas (siempre) y tarea del modelo `shopping_intent`; el presupuesto SIEMPRE lo pone el código.        |
| `slots.ts`     | Huecos de un look (`top`, `bottom`, `dress`, `outerwear`, `shoes`, `bag`, `accessory`) por categoría y, si es genérica, por palabras del título y las etiquetas.                                                         |
| `composer.ts`  | Compositor determinista: relevancia por palabras, colores y pistas de ocasión/estilo; plantillas (arriba + abajo + calzado, o vestido + calzado); ajuste al presupuesto bajando piezas; opcionales si caben; `swapSlot`. |
| `look-copy.ts` | Nombre y explicación del look: por reglas (hoy) o tarea `look_copy` con guardián.                                                                                                                                        |
| `queries.ts`   | Candidatos vendibles de moda (DTO sin costo), producto por slug, productos por id.                                                                                                                                       |
| `service.ts`   | `interpretNeed` (IA con cuota propia o reglas), `createLooks`, `completeLook`, `getLook`, `swapLookItem`, `listMyLooks`, `saveNeedAsIntent` (alimenta «Lo que buscas»).                                                  |
| `actions.ts`   | «Otra opción» / «Más barato» y «Comprar look» (carrito).                                                                                                                                                                 |
| `matching.ts`  | «N personas buscan algo así» en el Studio: intenciones activas de 30 días que coinciden con cada producto y cuyo presupuesto alcanza; solo un número agregado, nunca quiénes.                                            |
| `components/*` | Campo «¿Qué necesitas?», tarjeta de look, tarjeta de Comprar y acciones en la ficha de producto.                                                                                                                         |

Páginas: `/estilista?necesidad=…` (GET, compartible) y `/estilista/completa/[slug]?max=…`. Un
prefetch no arma ni guarda looks. Los looks de personas con sesión se guardan (`StyleLook`) para
probárselos y cambiar piezas; los de visitantes no. La misma necesidad en la última hora reutiliza
los looks guardados (con las piezas cambiadas) en vez de armar otros ni volver a llamar al modelo.

Eventos: `NEED_SUBMITTED`, `LOOK_GENERATED`, `LOOK_ITEM_SWAPPED` (superficie `STYLIST`).
