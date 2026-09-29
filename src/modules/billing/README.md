# billing

Saldo de la tienda y precio comunitario (ADR-044, ADR-046, `docs/modelo-de-ingresos.md`). Quien
compra nunca paga: lo que cuesta dinero lo paga quien vende, solo cuando le trae ventas.

- `pricing.ts`: tabla aprobada de niveles de «Ver cómo me veo» (volumen mensual de toda la
  plataforma → precio), piso de 1.5 × el costo unitario, pruebas de cortesía por tienda
  (`STORE_TRIAL_TRY_ONS`), recargas de la tienda (Arranque, Impulso, Tienda pro) y el precio por día
  del producto destacado. Todo puro y probado.
- `wallet.ts`: cartera por cuenta en centavos MXN con candado de fila, libro de movimientos con el
  saldo resultante y CHECK `balanceCents >= 0`; abonos, cargos, devoluciones; gasto del día por tipo.
- `service.ts`: precio vigente (`getTryOnPricing`, con el volumen del mes anterior y el costo del
  modelo enrutado), recargas simuladas (ADR-032, marcadas y sin ingreso), `applyTopUpPayment` para
  un proveedor real (webhook, idempotente, ingreso `AI_PREMIUM` en el libro de la plataforma) y el
  interruptor «Ver cómo me veo» de la tienda con su tope diario.
- `actions.ts` y `components/*`: recargar y activar las pruebas (`/studio/saldo`). `/saldo` explica
  a quien compra que todo es gratis y lleva a abrir una tienda. Página pública de precios:
  `/precios`.

La IA CEO no puede tocar nada de aquí (`billing.` y `ai.features` están en la lista prohibida).
