# billing

Saldo y precio comunitario (ADR-044, `docs/modelo-de-ingresos.md`).

- `pricing.ts`: tabla aprobada de niveles de Pruébatelo (volumen mensual de toda la plataforma →
  precio), piso de 1.5 × el costo unitario, pruebas gratis al mes, recargas. Todo puro y probado.
- `wallet.ts`: cartera por cuenta en centavos MXN con candado de fila, libro de movimientos con el
  saldo resultante y CHECK `balanceCents >= 0`; abonos, cargos, devoluciones; gasto del día por tipo.
- `service.ts`: precio vigente (`getTryOnPricing`, con el volumen del mes anterior y el costo del
  modelo enrutado), recargas simuladas (ADR-032, marcadas y sin ingreso), `applyTopUpPayment` para
  un proveedor real (webhook, idempotente, ingreso `AI_PREMIUM` en el libro de la plataforma) y
  el patrocinio del vendedor.
- `actions.ts` y `components/*`: recargar (`/saldo`) y «pruebas gratis en mis productos»
  (`/studio/saldo`). Página pública de precios: `/precios`.

La IA CEO no puede tocar nada de aquí (`billing.` y `ai.features` están en la lista prohibida).
