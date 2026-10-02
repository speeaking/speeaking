# notifications

La campana de avisos (ADR-059): quién reaccionó, comentó o empezó a seguirte, y los pedidos que
cambian de estado.

- `notify.ts`: crear y quitar avisos, siempre «a lo mejor posible» (si falla, la acción que lo causó
  no se deshace). Reacciones y seguimientos se renuevan por `dedupeKey` (uno por persona); quitar la
  reacción o dejar de seguir quita su aviso. Nadie se avisa a sí mismo. Pedidos: pagado → a quien
  vende; enviado, entregado o cancelado → a quien compra.
- `queries.ts`: el número de la campana, la lista (solo lo que sigue visible: una publicación o un
  comentario retirados ya no avisan), marcar leídos y la retención de 90 días (paso
  `notifications-retention` de la operación diaria).
- `group.ts` (puro): agrupa como Facebook (reacciones y comentarios por publicación, seguidores del
  mismo día) y redacta la frase en singular o plural.
- `components/`: la lista con «Nuevos» y «Anteriores»; `MarkNotificationsRead`, que al abrir
  `/avisos` los marca leídos y apaga el globo de la barra, y `NotificationsPanel`, el recuadro de la
  campana (ADR-068): los carga con `loadNotificationsAction`, los marca leídos y apaga el globo sin
  recargar la página.
