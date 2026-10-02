# messages

Mensajes privados (ADR-047): una conversación por par de personas, texto plano, solo para las dos.
Gratis para todos: es el pegamento de la red social; el dinero viene de las tiendas (ADR-046).

| Archivo        | Qué hace                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pair.ts`      | Reglas puras: par ordenado (una conversación por dos personas), quién es «la otra persona», no leídos, limpieza del texto (≤ 2,000) y la pista de datos de pago. |
| `service.ts`   | Destinatario válido (perfil terminado, no editorial, no uno mismo, sin bloqueo), conversación por par, bandeja, hilo (marca lectura), enviar, bloquear mensajes. |
| `actions.ts`   | Enviar (30 cada 10 min), empezar conversación (20 al día), cargar bandeja e hilo para el recuadro y bloquear o desbloquear (30 cambios por hora).                |
| `components/*` | Recuadro de mensajes (bandeja → hilo ahí mismo), opciones de la conversación, campo de escribir, refresco cada 10 s, botón «Mensaje» / «Preguntar».              |

Páginas: `/mensajes` (bandeja), `/mensajes/[id]` (hilo; tocar a la persona abre ver perfil,
bloquear mensajes y reportar) y `/mensajes/nuevo?para=usuario&texto=…` (abre o crea la conversación
y prellena el texto; así se enlaza desde perfiles y productos). El globo de no leídos va en
`ViewerSummary`; el botón de la barra abre el recuadro (ADR-068) y lleva a `/mensajes` si la página
todavía no carga.

**Bloquear mensajes (ADR-069, `MessageBlock`):** mientras exista, ninguna de las dos escribe ni
empieza otra conversación; el historial se queda y solo quien bloqueó lo quita. A la otra persona no
se le dice que la bloquearon.
