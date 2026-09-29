# messages

Mensajes privados (ADR-047): una conversación por par de personas, texto plano, solo para las dos.
Gratis para todos: es el pegamento de la red social; el dinero viene de las tiendas (ADR-046).

| Archivo        | Qué hace                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pair.ts`      | Reglas puras: par ordenado (una conversación por dos personas), quién es «la otra persona», no leídos, limpieza del texto (≤ 2,000) y la pista de datos de pago. |
| `service.ts`   | Destinatario válido (perfil terminado, no editorial, no uno mismo), conversación por par, bandeja con último mensaje y no leídos, hilo (marca lectura), enviar.  |
| `actions.ts`   | `sendMessageAction` (30 cada 10 min por persona) y `startConversationAction` (20 conversaciones nuevas al día).                                                  |
| `components/*` | Campo de escribir (Enter envía), refresco del hilo cada 10 s mientras está visible, botón «Mensaje» / «Preguntar» (visitantes: crear cuenta y volver).           |

Páginas: `/mensajes` (bandeja), `/mensajes/[id]` (hilo, reportar a la otra persona desde el
encabezado) y `/mensajes/nuevo?para=usuario&texto=…` (abre o crea la conversación y prellena el
texto; así se enlaza desde perfiles y productos). El globo de no leídos va en `ViewerSummary`.
