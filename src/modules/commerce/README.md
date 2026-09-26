# commerce

Carrito, checkout, una orden por vendedor, `PaymentProvider` simulado y stock atómico (ADR-011).
Sprint 2 (fases 7–9).

- `checkout.ts`: reserva (candado por comprador, topes de pendientes y de piezas por producto,
  productos bloqueados siempre en el mismo orden), pagos idempotentes, vencimiento y liberación (un
  checkout que falla no detiene el barrido), avance y cancelación del vendedor.
- `order-transitions.ts`: qué puede hacer el vendedor con cada pedido (una sola tabla para los
  botones y el `updateMany`). Con pago simulado solo se cancela, nunca se envía.
- `seller-orders.ts` / `seller-order-dto.ts`: lo que el vendedor ve de sus pedidos; nombre y domicilio
  del comprador solo mientras el pedido está pagado, y el domicilio solo con cobro real (con pago
  simulado no hay nada que enviar).
- La pasarela simulada solo existe con `simulatedPaymentsEnabled()` (ver `src/server/providers/payments`).
- `checkout.db.test.ts` corre contra la base de desarrollo (`pnpm db:start`); se omite sin `DATABASE_URL`.
